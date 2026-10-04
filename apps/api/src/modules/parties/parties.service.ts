import { conflict, notFound } from '../../lib/httpError';
import * as repo from './parties.repository';
import type { CreatePartyInput, UpdatePartyInput } from './parties.schema';

export const listParties = (organizationId: string) => repo.listParties(organizationId);

export const getParty = async (organizationId: string, id: string) => {
  const party = await repo.findPartyById(organizationId, id);
  if (!party) throw notFound('Party not found');
  return party;
};

export const createParty = async (organizationId: string, input: CreatePartyInput, actorId: string | null) => {
  if (await repo.findPartyByName(organizationId, input.name)) {
    throw conflict('A party with this name already exists');
  }
  return repo.createParty(organizationId, input, actorId);
};

export const updateParty = async (organizationId: string, id: string, input: UpdatePartyInput, actorId: string | null) => {
  await getParty(organizationId, id);
  if (input.name) {
    const existing = await repo.findPartyByName(organizationId, input.name);
    if (existing && existing.id !== id) throw conflict('A party with this name already exists');
  }
  return repo.updateParty(id, input, actorId);
};

export const deleteParty = async (organizationId: string, id: string) => {
  await getParty(organizationId, id);
  if ((await repo.countCuttingEntriesForParty(id)) > 0) {
    throw conflict('Cutting lots already use this party — deactivate it instead of deleting');
  }
  await repo.deleteParty(id);
};
