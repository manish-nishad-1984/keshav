import type { Prisma } from '@prisma/client';
import { badRequest, conflict, notFound } from '../../lib/httpError';
import { prisma } from '../../lib/prisma';
import * as repo from './books.repository';
import type { CreateBookInput, UpdateBookInput } from './books.schema';

type Db = Prisma.TransactionClient | typeof prisma;

// Next lot number for a book: one past the highest lot already in it, but never below the
// book's start number (so a client can begin a series at e.g. 101).
const computeNextLotNumber = async (db: Db, book: { id: string; startNumber: number }) => {
  const max = await repo.maxNumericLotNumber(db, book.id);
  return String(Math.max(book.startNumber, (max ?? 0) + 1));
};

export const listBooks = async (organizationId: string) => {
  const books = await repo.listBooks(organizationId);
  return Promise.all(
    books.map(async ({ _count, ...book }) => ({
      ...book,
      lotCount: _count.cuttingEntries,
      nextLotNumber: await computeNextLotNumber(prisma, book),
    })),
  );
};

export const getBook = async (organizationId: string, id: string) => {
  const book = await repo.findBookById(organizationId, id);
  if (!book) throw notFound('Book not found');
  return book;
};

// Preview for the cutting form. The number actually assigned is decided at save time (see
// reserveNextLotNumber), so it can differ if someone else saves a lot in between.
export const getNextLotNumber = async (organizationId: string, id: string) => {
  const book = await getBook(organizationId, id);
  return { nextLotNumber: await computeNextLotNumber(prisma, book) };
};

// Called inside the cutting-entry create transaction: locks the book, then computes the number.
export const reserveNextLotNumber = async (tx: Prisma.TransactionClient, organizationId: string, bookId: string) => {
  const book = await getBook(organizationId, bookId);
  if (!book.isActive) throw badRequest('This book is inactive — select an active book in the header');
  await repo.lockBook(tx, book.id);
  return computeNextLotNumber(tx, book);
};

export const createBook = async (organizationId: string, input: CreateBookInput, actorId: string | null) => {
  if (await repo.findBookByName(organizationId, input.name)) {
    throw conflict('A book with this series name already exists');
  }
  return repo.createBook(organizationId, input, actorId);
};

export const updateBook = async (organizationId: string, id: string, input: UpdateBookInput, actorId: string | null) => {
  await getBook(organizationId, id);
  if (input.name) {
    const existing = await repo.findBookByName(organizationId, input.name);
    if (existing && existing.id !== id) throw conflict('A book with this series name already exists');
  }
  return repo.updateBook(id, input, actorId);
};

export const deleteBook = async (organizationId: string, id: string) => {
  await getBook(organizationId, id);
  if ((await repo.countCuttingEntriesInBook(id)) > 0) {
    throw conflict('This book already has cutting lots — deactivate it instead of deleting');
  }
  await repo.deleteBook(id);
};
