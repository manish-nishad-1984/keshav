import { badRequest, notFound } from '../../lib/httpError';
import { prisma } from '../../lib/prisma';
import * as repo from './press-entries.repository';
import type { CreatePressEntryInput, ListPressEntriesQuery, PressRates, UpdatePressEntryInput } from './press-entries.schema';

// Used until rates are saved in Settings (the first migration stored a single online / offline rate).
const DEFAULT_RATES: PressRates = { onlineRates: [2], offlineRates: [3] };

const computeTotal = (pieces: number, rate: number) => Math.round(pieces * rate * 100) / 100;
const sameRate = (a: number, b: number) => Math.abs(a - b) < 0.005;

const toRateList = (many: unknown, single: unknown, fallback: number[]) => {
  const list = Array.isArray(many) ? many.map(Number).filter((n) => n > 0) : [];
  if (list.length) return list;
  return Number(single) > 0 ? [Number(single)] : fallback;
};

// Also reads the older single-rate shape ({ onlineRate, offlineRate }).
export const getPressRates = async (organizationId: string): Promise<PressRates> => {
  const row = await repo.findPressRates(organizationId);
  const value = (row?.value ?? {}) as Record<string, unknown>;
  return {
    onlineRates: toRateList(value.onlineRates, value.onlineRate, DEFAULT_RATES.onlineRates),
    offlineRates: toRateList(value.offlineRates, value.offlineRate, DEFAULT_RATES.offlineRates),
  };
};

export const savePressRates = async (organizationId: string, rates: PressRates) => {
  await repo.savePressRates(organizationId, rates);
  return getPressRates(organizationId);
};

// The chosen rate must be one of the Settings rates for that mode (an unchanged saved rate also stays valid).
const assertAllowedRate = async (organizationId: string, isOnline: boolean, rate: number, keep?: number) => {
  const rates = await getPressRates(organizationId);
  const allowed = isOnline ? rates.onlineRates : rates.offlineRates;
  if (keep !== undefined && sameRate(keep, rate)) return;
  if (!allowed.some((r) => sameRate(r, rate))) {
    throw badRequest(`₹${rate} is not one of the ${isOnline ? 'online' : 'offline'} press rates — pick a rate from the list`);
  }
};

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
  const rate = input.rate;
  await assertAllowedRate(organizationId, input.isOnline, rate);
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

// An entry keeps the rate it was saved with. Changing the rate, or switching online / offline,
// needs a rate picked from the Settings list of that mode.
export const updatePressEntry = async (
  organizationId: string,
  id: string,
  input: UpdatePressEntryInput,
  actorId: string | null,
) => {
  const existing = await getPressEntry(organizationId, id);
  if (input.karigarId && input.karigarId !== existing.karigarId) await getPressKarigar(organizationId, input.karigarId);

  const isOnline = input.isOnline ?? existing.isOnline;
  const modeChanged = isOnline !== existing.isOnline;
  if (modeChanged && input.rate === undefined) throw badRequest('Pick a rate for the new online / offline mode');
  const rate = input.rate ?? Number(existing.rate);
  if (input.rate !== undefined || modeChanged) {
    await assertAllowedRate(organizationId, isOnline, rate, modeChanged ? undefined : Number(existing.rate));
  }
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
