import { prisma } from '../../lib/prisma';

export const listColors = (organizationId: string) =>
  prisma.color.findMany({ where: { organizationId }, orderBy: { name: 'asc' } });

export const findColorById = (organizationId: string, id: string) =>
  prisma.color.findFirst({ where: { id, organizationId } });

export const findColorByName = (organizationId: string, name: string) =>
  prisma.color.findFirst({ where: { organizationId, name } });

export const createColor = (organizationId: string, data: { name: string }, createdById: string | null) =>
  prisma.color.create({ data: { organizationId, ...data, createdById: createdById ?? undefined } });

export const updateColor = (
  id: string,
  data: Partial<{ name: string; isActive: boolean }>,
  updatedById: string | null,
) => prisma.color.update({ where: { id }, data: { ...data, updatedById: updatedById ?? undefined } });

// Same FK-reality reasoning as PatternType/WorkType — CuttingEntryRow.colorId has no
// cascade/set-null, so rows of a soft-deleted cutting entry still hold a real FK to this color.
export const countCuttingEntriesWithColor = async (colorId: string) =>
  (await prisma.cuttingEntryRow.count({ where: { colorId } })) +
  (await prisma.cuttingDistributionQuantity.count({ where: { colorId } }));

export const deleteColor = (id: string) => prisma.color.delete({ where: { id } });
