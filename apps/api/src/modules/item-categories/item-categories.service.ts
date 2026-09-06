import { conflict, notFound } from '../../lib/httpError';
import * as repo from './item-categories.repository';
import type { CreateItemCategoryInput, UpdateItemCategoryInput } from './item-categories.schema';

export const listItemCategories = (organizationId: string) => repo.listItemCategories(organizationId);

export const getItemCategory = async (organizationId: string, id: string) => {
  const category = await repo.findItemCategoryById(organizationId, id);
  if (!category) throw notFound('Category not found');
  return category;
};

export const createItemCategory = async (
  organizationId: string,
  input: CreateItemCategoryInput,
  actorId: string | null,
) => {
  if (await repo.findItemCategoryByName(organizationId, input.name)) {
    throw conflict('A category with this name already exists');
  }
  if (await repo.findItemCategoryByPrefix(organizationId, input.prefix)) {
    throw conflict('A category with this prefix already exists');
  }
  return repo.createItemCategory(organizationId, input, actorId);
};

// prefix is not editable here — existing style numbers were generated from it, so changing it
// after items exist would make the prefix on old codes lie about which category minted them.
export const updateItemCategory = async (
  organizationId: string,
  id: string,
  input: UpdateItemCategoryInput,
  actorId: string | null,
) => {
  await getItemCategory(organizationId, id);
  if (input.name) {
    const existing = await repo.findItemCategoryByName(organizationId, input.name);
    if (existing && existing.id !== id) throw conflict('A category with this name already exists');
  }
  return repo.updateItemCategory(id, input, actorId);
};

export const deleteItemCategory = async (organizationId: string, id: string) => {
  await getItemCategory(organizationId, id);
  const itemCount = await repo.countItemsInCategory(id);
  if (itemCount > 0) throw conflict('Reassign or remove the items in this category before deleting it');
  await repo.deleteItemCategory(id);
};
