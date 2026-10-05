import { badRequest, conflict, notFound } from '../../lib/httpError';
import { getItem } from '../items/items.service';
import * as repo from './accessories.repository';
import type { CreateAccessoryInput, SetDesignAccessoriesInput, UpdateAccessoryInput } from './accessories.schema';

const DUPLICATE = 'An accessory with this name already exists';

export const listAccessories = (organizationId: string) => repo.listAccessories(organizationId);

export const getAccessory = async (organizationId: string, id: string) => {
  const accessory = await repo.findAccessoryById(organizationId, id);
  if (!accessory) throw notFound('Accessory not found');
  return accessory;
};

export const assertAccessoriesExist = async (organizationId: string, ids: string[]) => {
  const unique = [...new Set(ids)];
  const found = await repo.findAccessoriesByIds(organizationId, unique);
  if (found.length !== unique.length) throw badRequest('One or more accessories were not found');
};

export const createAccessory = async (organizationId: string, input: CreateAccessoryInput, actorId: string | null) => {
  if (await repo.findAccessoryByName(organizationId, input.name)) throw conflict(DUPLICATE);
  return repo.createAccessory(organizationId, input, actorId);
};

export const updateAccessory = async (
  organizationId: string,
  id: string,
  input: UpdateAccessoryInput,
  actorId: string | null,
) => {
  await getAccessory(organizationId, id);
  if (input.name) {
    const existing = await repo.findAccessoryByName(organizationId, input.name);
    if (existing && existing.id !== id) throw conflict(DUPLICATE);
  }
  return repo.updateAccessory(id, input, actorId);
};

export const deleteAccessory = async (organizationId: string, id: string) => {
  await getAccessory(organizationId, id);
  if ((await repo.countAccessoryUsage(id)) > 0) {
    throw conflict('Designs or issues already use this accessory — deactivate it instead of deleting');
  }
  await repo.deleteAccessory(id);
};

export const listDesigns = (organizationId: string) => repo.listDesignsWithAccessories(organizationId);

export const getDesignAccessories = async (organizationId: string, itemId: string) => {
  await getItem(organizationId, itemId);
  return repo.listDesignAccessories(itemId);
};

export const setDesignAccessories = async (organizationId: string, itemId: string, input: SetDesignAccessoriesInput) => {
  await getItem(organizationId, itemId);
  await assertAccessoriesExist(organizationId, input.lines.map((l) => l.accessoryId));
  return repo.replaceDesignAccessories(itemId, input.lines);
};
