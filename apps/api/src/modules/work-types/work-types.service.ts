import { conflict, notFound } from '../../lib/httpError';
import * as repo from './work-types.repository';
import type { CreateWorkTypeInput, UpdateWorkTypeInput } from './work-types.schema';

export const listWorkTypes = (organizationId: string) => repo.listWorkTypes(organizationId);

export const getWorkType = async (organizationId: string, id: string) => {
  const workType = await repo.findWorkTypeById(organizationId, id);
  if (!workType) throw notFound('Work type not found');
  return workType;
};

export const createWorkType = async (organizationId: string, input: CreateWorkTypeInput, actorId: string | null) => {
  if (await repo.findWorkTypeByName(organizationId, input.name)) {
    throw conflict('A work type with this name already exists');
  }
  return repo.createWorkType(organizationId, input, actorId);
};

export const updateWorkType = async (
  organizationId: string,
  id: string,
  input: UpdateWorkTypeInput,
  actorId: string | null,
) => {
  await getWorkType(organizationId, id);
  if (input.name) {
    const existing = await repo.findWorkTypeByName(organizationId, input.name);
    if (existing && existing.id !== id) throw conflict('A work type with this name already exists');
  }
  return repo.updateWorkType(id, input, actorId);
};

export const deleteWorkType = async (organizationId: string, id: string) => {
  await getWorkType(organizationId, id);
  const karigarCount = await repo.countKarigarsWithWorkType(id);
  if (karigarCount > 0) throw conflict('Reassign or remove the karigars using this work type before deleting it');
  await repo.deleteWorkType(id);
};
