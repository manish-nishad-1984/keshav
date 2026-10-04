import { conflict, notFound } from '../../lib/httpError';
import { getItemCategory } from '../item-categories/item-categories.service';
import * as repo from './items.repository';
import type { CreateItemInput, ListItemsQuery, UpdateItemInput } from './items.schema';

export const listItems = (organizationId: string, query: ListItemsQuery) =>
  repo.listItems(organizationId, query.page, query.pageSize, query.search, query.categoryId);

export const getItem = async (organizationId: string, id: string) => {
  const item = await repo.findItemById(organizationId, id);
  if (!item) throw notFound('Item not found');
  return item;
};

const DUPLICATE_DESIGN = 'A design with this name already exists';

export const createItem = async (organizationId: string, input: CreateItemInput, actorId: string | null) => {
  await getItemCategory(organizationId, input.categoryId);
  if (await repo.findActiveItemByName(organizationId, input.itemName)) throw conflict(DUPLICATE_DESIGN);
  return repo.createItem(organizationId, input, actorId);
};

export const updateItem = async (
  organizationId: string,
  id: string,
  input: UpdateItemInput,
  actorId: string | null,
) => {
  await getItem(organizationId, id);
  if (input.categoryId) await getItemCategory(organizationId, input.categoryId);
  if (input.itemName) {
    const existing = await repo.findActiveItemByName(organizationId, input.itemName);
    if (existing && existing.id !== id) throw conflict(DUPLICATE_DESIGN);
  }
  return repo.updateItem(id, input, actorId);
};

export const deleteItem = async (organizationId: string, id: string, actorId: string | null) => {
  await getItem(organizationId, id);
  await repo.softDeleteItem(id, actorId);
};
