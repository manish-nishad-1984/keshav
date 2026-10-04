import { prisma } from '../../lib/prisma';
import type { Prisma } from '@prisma/client';

export const listItems = async (
  organizationId: string,
  page: number,
  pageSize: number,
  search?: string,
  categoryId?: string,
) => {
  const where: Prisma.ItemWhereInput = {
    organizationId,
    deletedAt: null,
    ...(categoryId ? { categoryId } : {}),
    ...(search
      ? {
          itemName: { contains: search, mode: 'insensitive' },
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.item.findMany({
      where,
      include: { category: true },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.item.count({ where }),
  ]);

  return { items, total };
};

export const findItemById = (organizationId: string, id: string) =>
  prisma.item.findFirst({ where: { id, organizationId, deletedAt: null }, include: { category: true } });

// Design names are unique among non-deleted items, case-insensitively.
export const findActiveItemByName = (organizationId: string, itemName: string) =>
  prisma.item.findFirst({
    where: { organizationId, deletedAt: null, itemName: { equals: itemName.trim(), mode: 'insensitive' } },
  });

export const createItem = (
  organizationId: string,
  data: { categoryId: string; itemName: string; photoUrl?: string },
  createdById: string | null,
) =>
  prisma.item.create({
    data: { organizationId, ...data, createdById: createdById ?? undefined },
    include: { category: true },
  });

export const updateItem = (
  id: string,
  data: Partial<{ categoryId: string; itemName: string; photoUrl: string | null; isActive: boolean }>,
  updatedById: string | null,
) =>
  prisma.item.update({
    where: { id },
    data: { ...data, updatedById: updatedById ?? undefined },
    include: { category: true },
  });

export const softDeleteItem = (id: string, updatedById: string | null) =>
  prisma.item.update({
    where: { id },
    data: { deletedAt: new Date(), isActive: false, updatedById: updatedById ?? undefined },
  });
