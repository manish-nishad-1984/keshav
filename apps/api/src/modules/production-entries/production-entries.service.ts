import { badRequest, notFound } from '../../lib/httpError';
import { prisma } from '../../lib/prisma';
import { getKarigar } from '../karigars/karigars.service';
import { getCuttingEntry } from '../cutting/cutting.service';
import { assertDeliveriesCovered, lockCuttingEntry } from '../deliveries/deliveries.repository';
import * as repo from './production-entries.repository';
import type {
  CreateProductionEntryInput,
  ListProductionEntriesQuery,
  UpdateProductionEntryInput,
} from './production-entries.schema';

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

// The stitching karigar hands in the full production of what they took: the quantity is every
// piece of the lot given to them (Cutting Distribution) not yet entered — never typed, never less.
// Overlock and flatlock are done by other karigars on those same pieces.
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

  return prisma.$transaction(async (tx) => {
    await repo.lockKarigarLot(tx, input.carrierId, lot.id);
    const { taken, produced } = await repo.piecesTakenAndProduced(tx, input.carrierId, lot.id);
    if (taken === 0) {
      throw badRequest(`${karigar.fullName} has not taken any pieces of lot ${lot.lotNumber} (Cutting Distribution)`);
    }
    const pending = taken - produced;
    if (pending <= 0) {
      throw badRequest(`All ${taken} pieces of lot ${lot.lotNumber} given to ${karigar.fullName} are already entered`);
    }

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
        carrierQuantity: pending,
        ...rates,
        ...stageTotals(pending, rates),
        photoUrl: input.photoUrl,
        remarks: input.remarks,
      },
      actorId,
    );
  });
};

// Rates, the overlock/flatlock karigars, date/time, photo and remarks can change; the lot,
// stitching karigar and quantity cannot. Totals are recomputed from the result.
export const updateProductionEntry = async (
  organizationId: string,
  id: string,
  input: UpdateProductionEntryInput,
  actorId: string | null,
) => {
  const existing = await getProductionEntry(organizationId, id);

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

  return repo.updateProductionEntry(
    id,
    {
      date: input.date,
      ...(input.entryTime !== undefined ? { entryTime: input.entryTime } : {}),
      ...rates,
      ...stageTotals(existing.carrierQuantity, rates),
      photoUrl: input.photoUrl,
      ...(input.remarks !== undefined ? { remarks: input.remarks } : {}),
    },
    actorId,
  );
};

export const deleteProductionEntry = async (organizationId: string, id: string, actorId: string | null) => {
  const existing = await getProductionEntry(organizationId, id);
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
