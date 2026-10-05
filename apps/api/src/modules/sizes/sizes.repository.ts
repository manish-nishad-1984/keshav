import { prisma } from '../../lib/prisma';

export const listSizes = (organizationId: string) =>
  prisma.size.findMany({ where: { organizationId }, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] });

export const findSizeById = (organizationId: string, id: string) =>
  prisma.size.findFirst({ where: { id, organizationId } });

export const findSizesByIds = (organizationId: string, ids: string[]) =>
  prisma.size.findMany({ where: { organizationId, id: { in: ids } }, select: { id: true } });

export const findSizeByName = (organizationId: string, name: string) =>
  prisma.size.findFirst({ where: { organizationId, name: { equals: name, mode: 'insensitive' } } });

export const maxSortOrder = async (organizationId: string) =>
  (await prisma.size.aggregate({ where: { organizationId }, _max: { sortOrder: true } }))._max.sortOrder ?? 0;

export const createSize = (
  organizationId: string,
  data: { name: string; detail: string | null; sortOrder: number },
  createdById: string | null,
) => prisma.size.create({ data: { organizationId, ...data, createdById: createdById ?? undefined } });

export const updateSize = (
  id: string,
  data: Partial<{ name: string; detail: string | null; sortOrder: number; isActive: boolean }>,
  updatedById: string | null,
) => prisma.size.update({ where: { id }, data: { ...data, updatedById: updatedById ?? undefined } });

// Counts quantities of soft-deleted cutting entries too: they still hold a real FK to the size.
export const countQuantitiesForSize = async (sizeId: string) =>
  (await prisma.cuttingRowQuantity.count({ where: { sizeId } })) +
  (await prisma.cuttingDistributionQuantity.count({ where: { sizeId } }));

export const deleteSize = (id: string) => prisma.size.delete({ where: { id } });
