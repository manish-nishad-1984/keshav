import type { Prisma } from '@prisma/client';
import { badRequest, conflict, notFound } from '../../lib/httpError';
import { prisma } from '../../lib/prisma';
import { getCuttingEntry } from '../cutting/cutting.service';
import { getKarigar } from '../karigars/karigars.service';
import { piecesTakenAndProduced } from '../production-entries/production-entries.repository';
import { assertDeliveriesCovered } from '../deliveries/deliveries.repository';
import * as repo from './cutting-distribution.repository';
import type { DistributionCell } from './cutting-distribution.repository';
import type {
  CreateDistributionInput,
  ListDistributionsQuery,
  UpdateDistributionInput,
} from './cutting-distribution.schema';

type CuttingEntryWithRows = Awaited<ReturnType<typeof getCuttingEntry>>;

const cellKey = (colorId: string, sizeId: string) => `${colorId}:${sizeId}`;

// The lot's cut pieces per colour + size, plus the colours (in row order, a colour listed twice
// merged into one) and the sizes that have any pieces (in Size Master order).
export const describeLot = (entry: CuttingEntryWithRows) => {
  const cut = new Map<string, number>();
  const colors = new Map<string, { colorId: string; name: string; photoUrl: string | null }>();
  const sizes = new Map<string, { id: string; name: string; detail: string | null; sortOrder: number }>();

  for (const row of entry.rows) {
    if (!colors.has(row.colorId)) colors.set(row.colorId, { colorId: row.colorId, name: row.color.name, photoUrl: row.photoUrl });
    else if (!colors.get(row.colorId)!.photoUrl && row.photoUrl) colors.get(row.colorId)!.photoUrl = row.photoUrl;
    for (const q of row.quantities) {
      const key = cellKey(row.colorId, q.sizeId);
      cut.set(key, (cut.get(key) ?? 0) + q.quantity);
      sizes.set(q.sizeId, { id: q.size.id, name: q.size.name, detail: q.size.detail, sortOrder: q.size.sortOrder });
    }
  }

  return {
    cut,
    colors: [...colors.values()],
    sizes: [...sizes.values()].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)),
  };
};

export const listDistributions = (organizationId: string, query: ListDistributionsQuery) =>
  repo.listDistributions(organizationId, query.page, query.pageSize, {
    bookId: query.bookId,
    cuttingEntryId: query.cuttingEntryId,
    karigarId: query.karigarId,
    search: query.search,
  });

export const listLots = (organizationId: string, bookId: string) => repo.listLotsWithDistributed(organizationId, bookId);

export const getDistribution = async (organizationId: string, id: string) => {
  const distribution = await repo.findDistributionById(organizationId, id);
  if (!distribution) throw notFound('Distribution not found');
  return distribution;
};

// The grid for the form: every colour × size of the lot with what was cut, what earlier
// distributions took, and what is left.
export const getAvailability = async (organizationId: string, cuttingEntryId: string, excludeId?: string) => {
  const entry = await getCuttingEntry(organizationId, cuttingEntryId);
  const { cut, colors, sizes } = describeLot(entry);
  const distributed = await repo.sumDistributedByCell(prisma, cuttingEntryId, excludeId);

  return {
    cuttingEntry: {
      id: entry.id,
      lotNumber: entry.lotNumber,
      date: entry.date,
      totalQuantity: entry.totalQuantity,
      item: { id: entry.item.id, itemName: entry.item.itemName },
      party: { id: entry.party.id, name: entry.party.name },
    },
    sizes: sizes.map(({ id, name, detail }) => ({ id, name, detail })),
    colors: colors.map((color) => ({
      ...color,
      cells: sizes.map((size) => {
        const key = cellKey(color.colorId, size.id);
        const cutQty = cut.get(key) ?? 0;
        const given = distributed.get(key) ?? 0;
        return { sizeId: size.id, cut: cutQty, distributed: given, remaining: Math.max(cutQty - given, 0) };
      }),
    })),
  };
};

// Drops empty cells and checks every remaining one against what the lot still has left.
const checkCells = async (
  db: Parameters<typeof repo.sumDistributedByCell>[0],
  entry: CuttingEntryWithRows,
  input: DistributionCell[],
  excludeId?: string,
): Promise<DistributionCell[]> => {
  const cells = input.filter((c) => c.quantity > 0);
  const { cut, colors, sizes } = describeLot(entry);
  const distributed = await repo.sumDistributedByCell(db, entry.id, excludeId);
  const colorName = (id: string) => colors.find((c) => c.colorId === id)?.name ?? 'this colour';
  const sizeName = (id: string) => sizes.find((s) => s.id === id)?.name ?? 'this size';

  for (const cell of cells) {
    const key = cellKey(cell.colorId, cell.sizeId);
    const remaining = (cut.get(key) ?? 0) - (distributed.get(key) ?? 0);
    if (!cut.has(key)) {
      throw badRequest(`Lot ${entry.lotNumber} has no ${colorName(cell.colorId)} pieces in size ${sizeName(cell.sizeId)}`);
    }
    if (cell.quantity > remaining) {
      throw badRequest(
        `Only ${Math.max(remaining, 0)} ${colorName(cell.colorId)} / ${sizeName(cell.sizeId)} pieces are left in lot ${entry.lotNumber}`,
      );
    }
  }
  return cells;
};

export const createDistribution = async (
  organizationId: string,
  input: CreateDistributionInput,
  actorId: string | null,
) => {
  await getKarigar(organizationId, input.karigarId);
  const { cuttingEntryId, quantities, ...header } = input;

  return prisma.$transaction(async (tx) => {
    await repo.lockCuttingEntry(tx, cuttingEntryId);
    const entry = await getCuttingEntry(organizationId, cuttingEntryId);
    const cells = await checkCells(tx, entry, quantities);
    return repo.createDistribution(tx, organizationId, cuttingEntryId, header, cells, actorId);
  });
};

// A karigar's distributions of a lot must still cover the pieces they already handed in as
// production (Daily Production Entry). Checked after the change, inside the same transaction.
const assertCoversProduction = async (tx: Prisma.TransactionClient, karigarId: string, cuttingEntryId: string) => {
  const { taken, produced } = await piecesTakenAndProduced(tx, karigarId, cuttingEntryId);
  if (taken < produced) {
    const karigar = await tx.karigar.findUnique({ where: { id: karigarId }, select: { fullName: true } });
    throw conflict(
      `${karigar?.fullName ?? 'This karigar'} already handed in ${produced} pieces of this lot as production — the distribution can't go below that`,
    );
  }
};

export const updateDistribution = async (
  organizationId: string,
  id: string,
  input: UpdateDistributionInput,
  actorId: string | null,
) => {
  const existing = await getDistribution(organizationId, id);
  if (input.karigarId) await getKarigar(organizationId, input.karigarId);
  const { quantities, ...header } = input;

  return prisma.$transaction(async (tx) => {
    await repo.lockCuttingEntry(tx, existing.cuttingEntryId);
    let cells: DistributionCell[] | undefined;
    if (quantities) {
      const entry = await getCuttingEntry(organizationId, existing.cuttingEntryId);
      cells = await checkCells(tx, entry, quantities, id);
    }
    const updated = await repo.updateDistribution(tx, id, header, cells, actorId);
    await assertCoversProduction(tx, existing.karigarId, existing.cuttingEntryId);
    await assertDeliveriesCovered(tx, existing.cuttingEntryId);
    return updated;
  });
};

export const deleteDistribution = async (organizationId: string, id: string) => {
  const existing = await getDistribution(organizationId, id);
  await prisma.$transaction(async (tx) => {
    await repo.lockCuttingEntry(tx, existing.cuttingEntryId);
    await tx.cuttingDistribution.delete({ where: { id } });
    await assertCoversProduction(tx, existing.karigarId, existing.cuttingEntryId);
    await assertDeliveriesCovered(tx, existing.cuttingEntryId);
  });
};
