import { badRequest, notFound } from '../../lib/httpError';
import { prisma } from '../../lib/prisma';
import * as repo from './press-entries.repository';
import type { CreatePressEntryInput, ListPressEntriesQuery, PressRates, UpdatePressEntryInput } from './press-entries.schema';

// Used until the rates are saved in Settings (the migration stores these too).
const DEFAULT_RATES: PressRates = { onlineRate: 2, offlineRate: 3 };

const computeTotal = (pieces: number, rate: number) => Math.round(pieces * rate * 100) / 100;

export const getPressRates = async (organizationId: string): Promise<PressRates> => {
  const row = await repo.findPressRates(organizationId);
  const value = (row?.value ?? {}) as Partial<PressRates>;
  return {
    onlineRate: Number(value.onlineRate ?? DEFAULT_RATES.onlineRate),
    offlineRate: Number(value.offlineRate ?? DEFAULT_RATES.offlineRate),
  };
};

export const savePressRates = async (organizationId: string, rates: PressRates) => {
  await repo.savePressRates(organizationId, rates);
  return getPressRates(organizationId);
};

const rateFor = (rates: PressRates, isOnline: boolean) => (isOnline ? rates.onlineRate : rates.offlineRate);

// Only karigars whose work type is "Press" can hand in press entries.
const getPressKarigar = async (organizationId: string, karigarId: string) => {
  const karigar = await prisma.karigar.findFirst({
    where: { id: karigarId, organizationId, deletedAt: null },
    include: { workType: true },
  });
  if (!karigar) throw notFound('Karigar not found');
  if (karigar.workType.name.trim().toLowerCase() !== 'press') {
    throw badRequest(`${karigar.fullName} is not a Press karigar — set their work type to Press in Karigar Master`);
  }
  return karigar;
};

export const listPressEntries = (organizationId: string, query: ListPressEntriesQuery) =>
  repo.listPressEntries(organizationId, query.page, query.pageSize, {
    karigarId: query.karigarId,
    search: query.search,
    dateFrom: query.dateFrom,
    dateTo: query.dateTo,
  });

export const getPressEntry = async (organizationId: string, id: string) => {
  const entry = await repo.findPressEntryById(organizationId, id);
  if (!entry) throw notFound('Press entry not found');
  return entry;
};

export const createPressEntry = async (organizationId: string, input: CreatePressEntryInput, actorId: string | null) => {
  await getPressKarigar(organizationId, input.karigarId);
  const rate = rateFor(await getPressRates(organizationId), input.isOnline);
  return repo.createPressEntry(
    organizationId,
    {
      karigarId: input.karigarId,
      date: input.date,
      entryTime: input.entryTime ?? null,
      isOnline: input.isOnline,
      pieces: input.pieces,
      rate,
      total: computeTotal(input.pieces, rate),
      remarks: input.remarks ?? null,
    },
    actorId,
  );
};

// An entry keeps the rate it was saved with; switching online/offline takes the current Settings
// rate for the new mode.
export const updatePressEntry = async (
  organizationId: string,
  id: string,
  input: UpdatePressEntryInput,
  actorId: string | null,
) => {
  const existing = await getPressEntry(organizationId, id);
  if (input.karigarId && input.karigarId !== existing.karigarId) await getPressKarigar(organizationId, input.karigarId);

  const isOnline = input.isOnline ?? existing.isOnline;
  const rate = isOnline === existing.isOnline ? Number(existing.rate) : rateFor(await getPressRates(organizationId), isOnline);
  const pieces = input.pieces ?? existing.pieces;

  return repo.updatePressEntry(
    id,
    {
      karigarId: input.karigarId,
      date: input.date,
      ...(input.entryTime !== undefined ? { entryTime: input.entryTime } : {}),
      isOnline,
      pieces,
      rate,
      total: computeTotal(pieces, rate),
      ...(input.remarks !== undefined ? { remarks: input.remarks } : {}),
    },
    actorId,
  );
};

export const deletePressEntry = async (organizationId: string, id: string, actorId: string | null) => {
  await getPressEntry(organizationId, id);
  await repo.softDeletePressEntry(id, actorId);
};
