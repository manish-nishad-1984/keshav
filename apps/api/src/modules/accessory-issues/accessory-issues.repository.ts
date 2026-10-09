import { prisma } from '../../lib/prisma';
import type { Prisma } from '@prisma/client';

const includeRelations = {
  karigar: { select: { id: true, code: true, fullName: true } },
  cuttingEntry: { select: { id: true, lotNumber: true, bookId: true, item: { select: { id: true, itemName: true } } } },
  lines: { include: { accessory: true }, orderBy: { accessory: { name: 'asc' } } },
} as const;

export const listTransactions = async (
  organizationId: string,
  page: number,
  pageSize: number,
  filters: { bookId?: string; karigarId?: string; type?: 'ISSUE' | 'RETURN'; search?: string },
) => {
  const where: Prisma.AccessoryTransactionWhereInput = {
    organizationId,
    ...(filters.bookId ? { cuttingEntry: { bookId: filters.bookId } } : {}),
    ...(filters.karigarId ? { karigarId: filters.karigarId } : {}),
    ...(filters.type ? { type: filters.type } : {}),
    ...(filters.search
      ? {
          OR: [
            { cuttingEntry: { lotNumber: { contains: filters.search, mode: 'insensitive' } } },
            { karigar: { fullName: { contains: filters.search, mode: 'insensitive' } } },
            { lines: { some: { accessory: { name: { contains: filters.search, mode: 'insensitive' } } } } },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.accessoryTransaction.findMany({
      where,
      include: includeRelations,
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.accessoryTransaction.count({ where }),
  ]);
  return { items, total };
};

export const findTransactionById = (organizationId: string, id: string) =>
  prisma.accessoryTransaction.findFirst({ where: { id, organizationId }, include: includeRelations });

// Lots of a book the karigar took pieces of (Cutting Distribution), with pieces taken.
export const listKarigarLots = async (organizationId: string, karigarId: string, bookId: string) => {
  const sums = await prisma.cuttingDistribution.groupBy({
    by: ['cuttingEntryId'],
    where: { organizationId, karigarId, cuttingEntry: { bookId, deletedAt: null, closedAt: null } },
    _sum: { totalQuantity: true },
  });
  const lots = await prisma.cuttingEntry.findMany({
    where: { id: { in: sums.map((s) => s.cuttingEntryId) } },
    select: { id: true, lotNumber: true, date: true, item: { select: { id: true, itemName: true } } },
    orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
  });
  const taken = new Map(sums.map((s) => [s.cuttingEntryId, s._sum.totalQuantity ?? 0]));
  return lots.map((lot) => ({ ...lot, piecesTaken: taken.get(lot.id) ?? 0 }));
};

// Serializes issues/returns for one karigar + lot so two saves can't both pass the limit check.
export const lockKarigarLot = (db: Prisma.TransactionClient, karigarId: string, cuttingEntryId: string) =>
  db.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${karigarId} || ':' || ${cuttingEntryId}))`;

export interface TransactionLine {
  accessoryId: string;
  quantity: number;
}

interface TransactionHeader {
  date: Date;
  entryTime?: string | null;
  remarks?: string | null;
}

export const createTransaction = (
  db: Prisma.TransactionClient,
  organizationId: string,
  data: TransactionHeader & { type: 'ISSUE' | 'RETURN'; karigarId: string; cuttingEntryId: string },
  lines: TransactionLine[],
  createdById: string | null,
) =>
  db.accessoryTransaction.create({
    data: { organizationId, ...data, createdById: createdById ?? undefined, lines: { create: lines } },
    include: includeRelations,
  });

export const updateTransaction = async (
  db: Prisma.TransactionClient,
  id: string,
  header: Partial<TransactionHeader>,
  lines: TransactionLine[] | undefined,
  updatedById: string | null,
) => {
  if (lines) await db.accessoryTransactionLine.deleteMany({ where: { transactionId: id } });
  return db.accessoryTransaction.update({
    where: { id },
    data: { ...header, updatedById: updatedById ?? undefined, ...(lines ? { lines: { create: lines } } : {}) },
    include: includeRelations,
  });
};

export const deleteTransaction = (db: Prisma.TransactionClient, id: string) =>
  db.accessoryTransaction.delete({ where: { id } });
