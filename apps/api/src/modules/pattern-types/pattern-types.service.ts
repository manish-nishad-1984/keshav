import { conflict, notFound } from '../../lib/httpError';
import * as repo from './pattern-types.repository';
import type { CreatePatternTypeInput, UpdatePatternTypeInput } from './pattern-types.schema';

export const listPatternTypes = (organizationId: string) => repo.listPatternTypes(organizationId);

export const getPatternType = async (organizationId: string, id: string) => {
  const patternType = await repo.findPatternTypeById(organizationId, id);
  if (!patternType) throw notFound('Pattern type not found');
  return patternType;
};

export const createPatternType = async (
  organizationId: string,
  input: CreatePatternTypeInput,
  actorId: string | null,
) => {
  if (await repo.findPatternTypeByName(organizationId, input.name)) {
    throw conflict('A pattern type with this name already exists');
  }
  return repo.createPatternType(organizationId, input, actorId);
};

export const updatePatternType = async (
  organizationId: string,
  id: string,
  input: UpdatePatternTypeInput,
  actorId: string | null,
) => {
  await getPatternType(organizationId, id);
  if (input.name) {
    const existing = await repo.findPatternTypeByName(organizationId, input.name);
    if (existing && existing.id !== id) throw conflict('A pattern type with this name already exists');
  }
  return repo.updatePatternType(id, input, actorId);
};

export const deletePatternType = async (organizationId: string, id: string) => {
  await getPatternType(organizationId, id);
  const usageCount = await repo.countCuttingEntriesWithPatternType(id);
  if (usageCount > 0) throw conflict('Remove or reassign the cutting entries using this pattern type before deleting it');
  await repo.deletePatternType(id);
};
