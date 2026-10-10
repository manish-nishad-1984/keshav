import type { Prisma } from '@prisma/client';
import { conflict } from '../../lib/httpError';
import { prisma } from '../../lib/prisma';

const includeRelations = {
  cuttingEntry: {
    select: {
      id: true,
      lotNumber: true,
      date: true,
      bookId: true,
      isOnline: true,
      totalQuantity: true,
      item: { select: { id: true, itemName: true, photoUrl: true } },
    },
  },
  party: { select: { id: true, name: true, mobile: true, address: true } },
  quantities: { include: { color: true, size: true } },
} as const;

const cellKey = (colorId: string, sizeId: string) => `${colorId}:${sizeId}`;

export const listDeliveries = async (
  organizationId: string,
  page: number,
  pageSize: number,
  filters: { bookId?: string; cuttingEntryId?: string; partyId?: string; search?: string },
) => {
  const search = filters.search?.trim();
  const challan = search && /^\d+$/.test(search) ? Number(search) : undefined;
  const where: Prisma.DeliveryWhereInput = {
    organizationId,
    cuttingEntry: { deletedAt: null, ...(filters.bookId ? { bookId: filters.bookId } : {}) },
    ...(filters.cuttingEntryId ? { cuttingEntryId: filters.cuttingEntryId } : {}),
    ...(filters.partyId ? { partyId: filters.partyId } : {}),
    ...(search
      ? {
          OR: [
            { cuttingEntry: { lotNumber: { contains: search, mode: 'insensitive' } } },
            { party: { name: { contains: search, mode: 'insensitive' } } },
            { billNumber: { contains: search, mode: 'insensitive' } },
            ...(challan !== undefined ? [{ challanNumber: challan }] : []),
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.delivery.findMany({
      where,
      include: includeRelations,
      orderBy: [{ date: 'desc' }, { challanNumber: 'desc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.delivery.count({ where }),
  ]);
  return { items, total };
};

export const findDeliveryById = (organizationId: string, id: string) =>
  prisma.delivery.findFirst({ where: { id, organizationId }, include: includeRelations });

// The company header printed on the challan.
export const findOrganizationHeader = (organizationId: string) =>
  prisma.organization.findUnique({
    where: { id: organizationId },
    select: { name: true, phone: true, addressLine1: true, gstNumber: true, logoUrl: true },
  });

// Lots of a book that have any production, with produced and delivered totals.
export const listLotsWithProduction = async (organizationId: string, bookId: string) => {
  const produced = await prisma.productionEntry.groupBy({
    by: ['cuttingEntryId'],
    where: { organizationId, deletedAt: null, cuttingEntry: { bookId, deletedAt: null, closedAt: null } },
    _sum: { carrierQuantity: true },
  });
  const lotIds = produced.map((p) => p.cuttingEntryId).filter((id): id is string => Boolean(id));
  const [lots, delivered] = await Promise.all([
    prisma.cuttingEntry.findMany({
      where: { id: { in: lotIds } },
      select: {
        id: true,
        lotNumber: true,
        date: true,
        totalQuantity: true,
        item: { select: { itemName: true } },
        party: { select: { name: true } },
      },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    }),
    prisma.delivery.groupBy({
      by: ['cuttingEntryId'],
      where: { cuttingEntryId: { in: lotIds } },
      _sum: { totalQuantity: true },
    }),
  ]);
  const producedBy = new Map(produced.map((p) => [p.cuttingEntryId, p._sum.carrierQuantity ?? 0]));
  const deliveredBy = new Map(delivered.map((d) => [d.cuttingEntryId, d._sum.totalQuantity ?? 0]));
  return lots.map((lot) => ({
    ...lot,
    producedQuantity: producedBy.get(lot.id) ?? 0,
    deliveredQuantity: deliveredBy.get(lot.id) ?? 0,
  }));
};

// Finished pieces of a lot per colour + size, keyed "colorId:sizeId": what the stitching karigars
// handed in as production.
export const sumProducedByCell = async (db: Prisma.TransactionClient, cuttingEntryId: string) => {
  const sums = await db.productionEntryQuantity.groupBy({
    by: ['colorId', 'sizeId'],
    where: { productionEntry: { cuttingEntryId, deletedAt: null } },
    _sum: { quantity: true },
  });
  return new Map(sums.map((s) => [cellKey(s.colorId, s.sizeId), s._sum.quantity ?? 0]));
};

// Pieces already delivered per colour + size of a lot, keyed "colorId:sizeId".
export const sumDeliveredByCell = async (db: Prisma.TransactionClient, cuttingEntryId: string, excludeDeliveryId?: string) => {
  const sums = await db.deliveryQuantity.groupBy({
    by: ['colorId', 'sizeId'],
    where: { delivery: { cuttingEntryId, ...(excludeDeliveryId ? { id: { not: excludeDeliveryId } } : {}) } },
    _sum: { quantity: true },
  });
  return new Map(sums.map((s) => [cellKey(s.colorId, s.sizeId), s._sum.quantity ?? 0]));
};

// Production and distribution changes must not leave a lot with more delivered than produced in
// any colour + size. Call inside the changing transaction, after the change, with the lot locked.
export const assertDeliveriesCovered = async (db: Prisma.TransactionClient, cuttingEntryId: string) => {
  const delivered = await sumDeliveredByCell(db, cuttingEntryId);
  if (!delivered.size) return;
  const produced = await sumProducedByCell(db, cuttingEntryId);
  for (const [key, qty] of delivered) {
    if (qty > (produced.get(key) ?? 0)) {
      throw conflict('These pieces are already delivered to the party — delete or reduce the delivery first');
    }
  }
};

// Locks the lot row so deliveries and production / distribution changes of one lot run one at a time.
export const lockCuttingEntry = (db: Prisma.TransactionClient, cuttingEntryId: string) =>
  db.$executeRaw`SELECT 1 FROM "cutting_entries" WHERE "id" = ${cuttingEntryId}::uuid FOR UPDATE`;

// Serializes challan numbering per organization.
export const nextChallanNumber = async (db: Prisma.TransactionClient, organizationId: string) => {
  await db.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('challan:' || ${organizationId}))`;
  const last = await db.delivery.aggregate({ where: { organizationId }, _max: { challanNumber: true } });
  return (last._max.challanNumber ?? 0) + 1;
};

export interface DeliveryCell {
  colorId: string;
  sizeId: string;
  quantity: number;
}

interface DeliveryHeaderData {
  date: Date;
  entryTime?: string | null;
  billNumber?: string | null;
  remarks?: string | null;
}

export const createDelivery = (
  db: Prisma.TransactionClient,
  data: DeliveryHeaderData & { organizationId: string; cuttingEntryId: string; partyId: string; challanNumber: number },
  cells: DeliveryCell[],
  createdById: string | null,
) =>
  db.delivery.create({
    data: {
      ...data,
      totalQuantity: cells.reduce((sum, c) => sum + c.quantity, 0),
      createdById: createdById ?? undefined,
      quantities: { create: cells },
    },
    include: includeRelations,
  });

// Quantities are replaced wholesale, like distributions.
export const updateDelivery = async (
  db: Prisma.TransactionClient,
  id: string,
  header: Partial<DeliveryHeaderData>,
  cells: DeliveryCell[] | undefined,
  updatedById: string | null,
) => {
  if (cells) await db.deliveryQuantity.deleteMany({ where: { deliveryId: id } });
  return db.delivery.update({
    where: { id },
    data: {
      ...header,
      updatedById: updatedById ?? undefined,
      ...(cells ? { totalQuantity: cells.reduce((sum, c) => sum + c.quantity, 0), quantities: { create: cells } } : {}),
    },
    include: includeRelations,
  });
};
