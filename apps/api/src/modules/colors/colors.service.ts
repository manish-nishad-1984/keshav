import { conflict, notFound } from '../../lib/httpError';
import * as repo from './colors.repository';
import type { CreateColorInput, UpdateColorInput } from './colors.schema';

export const listColors = (organizationId: string) => repo.listColors(organizationId);

export const getColor = async (organizationId: string, id: string) => {
  const color = await repo.findColorById(organizationId, id);
  if (!color) throw notFound('Color not found');
  return color;
};

export const createColor = async (organizationId: string, input: CreateColorInput, actorId: string | null) => {
  if (await repo.findColorByName(organizationId, input.name)) {
    throw conflict('A color with this name already exists');
  }
  return repo.createColor(organizationId, input, actorId);
};

export const updateColor = async (
  organizationId: string,
  id: string,
  input: UpdateColorInput,
  actorId: string | null,
) => {
  await getColor(organizationId, id);
  if (input.name) {
    const existing = await repo.findColorByName(organizationId, input.name);
    if (existing && existing.id !== id) throw conflict('A color with this name already exists');
  }
  return repo.updateColor(id, input, actorId);
};

export const deleteColor = async (organizationId: string, id: string) => {
  await getColor(organizationId, id);
  const usageCount = await repo.countCuttingEntriesWithColor(id);
  if (usageCount > 0) throw conflict('Remove or reassign the cutting entries using this color before deleting it');
  await repo.deleteColor(id);
};
