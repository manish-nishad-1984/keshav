import { prisma } from '../../lib/prisma';
import type { Prisma } from '@prisma/client';

const includeRelations = {
  book: { select: { id: true, name: true } },
  party: true,
  patternType: true,
  item: { include: { category: true } },
  color: true,
  lines: { orderBy: { createdAt: 'asc' } },
} as const;

export const listCuttingEntries = async (
  organizationId: string,
  page: number,
  pageSize: number,
  filters: { bookId?: string; search?: string; itemId?: string; dateFrom?: Date; dateTo?: Date },
) => {
  const where: Prisma.CuttingEntryWhereInput = {
    organizationId,
    deletedAt: null,
    ...(filters.bookId ? { bookId: filters.bookId } : {}),
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
            { party: { name: { contains: filters.search, mode: 'insensitive' } } },
            { item: { itemName: { contains: filters.search, mode: 'insensitive' } } },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.cuttingEntry.findMany({
      where,
      include: includeRelations,
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.cuttingEntry.count({ where }),
  ]);

  return { items, total };
};

export const findCuttingEntryById = (organizationId: string, id: string) =>
  prisma.cuttingEntry.findFirst({ where: { id, organizationId, deletedAt: null }, include: includeRelations });

export const findCuttingEntryByLotNumber = (organizationId: string, bookId: string, lotNumber: string) =>
  prisma.cuttingEntry.findFirst({
    where: { organizationId, bookId, lotNumber, deletedAt: null },
    include: includeRelations,
  });

interface CuttingEntryHeaderData {
  bookId: string;
  lotNumber: string;
  date: Date;
  patternTypeId: string;
  isOnline: boolean;
  itemId: string;
  partyId: string;
  pieces: number;
  averageValue: number;
  averageUnit: 'KILOGRAM' | 'METER';
  colorId: string;
}

interface CuttingLineData {
  size: string;
  quantity: number;
  rate: number;
  total: number;
}

export const createCuttingEntry = (
  db: Prisma.TransactionClient,
  organizationId: string,
  header: CuttingEntryHeaderData,
  lines: CuttingLineData[],
  totalAmount: number,
  createdById: string | null,
) =>
  db.cuttingEntry.create({
    data: {
      organizationId,
      ...header,
      totalAmount,
      createdById: createdById ?? undefined,
      lines: { create: lines },
    },
    include: includeRelations,
  });

// Lines are replaced wholesale on update (delete all, recreate) rather than diffed — the UI
// always submits the entry's full current line list, and a cutting lot's line count is small
// enough that this is simpler and safer than trying to match old lines to new ones by identity.
export const updateCuttingEntry = (
  id: string,
  header: Partial<Omit<CuttingEntryHeaderData, 'lotNumber' | 'bookId'>>,
  lines: CuttingLineData[] | undefined,
  totalAmount: number | undefined,
  updatedById: string | null,
) =>
  prisma.$transaction(async (tx) => {
    if (lines) {
      await tx.cuttingEntryLine.deleteMany({ where: { cuttingEntryId: id } });
    }
    return tx.cuttingEntry.update({
      where: { id },
      data: {
        ...header,
        ...(totalAmount !== undefined ? { totalAmount } : {}),
        updatedById: updatedById ?? undefined,
        ...(lines ? { lines: { create: lines } } : {}),
      },
      include: includeRelations,
    });
  });

export const softDeleteCuttingEntry = (id: string, updatedById: string | null) =>
  prisma.cuttingEntry.update({
    where: { id },
    data: { deletedAt: new Date(), updatedById: updatedById ?? undefined },
  });

// Deliberately counts soft-deleted production entries too — same FK-reality reasoning used
// throughout this app (ProductionEntry.cuttingEntryId has no cascade, so a soft-deleted entry
// still holds a real FK, which would fail at the database level if this weren't checked first).
export const countProductionEntriesForCuttingEntry = (cuttingEntryId: string) =>
  prisma.productionEntry.count({ where: { cuttingEntryId } });
