import { prisma } from '../../lib/prisma';
import type { Prisma } from '@prisma/client';

const includeRelations = {
  cuttingEntry: {
    select: {
      id: true,
      lotNumber: true,
      date: true,
      totalQuantity: true,
      bookId: true,
      item: { select: { id: true, itemName: true } },
      party: { select: { id: true, name: true } },
    },
  },
  karigar: { select: { id: true, code: true, fullName: true, workType: { select: { id: true, name: true } } } },
  quantities: { include: { color: true, size: true } },
} as const;

export const listDistributions = async (
  organizationId: string,
  page: number,
  pageSize: number,
  filters: { bookId?: string; cuttingEntryId?: string; karigarId?: string; search?: string },
) => {
  const where: Prisma.CuttingDistributionWhereInput = {
    organizationId,
    cuttingEntry: { deletedAt: null, ...(filters.bookId ? { bookId: filters.bookId } : {}) },
    ...(filters.cuttingEntryId ? { cuttingEntryId: filters.cuttingEntryId } : {}),
    ...(filters.karigarId ? { karigarId: filters.karigarId } : {}),
    ...(filters.search
      ? {
          OR: [
            { cuttingEntry: { lotNumber: { contains: filters.search, mode: 'insensitive' } } },
            { karigar: { fullName: { contains: filters.search, mode: 'insensitive' } } },
            { karigar: { code: { contains: filters.search, mode: 'insensitive' } } },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.cuttingDistribution.findMany({
      where,
      include: includeRelations,
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.cuttingDistribution.count({ where }),
  ]);

  return { items, total };
};

export const findDistributionById = (organizationId: string, id: string) =>
  prisma.cuttingDistribution.findFirst({ where: { id, organizationId }, include: includeRelations });

// Lots of a book with how many of their pieces are already distributed.
export const listLotsWithDistributed = async (organizationId: string, bookId: string) => {
  const lots = await prisma.cuttingEntry.findMany({
    where: { organizationId, bookId, deletedAt: null },
    select: {
      id: true,
      lotNumber: true,
      date: true,
      totalQuantity: true,
      item: { select: { itemName: true } },
      party: { select: { name: true } },
    },
    orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
  });
  const sums = await prisma.cuttingDistribution.groupBy({
    by: ['cuttingEntryId'],
    where: { cuttingEntryId: { in: lots.map((l) => l.id) } },
    _sum: { totalQuantity: true },
  });
  const byLot = new Map(sums.map((s) => [s.cuttingEntryId, s._sum.totalQuantity ?? 0]));
  return lots.map((lot) => ({ ...lot, distributedQuantity: byLot.get(lot.id) ?? 0 }));
};

// Pieces already distributed per colour + size of a lot, keyed "colorId:sizeId".
export const sumDistributedByCell = async (
  db: Prisma.TransactionClient,
  cuttingEntryId: string,
  excludeDistributionId?: string,
) => {
  const sums = await db.cuttingDistributionQuantity.groupBy({
    by: ['colorId', 'sizeId'],
    where: {
      distribution: {
        cuttingEntryId,
        ...(excludeDistributionId ? { id: { not: excludeDistributionId } } : {}),
      },
    },
    _sum: { quantity: true },
  });
  return new Map(sums.map((s) => [`${s.colorId}:${s.sizeId}`, s._sum.quantity ?? 0]));
};

// Locks the lot row for the rest of the transaction so two distributions of the same lot can't
// both take the last pieces.
export const lockCuttingEntry = (db: Prisma.TransactionClient, cuttingEntryId: string) =>
  db.$executeRaw`SELECT 1 FROM "cutting_entries" WHERE "id" = ${cuttingEntryId}::uuid FOR UPDATE`;

export interface DistributionCell {
  colorId: string;
  sizeId: string;
  quantity: number;
}

interface DistributionHeaderData {
  karigarId: string;
  date: Date;
  entryTime?: string | null;
  remarks?: string | null;
}

export const createDistribution = (
  db: Prisma.TransactionClient,
  organizationId: string,
  cuttingEntryId: string,
  header: DistributionHeaderData,
  cells: DistributionCell[],
  createdById: string | null,
) =>
  db.cuttingDistribution.create({
    data: {
      organizationId,
      cuttingEntryId,
      ...header,
      totalQuantity: cells.reduce((sum, c) => sum + c.quantity, 0),
      createdById: createdById ?? undefined,
      quantities: { create: cells },
    },
    include: includeRelations,
  });

// Quantities are replaced wholesale, like cutting rows.
export const updateDistribution = async (
  db: Prisma.TransactionClient,
  id: string,
  header: Partial<DistributionHeaderData>,
  cells: DistributionCell[] | undefined,
  updatedById: string | null,
) => {
  if (cells) await db.cuttingDistributionQuantity.deleteMany({ where: { distributionId: id } });
  return db.cuttingDistribution.update({
    where: { id },
    data: {
      ...header,
      updatedById: updatedById ?? undefined,
      ...(cells
        ? { totalQuantity: cells.reduce((sum, c) => sum + c.quantity, 0), quantities: { create: cells } }
        : {}),
    },
    include: includeRelations,
  });
};


export const countDistributionsForCuttingEntry = (cuttingEntryId: string) =>
  prisma.cuttingDistribution.count({ where: { cuttingEntryId } });
