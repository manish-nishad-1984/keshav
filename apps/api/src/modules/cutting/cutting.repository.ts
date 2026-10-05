import { prisma } from '../../lib/prisma';
import type { Prisma } from '@prisma/client';

const includeRelations = {
  book: { select: { id: true, name: true } },
  party: true,
  patternType: true,
  item: { include: { category: true } },
  rows: {
    orderBy: { sortOrder: 'asc' },
    include: { color: true, quantities: { include: { size: true } } },
  },
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
            { rows: { some: { color: { name: { contains: filters.search, mode: 'insensitive' } } } } },
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
  entryTime?: string | null;
}

export interface CuttingRowData {
  colorId: string;
  photoUrl: string | null;
  totalQuantity: number;
  quantities: { sizeId: string; quantity: number }[];
}

const rowsCreate = (rows: CuttingRowData[]) => ({
  create: rows.map((row, index) => ({
    colorId: row.colorId,
    photoUrl: row.photoUrl,
    sortOrder: index,
    totalQuantity: row.totalQuantity,
    quantities: { create: row.quantities },
  })),
});

export const createCuttingEntry = (
  db: Prisma.TransactionClient,
  organizationId: string,
  header: CuttingEntryHeaderData,
  rows: CuttingRowData[],
  totalQuantity: number,
  createdById: string | null,
) =>
  db.cuttingEntry.create({
    data: {
      organizationId,
      ...header,
      totalQuantity,
      createdById: createdById ?? undefined,
      rows: rowsCreate(rows),
    },
    include: includeRelations,
  });

// Rows are replaced wholesale on update (delete all, recreate; quantities cascade) rather than
// diffed — the UI always submits the entry's full grid, and a lot has only a few colour rows.
export const updateCuttingEntry = (
  id: string,
  header: Partial<Omit<CuttingEntryHeaderData, 'lotNumber' | 'bookId'>>,
  rows: CuttingRowData[] | undefined,
  totalQuantity: number | undefined,
  updatedById: string | null,
) =>
  prisma.$transaction(async (tx) => {
    if (rows) {
      await tx.cuttingEntryRow.deleteMany({ where: { cuttingEntryId: id } });
    }
    return tx.cuttingEntry.update({
      where: { id },
      data: {
        ...header,
        ...(totalQuantity !== undefined ? { totalQuantity } : {}),
        updatedById: updatedById ?? undefined,
        ...(rows ? { rows: rowsCreate(rows) } : {}),
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
