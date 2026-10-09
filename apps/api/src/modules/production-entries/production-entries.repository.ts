import { prisma } from '../../lib/prisma';
import type { Prisma } from '@prisma/client';

const includeRelations = {
  carrier: true,
  overlockCarrier: true,
  flatlockKarigar: true,
  workType: true,
  item: { include: { category: true } },
  cuttingEntry: true,
  quantities: { include: { color: true, size: true } },
} as const;

export const listProductionEntries = async (
  organizationId: string,
  page: number,
  pageSize: number,
  filters: { search?: string; carrierId?: string; itemId?: string; dateFrom?: Date; dateTo?: Date },
) => {
  const where: Prisma.ProductionEntryWhereInput = {
    organizationId,
    deletedAt: null,
    ...(filters.carrierId ? { carrierId: filters.carrierId } : {}),
    ...(filters.itemId ? { itemId: filters.itemId } : {}),
    ...(filters.dateFrom || filters.dateTo
      ? {
          date: {
            ...(filters.dateFrom ? { gte: filters.dateFrom } : {}),
            ...(filters.dateTo ? { lte: filters.dateTo } : {}),
          },
        }
      : {}),
    ...(filters.search
      ? {
          OR: [
            { lotNumber: { contains: filters.search, mode: 'insensitive' } },
            { carrier: { fullName: { contains: filters.search, mode: 'insensitive' } } },
            { item: { itemName: { contains: filters.search, mode: 'insensitive' } } },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.productionEntry.findMany({
      where,
      include: includeRelations,
      orderBy: { date: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.productionEntry.count({ where }),
  ]);

  return { items, total };
};

export const findProductionEntryById = (organizationId: string, id: string) =>
  prisma.productionEntry.findFirst({ where: { id, organizationId, deletedAt: null }, include: includeRelations });

interface ProductionEntryData {
  date: Date;
  entryTime?: string | null;
  cuttingEntryId?: string;
  lotNumber?: string;
  designNumber?: string;
  workTypeId: string;
  itemId: string;
  carrierId: string;
  carrierQuantity: number;
  carrierRate: number | null;
  carrierTotal: number;
  overlockCarrierId?: string | null;
  overlockRate?: number | null;
  overlockTotal?: number | null;
  flatlockKarigarId?: string | null;
  flatlockRate?: number | null;
  flatlockTotal?: number | null;
  photoUrl?: string | null;
  remarks?: string | null;
}

export interface ProductionCell {
  colorId: string;
  sizeId: string;
  quantity: number;
}

export const createProductionEntry = (
  db: Prisma.TransactionClient,
  organizationId: string,
  data: ProductionEntryData,
  cells: ProductionCell[],
  createdById: string | null,
) =>
  db.productionEntry.create({
    data: { organizationId, ...data, createdById: createdById ?? undefined, quantities: { create: cells } },
    include: includeRelations,
  });

// Quantities, when given, are replaced wholesale (like distributions).
export const updateProductionEntry = (
  db: Prisma.TransactionClient,
  id: string,
  data: Partial<Omit<ProductionEntryData, 'cuttingEntryId' | 'lotNumber'>>,
  cells: ProductionCell[] | undefined,
  updatedById: string | null,
) =>
  db.productionEntry.update({
    where: { id },
    data: {
      ...data,
      updatedById: updatedById ?? undefined,
      ...(cells ? { quantities: { deleteMany: {}, create: cells } } : {}),
    },
    include: includeRelations,
  });

export const softDeleteProductionEntry = (id: string, updatedById: string | null) =>
  prisma.productionEntry.update({
    where: { id },
    data: { deletedAt: new Date(), updatedById: updatedById ?? undefined },
  });

// Pieces of a lot given to a karigar (Cutting Distribution) and already entered as produced by them.
export const piecesTakenAndProduced = async (db: Prisma.TransactionClient, karigarId: string, cuttingEntryId: string) => {
  const [taken, produced] = await Promise.all([
    db.cuttingDistribution.aggregate({ where: { karigarId, cuttingEntryId }, _sum: { totalQuantity: true } }),
    db.productionEntry.aggregate({
      where: { carrierId: karigarId, cuttingEntryId, deletedAt: null },
      _sum: { carrierQuantity: true },
    }),
  ]);
  return { taken: taken._sum.totalQuantity ?? 0, produced: produced._sum.carrierQuantity ?? 0 };
};

const cellKey = (colorId: string, sizeId: string) => `${colorId}:${sizeId}`;

// Pieces of a lot given to a karigar per colour + size, keyed "colorId:sizeId" (Cutting Distribution).
export const sumGivenByCell = async (db: Prisma.TransactionClient, karigarId: string, cuttingEntryId: string) => {
  const sums = await db.cuttingDistributionQuantity.groupBy({
    by: ['colorId', 'sizeId'],
    where: { distribution: { karigarId, cuttingEntryId } },
    _sum: { quantity: true },
  });
  return new Map(sums.map((s) => [cellKey(s.colorId, s.sizeId), s._sum.quantity ?? 0]));
};

// Pieces a karigar already handed in for a lot per colour + size; `excludeId` leaves out the entry being edited.
export const sumHandedInByCell = async (
  db: Prisma.TransactionClient,
  karigarId: string,
  cuttingEntryId: string,
  excludeId?: string,
) => {
  const sums = await db.productionEntryQuantity.groupBy({
    by: ['colorId', 'sizeId'],
    where: {
      productionEntry: { carrierId: karigarId, cuttingEntryId, deletedAt: null, ...(excludeId ? { id: { not: excludeId } } : {}) },
    },
    _sum: { quantity: true },
  });
  return new Map(sums.map((s) => [cellKey(s.colorId, s.sizeId), s._sum.quantity ?? 0]));
};

// A karigar's distributions must cover, in every colour + size, what they handed in as production.
export const findUncoveredProduction = async (db: Prisma.TransactionClient, karigarId: string, cuttingEntryId: string) => {
  const [given, handedIn] = await Promise.all([
    sumGivenByCell(db, karigarId, cuttingEntryId),
    sumHandedInByCell(db, karigarId, cuttingEntryId),
  ]);
  for (const [key, qty] of handedIn) if (qty > (given.get(key) ?? 0)) return true;
  return false;
};

// Serializes entries for one karigar + lot so two saves can't both take the same pending pieces.
export const lockKarigarLot = (db: Prisma.TransactionClient, karigarId: string, cuttingEntryId: string) =>
  db.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('production:' || ${karigarId} || ':' || ${cuttingEntryId}))`;

// Lots of a book the karigar took, with what the form shows read-only (design, party, mode, photos)
// and how many pieces are still to be entered.
export const listKarigarLots = async (organizationId: string, karigarId: string, bookId: string) => {
  const taken = await prisma.cuttingDistribution.groupBy({
    by: ['cuttingEntryId'],
    where: { organizationId, karigarId, cuttingEntry: { bookId, deletedAt: null } },
    _sum: { totalQuantity: true },
  });
  const lotIds = taken.map((t) => t.cuttingEntryId);
  const [lots, produced] = await Promise.all([
    prisma.cuttingEntry.findMany({
      where: { id: { in: lotIds } },
      select: {
        id: true,
        lotNumber: true,
        date: true,
        isOnline: true,
        item: { select: { id: true, itemName: true, photoUrl: true } },
        party: { select: { id: true, name: true } },
        rows: { select: { photoUrl: true }, where: { photoUrl: { not: null } }, orderBy: { sortOrder: 'asc' }, take: 1 },
      },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    }),
    prisma.productionEntry.groupBy({
      by: ['cuttingEntryId'],
      where: { carrierId: karigarId, cuttingEntryId: { in: lotIds }, deletedAt: null },
      _sum: { carrierQuantity: true },
    }),
  ]);
  const takenBy = new Map(taken.map((t) => [t.cuttingEntryId, t._sum.totalQuantity ?? 0]));
  const producedBy = new Map(produced.map((p) => [p.cuttingEntryId!, p._sum.carrierQuantity ?? 0]));
  return lots.map(({ rows, ...lot }) => {
    const piecesTaken = takenBy.get(lot.id) ?? 0;
    const piecesProduced = producedBy.get(lot.id) ?? 0;
    return {
      ...lot,
      // The cloth photo from cutting, else the design's photo — for the side-by-side compare.
      lotPhotoUrl: rows[0]?.photoUrl ?? lot.item.photoUrl,
      piecesTaken,
      piecesProduced,
      piecesPending: Math.max(piecesTaken - piecesProduced, 0),
    };
  });
};
