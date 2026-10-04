import { Prisma } from '@prisma/client';
import { conflict, notFound } from '../../lib/httpError';
import { prisma } from '../../lib/prisma';
import { reserveNextLotNumber } from '../books/books.service';
import { getParty } from '../parties/parties.service';
import { getPatternType } from '../pattern-types/pattern-types.service';
import { getItem } from '../items/items.service';
import { getColor } from '../colors/colors.service';
import * as repo from './cutting.repository';
import type { CreateCuttingEntryInput, ListCuttingEntriesQuery, UpdateCuttingEntryInput } from './cutting.schema';

// Never trust a client-supplied total — always derive it from quantity * rate server-side.
const computeLineTotal = (quantity: number, rate: number) => Math.round(quantity * rate * 100) / 100;
const sumLineTotals = (lines: { total: number }[]) =>
  Math.round(lines.reduce((sum, l) => sum + l.total, 0) * 100) / 100;

export const listCuttingEntries = (organizationId: string, query: ListCuttingEntriesQuery) =>
  repo.listCuttingEntries(organizationId, query.page, query.pageSize, {
    bookId: query.bookId,
    search: query.search,
    itemId: query.itemId,
    dateFrom: query.dateFrom,
    dateTo: query.dateTo,
  });

export const getCuttingEntry = async (organizationId: string, id: string) => {
  const entry = await repo.findCuttingEntryById(organizationId, id);
  if (!entry) throw notFound('Cutting entry not found');
  return entry;
};

// Used by production-entries.service to resolve a typed-in lot number (within the selected book)
// to its cutting entry.
export const getCuttingEntryByLotNumber = async (organizationId: string, bookId: string, lotNumber: string) => {
  const entry = await repo.findCuttingEntryByLotNumber(organizationId, bookId, lotNumber.trim());
  if (!entry) throw notFound('No cutting entry found for this lot number in the selected book');
  return entry;
};

const validateReferences = (
  organizationId: string,
  input: { patternTypeId?: string; itemId?: string; colorId?: string; partyId?: string },
) =>
  Promise.all([
    input.patternTypeId ? getPatternType(organizationId, input.patternTypeId) : Promise.resolve(),
    input.itemId ? getItem(organizationId, input.itemId) : Promise.resolve(),
    input.colorId ? getColor(organizationId, input.colorId) : Promise.resolve(),
    input.partyId ? getParty(organizationId, input.partyId) : Promise.resolve(),
  ]);

const isUniqueViolation = (err: unknown) => err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';

export const createCuttingEntry = async (
  organizationId: string,
  input: CreateCuttingEntryInput,
  actorId: string | null,
) => {
  await validateReferences(organizationId, input);

  const lines = input.lines.map((l) => ({ ...l, total: computeLineTotal(l.quantity, l.rate) }));
  const { lines: _lines, ...header } = input;
  void _lines;

  // The lot number is assigned here, never by the client: the book row is locked for the length
  // of the transaction so concurrent saves get consecutive numbers.
  try {
    return await prisma.$transaction(async (tx) => {
      const lotNumber = await reserveNextLotNumber(tx, organizationId, input.bookId);
      return repo.createCuttingEntry(tx, organizationId, { ...header, lotNumber }, lines, sumLineTotals(lines), actorId);
    });
  } catch (err) {
    // Only reachable if a non-numeric carried-over lot happens to equal the generated number.
    if (isUniqueViolation(err)) throw conflict('That lot number is already taken in this book — please save again');
    throw err;
  }
};

export const updateCuttingEntry = async (
  organizationId: string,
  id: string,
  input: UpdateCuttingEntryInput,
  actorId: string | null,
) => {
  await getCuttingEntry(organizationId, id);
  await validateReferences(organizationId, input);

  const lines = input.lines?.map((l) => ({ ...l, total: computeLineTotal(l.quantity, l.rate) }));
  const { lines: _lines, ...header } = input;
  void _lines;

  return repo.updateCuttingEntry(id, header, lines, lines ? sumLineTotals(lines) : undefined, actorId);
};

export const deleteCuttingEntry = async (organizationId: string, id: string, actorId: string | null) => {
  await getCuttingEntry(organizationId, id);
  const usageCount = await repo.countProductionEntriesForCuttingEntry(id);
  if (usageCount > 0) {
    throw conflict('Daily production entries already reference this lot — remove them before deleting it');
  }
  await repo.softDeleteCuttingEntry(id, actorId);
};
