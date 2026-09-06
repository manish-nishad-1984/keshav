import { notFound } from '../../lib/httpError';
import { nextSequenceCode } from '../../lib/numberSequence';
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

// Style No. is minted once from the chosen category's prefix and stays fixed for the item's
// life — changing the category later (see updateItem) does not regenerate it.
export const createItem = async (organizationId: string, input: CreateItemInput, actorId: string | null) => {
  const category = await getItemCategory(organizationId, input.categoryId);
  const styleNo = await nextSequenceCode(organizationId, category.prefix);
  return repo.createItem(organizationId, styleNo, input, actorId);
};

export const updateItem = async (
  organizationId: string,
  id: string,
  input: UpdateItemInput,
  actorId: string | null,
) => {
  await getItem(organizationId, id);
  if (input.categoryId) await getItemCategory(organizationId, input.categoryId);
  return repo.updateItem(id, input, actorId);
};

export const deleteItem = async (organizationId: string, id: string, actorId: string | null) => {
  await getItem(organizationId, id);
  await repo.softDeleteItem(id, actorId);
};
