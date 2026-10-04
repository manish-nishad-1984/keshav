import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';

type Db = Prisma.TransactionClient | typeof prisma;

export const listBooks = (organizationId: string) =>
  prisma.book.findMany({
    where: { organizationId },
    orderBy: { name: 'desc' },
    include: { _count: { select: { cuttingEntries: true } } },
  });

export const findBookById = (organizationId: string, id: string) =>
  prisma.book.findFirst({ where: { id, organizationId } });

export const findBookByName = (organizationId: string, name: string) =>
  prisma.book.findFirst({ where: { organizationId, name: { equals: name, mode: 'insensitive' } } });

export const createBook = (
  organizationId: string,
  data: { name: string; startNumber: number; isActive?: boolean },
  createdById: string | null,
) => prisma.book.create({ data: { organizationId, ...data, createdById: createdById ?? undefined } });

export const updateBook = (
  id: string,
  data: Partial<{ name: string; startNumber: number; isActive: boolean }>,
  updatedById: string | null,
) => prisma.book.update({ where: { id }, data: { ...data, updatedById: updatedById ?? undefined } });

// Deliberately counts soft-deleted cutting entries too: they still hold a real FK to the book.
export const countCuttingEntriesInBook = (bookId: string) => prisma.cuttingEntry.count({ where: { bookId } });

export const deleteBook = (id: string) => prisma.book.delete({ where: { id } });

// Highest purely numeric lot number in the book, soft-deleted lots included so a number is never
// handed out twice. Lots carried over from before books existed may be non-numeric; those are
// ignored here (the unique index still guards against collisions).
export const maxNumericLotNumber = async (db: Db, bookId: string): Promise<number | null> => {
  const rows = await db.$queryRaw<{ max: number | null }[]>`
    SELECT MAX(CAST("lotNumber" AS INTEGER)) AS max
    FROM "cutting_entries"
    WHERE "bookId" = ${bookId}::uuid AND "lotNumber" ~ '^[0-9]{1,9}$'
  `;
  return rows[0]?.max ?? null;
};

// Row lock on the book so two cutting entries saved at the same moment can't both be given the
// same next lot number; held until the surrounding transaction ends.
export const lockBook = (db: Prisma.TransactionClient, bookId: string) =>
  db.$queryRaw`SELECT "id" FROM "books" WHERE "id" = ${bookId}::uuid FOR UPDATE`;
