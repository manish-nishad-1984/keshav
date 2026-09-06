import { notFound } from '../../lib/httpError';
import { getKarigar } from '../karigars/karigars.service';
import { getWorkType } from '../work-types/work-types.service';
import { getItem } from '../items/items.service';
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
    karigarId: query.karigarId,
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
  await Promise.all([
    getKarigar(organizationId, input.karigarId),
    getWorkType(organizationId, input.workTypeId),
    getItem(organizationId, input.itemId),
  ]);

  return repo.createProductionEntry(
    organizationId,
    { ...input, totalAmount: computeTotal(input.quantity, input.rate) },
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
    input.karigarId ? getKarigar(organizationId, input.karigarId) : Promise.resolve(),
    input.workTypeId ? getWorkType(organizationId, input.workTypeId) : Promise.resolve(),
    input.itemId ? getItem(organizationId, input.itemId) : Promise.resolve(),
  ]);

  const quantity = input.quantity ?? existing.quantity;
  const rate = input.rate ?? Number(existing.rate);

  return repo.updateProductionEntry(id, { ...input, totalAmount: computeTotal(quantity, rate) }, actorId);
};

export const deleteProductionEntry = async (organizationId: string, id: string, actorId: string | null) => {
  await getProductionEntry(organizationId, id);
  await repo.softDeleteProductionEntry(id, actorId);
};
