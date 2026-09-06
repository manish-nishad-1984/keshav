import { prisma } from '../../lib/prisma';

export const listItemCategories = (organizationId: string) =>
  prisma.itemCategory.findMany({
    where: { organizationId },
    orderBy: { name: 'asc' },
  });

export const findItemCategoryById = (organizationId: string, id: string) =>
  prisma.itemCategory.findFirst({ where: { id, organizationId } });

export const findItemCategoryByName = (organizationId: string, name: string) =>
  prisma.itemCategory.findFirst({ where: { organizationId, name } });

export const findItemCategoryByPrefix = (organizationId: string, prefix: string) =>
  prisma.itemCategory.findFirst({ where: { organizationId, prefix } });

export const createItemCategory = (
  organizationId: string,
  data: { name: string; prefix: string },
  createdById: string | null,
) =>
  prisma.itemCategory.create({
    data: { organizationId, ...data, createdById: createdById ?? undefined },
  });

export const updateItemCategory = (
  id: string,
  data: Partial<{ name: string; isActive: boolean }>,
  updatedById: string | null,
) => prisma.itemCategory.update({ where: { id }, data: { ...data, updatedById: updatedById ?? undefined } });

// Deliberately counts soft-deleted items too: the Item.category relation has no onDelete
// cascade/set-null, so a soft-deleted item still holds a real FK to this category — hard-deleting
// the category while that row exists would fail at the database level (P2003), not just logically.
export const countItemsInCategory = (categoryId: string) => prisma.item.count({ where: { categoryId } });

export const deleteItemCategory = (id: string) => prisma.itemCategory.delete({ where: { id } });
