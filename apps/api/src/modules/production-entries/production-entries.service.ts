import { badRequest, conflict, notFound } from '../../lib/httpError';
import { prisma } from '../../lib/prisma';
import { getKarigar } from '../karigars/karigars.service';
import { getCuttingEntry } from '../cutting/cutting.service';
import { assertLotOpen } from '../cutting/lot-open';
import { describeLot } from '../cutting-distribution/cutting-distribution.service';
import { assertDeliveriesCovered, lockCuttingEntry } from '../deliveries/deliveries.repository';
import * as repo from './production-entries.repository';
import type { ProductionCell } from './production-entries.repository';
import type {
  CreateProductionEntryInput,
  ListProductionEntriesQuery,
  UpdateProductionEntryInput,
} from './production-entries.schema';

type CuttingEntryWithRows = Awaited<ReturnType<typeof getCuttingEntry>>;

const cellKey = (colorId: string, sizeId: string) => `${colorId}:${sizeId}`;
const sumCells = (cells: ProductionCell[]) => cells.reduce((sum, c) => sum + c.quantity, 0);

// Never trust a client-supplied total — always derive it from quantity * rate server-side.
const computeTotal = (quantity: number, rate: number) => Math.round(quantity * rate * 100) / 100;

export const listProductionEntries = (organizationId: string, query: ListProductionEntriesQuery) =>
  repo.listProductionEntries(organizationId, query.page, query.pageSize, {
    search: query.search,
    carrierId: query.carrierId,
    itemId: query.itemId,
    dateFrom: query.dateFrom,
    dateTo: query.dateTo,
  });

export const getProductionEntry = async (organizationId: string, id: string) => {
  const entry = await repo.findProductionEntryById(organizationId, id);
  if (!entry) throw notFound('Production entry not found');
  return entry;
};

// Lots the karigar took (Cutting Distribution) in a book, with pieces still to be entered.
export const listKarigarLots = async (organizationId: string, karigarId: string, bookId: string) => {
  await getKarigar(organizationId, karigarId);
  return repo.listKarigarLots(organizationId, karigarId, bookId);
};

// The grid for the form: the colour × size cells the karigar took, what they already handed in
// (other entries) and what is still with them.
export const getAvailability = async (organizationId: string, karigarId: string, cuttingEntryId: string, excludeId?: string) => {
  const [entry, karigar] = await Promise.all([getCuttingEntry(organizationId, cuttingEntryId), getKarigar(organizationId, karigarId)]);
  const { colors, sizes } = describeLot(entry);
  const [given, handedIn] = await Promise.all([
    repo.sumGivenByCell(prisma, karigarId, cuttingEntryId),
    repo.sumHandedInByCell(prisma, karigarId, cuttingEntryId, excludeId),
  ]);

  return {
    cuttingEntry: {
      id: entry.id,
      lotNumber: entry.lotNumber,
      isOnline: entry.isOnline,
      item: { id: entry.item.id, itemName: entry.item.itemName },
      party: { id: entry.party.id, name: entry.party.name },
    },
    karigar: { id: karigar.id, fullName: karigar.fullName },
    sizes: sizes.map(({ id, name, detail }) => ({ id, name, detail })),
    colors: colors.map((color) => ({
      ...color,
      cells: sizes.map((size) => {
        const key = cellKey(color.colorId, size.id);
        const took = given.get(key) ?? 0;
        const done = handedIn.get(key) ?? 0;
        return { sizeId: size.id, given: took, handedIn: done, remaining: Math.max(took - done, 0) };
      }),
    })),
  };
};

// Drops empty cells and checks the rest against what the karigar took and has not yet handed in.
const checkCells = async (
  db: Parameters<typeof repo.sumGivenByCell>[0],
  entry: CuttingEntryWithRows,
  karigarId: string,
  input: ProductionCell[],
  excludeId?: string,
): Promise<ProductionCell[]> => {
  const cells = input.filter((c) => c.quantity > 0);
  const { colors, sizes } = describeLot(entry);
  const [given, handedIn] = await Promise.all([
    repo.sumGivenByCell(db, karigarId, entry.id),
    repo.sumHandedInByCell(db, karigarId, entry.id, excludeId),
  ]);
  const colorName = (id: string) => colors.find((c) => c.colorId === id)?.name ?? 'this colour';
  const sizeName = (id: string) => sizes.find((s) => s.id === id)?.name ?? 'this size';

  for (const cell of cells) {
    const key = cellKey(cell.colorId, cell.sizeId);
    const remaining = (given.get(key) ?? 0) - (handedIn.get(key) ?? 0);
    if (cell.quantity > remaining) {
      throw badRequest(
        `Only ${Math.max(remaining, 0)} ${colorName(cell.colorId)} / ${sizeName(cell.sizeId)} pieces of lot ${entry.lotNumber} are left with this karigar`,
      );
    }
  }
  return cells;
};

// Changing wages after the karigar was paid moves what they are owed, so the user has to confirm it.
// "Paid after" = a payment recorded later than the entry itself, to any karigar on the entry.
const assertPaidChangeConfirmed = async (
  entry: { createdAt: Date; carrierId: string; overlockCarrierId: string | null; flatlockKarigarId: string | null },
  extraKarigarIds: (string | null | undefined)[],
  confirmed: boolean | undefined,
) => {
  if (confirmed) return;
  const ids = [entry.carrierId, entry.overlockCarrierId, entry.flatlockKarigarId, ...extraKarigarIds].filter((id): id is string => Boolean(id));
  const paid = await prisma.payment.findMany({
    where: { karigarId: { in: ids }, deletedAt: null, createdAt: { gt: entry.createdAt } },
    select: { karigar: { select: { fullName: true } } },
    distinct: ['karigarId'],
  });
  if (paid.length) {
    throw conflict(
      `${paid.map((p) => p.karigar.fullName).join(', ')} was paid after this entry was made. Changing it will change what they are owed. Do you want to continue?`,
      'PAID_CHANGE',
    );
  }
};

// Each stage's total is its rate × the entry's quantity; an empty rate (to be filled in later)
// leaves the stitching total at 0 and the overlock/flatlock totals empty.
const stageTotals = (
  quantity: number,
  rates: { carrierRate: number | null; overlockCarrierId: string | null; overlockRate: number | null; flatlockKarigarId: string | null; flatlockRate: number | null },
) => ({
  carrierTotal: rates.carrierRate ? computeTotal(quantity, rates.carrierRate) : 0,
  overlockTotal: rates.overlockCarrierId && rates.overlockRate ? computeTotal(quantity, rates.overlockRate) : null,
  flatlockTotal: rates.flatlockKarigarId && rates.flatlockRate ? computeTotal(quantity, rates.flatlockRate) : null,
});

// The stitching karigar hands in pieces of the lot they took (Cutting Distribution), per colour and
// size — all of it or part. Overlock and flatlock are done by other karigars on those same pieces.
export const createProductionEntry = async (
  organizationId: string,
  input: CreateProductionEntryInput,
  actorId: string | null,
) => {
  const [lot, karigar] = await Promise.all([
    getCuttingEntry(organizationId, input.cuttingEntryId),
    getKarigar(organizationId, input.carrierId),
    input.overlockCarrierId ? getKarigar(organizationId, input.overlockCarrierId) : Promise.resolve(),
    input.flatlockKarigarId ? getKarigar(organizationId, input.flatlockKarigarId) : Promise.resolve(),
  ]);

  const rates = {
    carrierRate: input.carrierRate ?? null,
    overlockCarrierId: input.overlockCarrierId ?? null,
    overlockRate: input.overlockCarrierId ? (input.overlockRate ?? null) : null,
    flatlockKarigarId: input.flatlockKarigarId ?? null,
    flatlockRate: input.flatlockKarigarId ? (input.flatlockRate ?? null) : null,
  };

  await assertLotOpen(lot.id);

  return prisma.$transaction(async (tx) => {
    await lockCuttingEntry(tx, lot.id);
    await repo.lockKarigarLot(tx, input.carrierId, lot.id);
    const { taken } = await repo.piecesTakenAndProduced(tx, input.carrierId, lot.id);
    if (taken === 0) {
      throw badRequest(`${karigar.fullName} has not taken any pieces of lot ${lot.lotNumber} (Cutting Distribution)`);
    }
    const cells = await checkCells(tx, lot, input.carrierId, input.quantities);
    const quantity = sumCells(cells);

    return repo.createProductionEntry(
      tx,
      organizationId,
      {
        date: input.date,
        entryTime: input.entryTime ?? null,
        cuttingEntryId: lot.id,
        lotNumber: lot.lotNumber,
        workTypeId: karigar.workTypeId,
        itemId: lot.itemId,
        carrierId: input.carrierId,
        carrierQuantity: quantity,
        ...rates,
        ...stageTotals(quantity, rates),
        photoUrl: input.photoUrl,
        remarks: input.remarks,
      },
      cells,
      actorId,
    );
  });
};

// The grid, rates, the overlock/flatlock karigars, date/time, photo and remarks can change; the lot
// and stitching karigar cannot. Totals are recomputed from the result.
export const updateProductionEntry = async (
  organizationId: string,
  id: string,
  input: UpdateProductionEntryInput,
  actorId: string | null,
) => {
  const existing = await getProductionEntry(organizationId, id);
  await assertLotOpen(existing.cuttingEntryId);
  // Only a real change to pieces, rates or the finishing karigars counts (not date, photo or remarks).
  const num = (v: unknown) => Number(v ?? 0);
  const gridKey = (cells: { colorId: string; sizeId: string; quantity: number }[]) =>
    cells.filter((c) => c.quantity > 0).map((c) => `${c.colorId}:${c.sizeId}=${c.quantity}`).sort().join('|');
  const changesWages =
    (input.quantities !== undefined && gridKey(input.quantities) !== gridKey(existing.quantities)) ||
    (input.carrierRate !== undefined && num(input.carrierRate) !== num(existing.carrierRate)) ||
    (input.overlockRate !== undefined && num(input.overlockRate) !== num(existing.overlockRate)) ||
    (input.flatlockRate !== undefined && num(input.flatlockRate) !== num(existing.flatlockRate)) ||
    (input.overlockCarrierId !== undefined && (input.overlockCarrierId ?? null) !== existing.overlockCarrierId) ||
    (input.flatlockKarigarId !== undefined && (input.flatlockKarigarId ?? null) !== existing.flatlockKarigarId);
  if (changesWages) await assertPaidChangeConfirmed(existing, [input.overlockCarrierId, input.flatlockKarigarId], input.confirmed);

  await Promise.all([
    input.overlockCarrierId ? getKarigar(organizationId, input.overlockCarrierId) : Promise.resolve(),
    input.flatlockKarigarId ? getKarigar(organizationId, input.flatlockKarigarId) : Promise.resolve(),
  ]);

  const pick = <T,>(next: T | null | undefined, current: T | null) => (next === undefined ? current : next);
  const toNumber = (v: unknown) => (v === null || v === undefined ? null : Number(v));

  const overlockCarrierId = pick(input.overlockCarrierId, existing.overlockCarrierId);
  const flatlockKarigarId = pick(input.flatlockKarigarId, existing.flatlockKarigarId);
  const rates = {
    carrierRate: pick(input.carrierRate, toNumber(existing.carrierRate)),
    overlockCarrierId,
    overlockRate: overlockCarrierId ? pick(input.overlockRate, toNumber(existing.overlockRate)) : null,
    flatlockKarigarId,
    flatlockRate: flatlockKarigarId ? pick(input.flatlockRate, toNumber(existing.flatlockRate)) : null,
  };

  const data = (quantity: number) => ({
    date: input.date,
    ...(input.entryTime !== undefined ? { entryTime: input.entryTime } : {}),
    ...rates,
    carrierQuantity: quantity,
    ...stageTotals(quantity, rates),
    photoUrl: input.photoUrl,
    ...(input.remarks !== undefined ? { remarks: input.remarks } : {}),
  });

  const { cuttingEntryId } = existing;
  const quantities = input.quantities;
  if (!quantities || !cuttingEntryId) {
    return prisma.$transaction((tx) =>
      repo.updateProductionEntry(tx, id, data(existing.carrierQuantity), undefined, actorId),
    );
  }

  return prisma.$transaction(async (tx) => {
    await lockCuttingEntry(tx, cuttingEntryId);
    await repo.lockKarigarLot(tx, existing.carrierId, cuttingEntryId);
    const lot = await getCuttingEntry(organizationId, cuttingEntryId);
    const cells = await checkCells(tx, lot, existing.carrierId, quantities, id);
    const updated = await repo.updateProductionEntry(tx, id, data(sumCells(cells)), cells, actorId);
    // Fewer pieces than were already delivered to the party isn't allowed.
    await assertDeliveriesCovered(tx, cuttingEntryId);
    return updated;
  });
};

export const deleteProductionEntry = async (organizationId: string, id: string, actorId: string | null, confirmed?: boolean) => {
  const existing = await getProductionEntry(organizationId, id);
  await assertLotOpen(existing.cuttingEntryId);
  await assertPaidChangeConfirmed(existing, [], confirmed);
  const { cuttingEntryId } = existing;
  if (!cuttingEntryId) {
    await repo.softDeleteProductionEntry(id, actorId);
    return;
  }
  // Pieces already delivered to the party can't stop being produced.
  await prisma.$transaction(async (tx) => {
    await lockCuttingEntry(tx, cuttingEntryId);
    await tx.productionEntry.update({ where: { id }, data: { deletedAt: new Date(), updatedById: actorId ?? undefined } });
    await assertDeliveriesCovered(tx, cuttingEntryId);
  });
};
