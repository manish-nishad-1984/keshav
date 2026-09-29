import { badRequest, notFound } from '../../lib/httpError';
import { getKarigar } from '../karigars/karigars.service';
import { getWorkType } from '../work-types/work-types.service';
import { getItem } from '../items/items.service';
import { getCuttingEntryByLotNumber } from '../cutting/cutting.service';
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

export const createProductionEntry = async (
  organizationId: string,
  input: CreateProductionEntryInput,
  actorId: string | null,
) => {
  // A lot number, when given, is authoritative for which item this entry is against — the
  // matched cutting entry's item is used regardless of whatever itemId the client also sent.
  let cuttingEntryId: string | undefined;
  let itemId = input.itemId;
  if (input.lotNumber) {
    const cuttingEntry = await getCuttingEntryByLotNumber(organizationId, input.lotNumber);
    cuttingEntryId = cuttingEntry.id;
    itemId = cuttingEntry.itemId;
  } else if (!itemId) {
    throw badRequest('itemId is required when no lot number is given');
  }

  await Promise.all([
    getKarigar(organizationId, input.carrierId),
    getWorkType(organizationId, input.workTypeId),
    getItem(organizationId, itemId),
    input.overlockCarrierId ? getKarigar(organizationId, input.overlockCarrierId) : Promise.resolve(),
    input.flatlockKarigarId ? getKarigar(organizationId, input.flatlockKarigarId) : Promise.resolve(),
  ]);

  return repo.createProductionEntry(
    organizationId,
    {
      date: input.date,
      cuttingEntryId,
      lotNumber: input.lotNumber,
      designNumber: input.designNumber,
      workTypeId: input.workTypeId,
      itemId,
      carrierId: input.carrierId,
      carrierQuantity: input.carrierQuantity,
      carrierRate: input.carrierRate,
      carrierTotal: computeTotal(input.carrierQuantity, input.carrierRate),
      overlockCarrierId: input.overlockCarrierId,
      overlockRate: input.overlockRate,
      overlockTotal:
        input.overlockCarrierId && input.overlockRate
          ? computeTotal(input.carrierQuantity, input.overlockRate)
          : undefined,
      flatlockKarigarId: input.flatlockKarigarId,
      flatlockRate: input.flatlockRate,
      flatlockTotal:
        input.flatlockKarigarId && input.flatlockRate
          ? computeTotal(input.carrierQuantity, input.flatlockRate)
          : undefined,
      photoUrl: input.photoUrl,
      remarks: input.remarks,
    },
    actorId,
  );
};

export const updateProductionEntry = async (
  organizationId: string,
  id: string,
  input: UpdateProductionEntryInput,
  actorId: string | null,
) => {
  const existing = await getProductionEntry(organizationId, id);

  await Promise.all([
    input.carrierId ? getKarigar(organizationId, input.carrierId) : Promise.resolve(),
    input.workTypeId ? getWorkType(organizationId, input.workTypeId) : Promise.resolve(),
    input.itemId ? getItem(organizationId, input.itemId) : Promise.resolve(),
    input.overlockCarrierId ? getKarigar(organizationId, input.overlockCarrierId) : Promise.resolve(),
    input.flatlockKarigarId ? getKarigar(organizationId, input.flatlockKarigarId) : Promise.resolve(),
  ]);

  const carrierQuantity = input.carrierQuantity ?? existing.carrierQuantity;
  const carrierRate = input.carrierRate ?? Number(existing.carrierRate);

  const overlockRate = input.overlockRate === undefined ? Number(existing.overlockRate ?? 0) || undefined : input.overlockRate ?? undefined;
  const overlockCarrierId =
    input.overlockCarrierId === undefined ? existing.overlockCarrierId ?? undefined : input.overlockCarrierId ?? undefined;

  const flatlockRate = input.flatlockRate === undefined ? Number(existing.flatlockRate ?? 0) || undefined : input.flatlockRate ?? undefined;
  const flatlockKarigarId =
    input.flatlockKarigarId === undefined ? existing.flatlockKarigarId ?? undefined : input.flatlockKarigarId ?? undefined;

  return repo.updateProductionEntry(
    id,
    {
      date: input.date,
      designNumber: input.designNumber,
      workTypeId: input.workTypeId,
      itemId: input.itemId,
      carrierId: input.carrierId,
      carrierQuantity: input.carrierQuantity,
      carrierRate: input.carrierRate,
      carrierTotal: computeTotal(carrierQuantity, carrierRate),
      overlockCarrierId,
      overlockRate,
      overlockTotal: overlockCarrierId && overlockRate ? computeTotal(carrierQuantity, overlockRate) : null,
      flatlockKarigarId,
      flatlockRate,
      flatlockTotal: flatlockKarigarId && flatlockRate ? computeTotal(carrierQuantity, flatlockRate) : null,
      photoUrl: input.photoUrl,
      remarks: input.remarks,
    },
    actorId,
  );
};

export const deleteProductionEntry = async (organizationId: string, id: string, actorId: string | null) => {
  await getProductionEntry(organizationId, id);
  await repo.softDeleteProductionEntry(id, actorId);
};
