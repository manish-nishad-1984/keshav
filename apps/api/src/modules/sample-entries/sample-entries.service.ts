import { badRequest, notFound } from '../../lib/httpError';
import { prisma } from '../../lib/prisma';
import * as repo from './sample-entries.repository';
import type { CreateSampleEntryInput, ListSampleEntriesQuery, UpdateSampleEntryInput } from './sample-entries.schema';

const computeTotal = (quantity: number, rate: number) => Math.round(quantity * rate * 100) / 100;

// The karigar must exist, be of the chosen work type, and the design / work type must exist.
const checkReferences = async (organizationId: string, ids: { karigarId: string; workTypeId: string; itemId: string }) => {
  const [karigar, workType, item] = await Promise.all([
    prisma.karigar.findFirst({ where: { id: ids.karigarId, organizationId, deletedAt: null } }),
    prisma.workType.findFirst({ where: { id: ids.workTypeId, organizationId } }),
    prisma.item.findFirst({ where: { id: ids.itemId, organizationId, deletedAt: null } }),
  ]);
  if (!karigar) throw notFound('Karigar not found');
  if (!workType) throw notFound('Work type not found');
  if (!item) throw notFound('Design not found');
  if (karigar.workTypeId !== workType.id) {
    throw badRequest(`${karigar.fullName} is not a ${workType.name} karigar — pick a karigar of that work type`);
  }
};

export const listSampleEntries = (organizationId: string, query: ListSampleEntriesQuery) =>
  repo.listSampleEntries(organizationId, query.page, query.pageSize, {
    karigarId: query.karigarId,
    search: query.search,
    dateFrom: query.dateFrom,
    dateTo: query.dateTo,
  });

export const getSampleEntry = async (organizationId: string, id: string) => {
  const entry = await repo.findSampleEntryById(organizationId, id);
  if (!entry) throw notFound('Sample entry not found');
  return entry;
};

export const createSampleEntry = async (organizationId: string, input: CreateSampleEntryInput, actorId: string | null) => {
  await checkReferences(organizationId, input);
  return repo.createSampleEntry(
    organizationId,
    {
      karigarId: input.karigarId,
      workTypeId: input.workTypeId,
      itemId: input.itemId,
      date: input.date,
      entryTime: input.entryTime ?? null,
      quantity: input.quantity,
      rate: input.rate,
      total: computeTotal(input.quantity, input.rate),
      remarks: input.remarks ?? null,
    },
    actorId,
  );
};

export const updateSampleEntry = async (
  organizationId: string,
  id: string,
  input: UpdateSampleEntryInput,
  actorId: string | null,
) => {
  const existing = await getSampleEntry(organizationId, id);
  const karigarId = input.karigarId ?? existing.karigarId;
  const workTypeId = input.workTypeId ?? existing.workTypeId;
  const itemId = input.itemId ?? existing.itemId;
  if (input.karigarId || input.workTypeId || input.itemId) await checkReferences(organizationId, { karigarId, workTypeId, itemId });

  const quantity = input.quantity ?? existing.quantity;
  const rate = input.rate ?? Number(existing.rate);
  return repo.updateSampleEntry(
    id,
    {
      karigarId,
      workTypeId,
      itemId,
      date: input.date,
      ...(input.entryTime !== undefined ? { entryTime: input.entryTime } : {}),
      quantity,
      rate,
      total: computeTotal(quantity, rate),
      ...(input.remarks !== undefined ? { remarks: input.remarks } : {}),
    },
    actorId,
  );
};

export const deleteSampleEntry = async (organizationId: string, id: string, actorId: string | null) => {
  await getSampleEntry(organizationId, id);
  await repo.softDeleteSampleEntry(id, actorId);
};
