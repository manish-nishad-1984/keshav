import { Prisma } from '@prisma/client';
import { badRequest, conflict, notFound } from '../../lib/httpError';
import { prisma } from '../../lib/prisma';
import { reserveNextLotNumber } from '../books/books.service';
import { getParty } from '../parties/parties.service';
import { assertSizesExist } from '../sizes/sizes.service';
import { getPatternType } from '../pattern-types/pattern-types.service';
import { getItem } from '../items/items.service';
import { getColor } from '../colors/colors.service';
import { countDistributionsForCuttingEntry, sumDistributedByCell } from '../cutting-distribution/cutting-distribution.repository';
import { lockCuttingEntry } from '../deliveries/deliveries.repository';
import { assertLotOpen } from './lot-open';
import * as repo from './cutting.repository';
import type { CuttingRowData } from './cutting.repository';
import type { CreateCuttingEntryInput, ListCuttingEntriesQuery, UpdateCuttingEntryInput } from './cutting.schema';

type RowInput = NonNullable<UpdateCuttingEntryInput['rows']>[number];

// Drops empty cells and derives every total server-side — never trust client-supplied totals.
const buildRows = (rows: RowInput[]): { rows: CuttingRowData[]; totalQuantity: number } => {
  const built = rows.map((row) => {
    const quantities = row.quantities.filter((q) => q.quantity > 0);
    return {
      colorId: row.colorId,
      photoUrl: row.photoUrl ?? null,
      quantities,
      totalQuantity: quantities.reduce((sum, q) => sum + q.quantity, 0),
    };
  });
  return { rows: built, totalQuantity: built.reduce((sum, r) => sum + r.totalQuantity, 0) };
};

// Every colour and size used by the grid must belong to this organization.
const validateRows = async (organizationId: string, rows: RowInput[] | undefined) => {
  if (!rows) return;
  await Promise.all([
    ...[...new Set(rows.map((r) => r.colorId))].map((colorId) => getColor(organizationId, colorId)),
    assertSizesExist(
      organizationId,
      rows.flatMap((r) => r.quantities.map((q) => q.sizeId)),
    ),
  ]);
};

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
  input: { patternTypeId?: string; itemId?: string; partyId?: string; rows?: RowInput[] },
) =>
  Promise.all([
    input.patternTypeId ? getPatternType(organizationId, input.patternTypeId) : Promise.resolve(),
    input.itemId ? getItem(organizationId, input.itemId) : Promise.resolve(),
    input.partyId ? getParty(organizationId, input.partyId) : Promise.resolve(),
    validateRows(organizationId, input.rows),
  ]);

const isUniqueViolation = (err: unknown) => err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';

export const createCuttingEntry = async (
  organizationId: string,
  input: CreateCuttingEntryInput,
  actorId: string | null,
) => {
  await validateReferences(organizationId, input);

  const { rows, totalQuantity } = buildRows(input.rows);
  const { rows: _rows, ...header } = input;
  void _rows;

  // The lot number is assigned here, never by the client: the book row is locked for the length
  // of the transaction so concurrent saves get consecutive numbers.
  try {
    return await prisma.$transaction(async (tx) => {
      const lotNumber = await reserveNextLotNumber(tx, organizationId, input.bookId);
      return repo.createCuttingEntry(tx, organizationId, { ...header, lotNumber }, rows, totalQuantity, actorId);
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
  const existing = await getCuttingEntry(organizationId, id);
  await assertLotOpen(id);
  await validateReferences(organizationId, input);

  const built = input.rows ? buildRows(input.rows) : undefined;
  const { rows: _rows, ...header } = input;
  void _rows;

  // The design can't change once pieces were produced, nor the party once something was delivered.
  if (input.itemId && input.itemId !== existing.itemId && (await prisma.productionEntry.count({ where: { cuttingEntryId: id, deletedAt: null } })) > 0) {
    throw conflict('Production is already entered for this lot — its design can no longer be changed');
  }
  if (input.partyId && input.partyId !== existing.partyId && (await prisma.delivery.count({ where: { cuttingEntryId: id } })) > 0) {
    throw conflict('This lot already has deliveries — its party can no longer be changed');
  }

  // Checked inside the transaction with the lot row locked, so a distribution can't slip in between.
  return repo.updateCuttingEntry(id, header, built?.rows, built?.totalQuantity, actorId, async (tx) => {
    if (built) await assertCoversDistributed(existing.lotNumber, id, built.rows, tx);
  });
};

// An edited grid must still hold every piece already handed to karigars (Cutting Distribution).
const assertCoversDistributed = async (lotNumber: string, id: string, rows: CuttingRowData[], db: Prisma.TransactionClient) => {
  const distributed = await sumDistributedByCell(db, id);
  if (distributed.size === 0) return;

  const cut = new Map<string, number>();
  for (const row of rows) {
    for (const q of row.quantities) {
      const key = `${row.colorId}:${q.sizeId}`;
      cut.set(key, (cut.get(key) ?? 0) + q.quantity);
    }
  }
  const short = [...distributed].filter(([key, given]) => (cut.get(key) ?? 0) < given);
  if (short.length === 0) return;

  const [colorId, sizeId] = short[0][0].split(':');
  const [color, size] = await Promise.all([
    prisma.color.findUnique({ where: { id: colorId }, select: { name: true } }),
    prisma.size.findUnique({ where: { id: sizeId }, select: { name: true } }),
  ]);
  throw conflict(
    `${short[0][1]} ${color?.name ?? ''} / ${size?.name ?? ''} pieces of lot ${lotNumber} are already distributed to karigars — the lot can't have fewer than that`,
  );
};

export const deleteCuttingEntry = async (organizationId: string, id: string, actorId: string | null) => {
  await getCuttingEntry(organizationId, id);
  if ((await countDistributionsForCuttingEntry(id)) > 0) {
    throw conflict('This lot is already distributed to karigars — remove its distributions first, or ask an admin to delete the lot with everything in it');
  }
  const usageCount = await repo.countProductionEntriesForCuttingEntry(id);
  if (usageCount > 0) {
    throw conflict('Daily production entries already reference this lot — remove them before deleting it');
  }
  await repo.softDeleteCuttingEntry(id, actorId);
};

// What deleting the lot would also remove: everything entered against it.
export const getLotDeletionSummary = async (organizationId: string, id: string) => {
  const lot = await getCuttingEntry(organizationId, id);
  const [distributions, production, accessories, deliveries] = await Promise.all([
    prisma.cuttingDistribution.aggregate({ where: { cuttingEntryId: id }, _count: true, _sum: { totalQuantity: true } }),
    prisma.productionEntry.aggregate({ where: { cuttingEntryId: id }, _count: true, _sum: { carrierQuantity: true } }),
    prisma.accessoryTransaction.count({ where: { cuttingEntryId: id } }),
    prisma.delivery.findMany({ where: { cuttingEntryId: id }, select: { challanNumber: true, totalQuantity: true }, orderBy: { challanNumber: 'asc' } }),
  ]);
  return {
    lotNumber: lot.lotNumber,
    totalQuantity: lot.totalQuantity,
    distributions: { count: distributions._count, pieces: distributions._sum.totalQuantity ?? 0 },
    production: { count: production._count, pieces: production._sum.carrierQuantity ?? 0 },
    accessories: { count: accessories },
    deliveries: { count: deliveries.length, pieces: deliveries.reduce((s, d) => s + d.totalQuantity, 0), challans: deliveries.map((d) => d.challanNumber) },
  };
};

// Admin reset: removes the lot and every entry against it (deliveries, production, accessory
// issues/returns, distributions) permanently, so the work can be started again from scratch.
// Payments and press entries are by karigar, not by lot, and are left alone.
export const deleteCuttingEntryWithEverything = async (organizationId: string, id: string) => {
  await getCuttingEntry(organizationId, id);
  const summary = await getLotDeletionSummary(organizationId, id);
  await prisma.$transaction(async (tx) => {
    await lockCuttingEntry(tx, id);
    await tx.delivery.deleteMany({ where: { cuttingEntryId: id } });
    await tx.productionEntry.deleteMany({ where: { cuttingEntryId: id } });
    await tx.accessoryTransaction.deleteMany({ where: { cuttingEntryId: id } });
    await tx.cuttingDistribution.deleteMany({ where: { cuttingEntryId: id } });
    await tx.cuttingEntry.delete({ where: { id } });
  });
  return summary;
};

export const CLOSE_REASONS = ['DAMAGED', 'SHORTAGE', 'RETURNED_BY_PARTY'] as const;

// Closing a lot (admin): freezes it and records why the cut pieces and the delivered pieces differ.
export const closeCuttingEntry = async (
  organizationId: string,
  id: string,
  input: { reason?: (typeof CLOSE_REASONS)[number]; note?: string | null },
  actorId: string | null,
) => {
  const lot = await getCuttingEntry(organizationId, id);
  if (lot.closedAt) throw conflict(`Lot ${lot.lotNumber} is already closed`);
  const delivered = await prisma.delivery.aggregate({ where: { cuttingEntryId: id }, _sum: { totalQuantity: true } });
  const shortage = Math.max(lot.totalQuantity - (delivered._sum.totalQuantity ?? 0), 0);
  if (shortage > 0 && !input.reason) {
    throw badRequest(`${shortage} pieces of lot ${lot.lotNumber} were never delivered — choose why (damaged, shortage or returned by party)`);
  }
  return prisma.cuttingEntry.update({
    where: { id },
    data: {
      closedAt: new Date(),
      closeReason: shortage > 0 ? input.reason : (input.reason ?? null),
      closeNote: input.note?.trim() || null,
      closedShortage: shortage,
      closedById: actorId,
      updatedById: actorId ?? undefined,
    },
  });
};

export const reopenCuttingEntry = async (organizationId: string, id: string, actorId: string | null) => {
  const lot = await getCuttingEntry(organizationId, id);
  if (!lot.closedAt) throw conflict(`Lot ${lot.lotNumber} is not closed`);
  return prisma.cuttingEntry.update({
    where: { id },
    data: { closedAt: null, closeReason: null, closeNote: null, closedShortage: null, closedById: null, updatedById: actorId ?? undefined },
  });
};
