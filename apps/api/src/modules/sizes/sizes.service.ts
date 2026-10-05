import { badRequest, conflict, notFound } from '../../lib/httpError';
import * as repo from './sizes.repository';
import type { CreateSizeInput, UpdateSizeInput } from './sizes.schema';

const DUPLICATE = 'A size with this name already exists';

export const listSizes = (organizationId: string) => repo.listSizes(organizationId);

export const getSize = async (organizationId: string, id: string) => {
  const size = await repo.findSizeById(organizationId, id);
  if (!size) throw notFound('Size not found');
  return size;
};

// Used by cutting.service: every size in a cutting grid must belong to this organization.
export const assertSizesExist = async (organizationId: string, ids: string[]) => {
  const unique = [...new Set(ids)];
  const found = await repo.findSizesByIds(organizationId, unique);
  if (found.length !== unique.length) throw badRequest('One or more sizes were not found');
};

export const createSize = async (organizationId: string, input: CreateSizeInput, actorId: string | null) => {
  if (await repo.findSizeByName(organizationId, input.name)) throw conflict(DUPLICATE);
  // New sizes go to the end of the grid unless an order is given.
  const sortOrder = input.sortOrder ?? (await repo.maxSortOrder(organizationId)) + 1;
  return repo.createSize(organizationId, { name: input.name, detail: input.detail, sortOrder }, actorId);
};

export const updateSize = async (organizationId: string, id: string, input: UpdateSizeInput, actorId: string | null) => {
  await getSize(organizationId, id);
  if (input.name) {
    const existing = await repo.findSizeByName(organizationId, input.name);
    if (existing && existing.id !== id) throw conflict(DUPLICATE);
  }
  return repo.updateSize(id, input, actorId);
};

export const deleteSize = async (organizationId: string, id: string) => {
  await getSize(organizationId, id);
  if ((await repo.countQuantitiesForSize(id)) > 0) {
    throw conflict('Cutting lots already use this size — deactivate it instead of deleting');
  }
  await repo.deleteSize(id);
};
