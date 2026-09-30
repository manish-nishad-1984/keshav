import { prisma } from '../../lib/prisma';

export const listPatternTypes = (organizationId: string) =>
  prisma.patternType.findMany({ where: { organizationId }, orderBy: { name: 'asc' } });

export const findPatternTypeById = (organizationId: string, id: string) =>
  prisma.patternType.findFirst({ where: { id, organizationId } });

export const findPatternTypeByName = (organizationId: string, name: string) =>
  prisma.patternType.findFirst({ where: { organizationId, name } });

export const createPatternType = (organizationId: string, data: { name: string }, createdById: string | null) =>
  prisma.patternType.create({ data: { organizationId, ...data, createdById: createdById ?? undefined } });

export const updatePatternType = (
  id: string,
  data: Partial<{ name: string; isActive: boolean }>,
  updatedById: string | null,
) => prisma.patternType.update({ where: { id }, data: { ...data, updatedById: updatedById ?? undefined } });

// Counts soft-deleted cutting entries too, since CuttingEntry's FK to this table has no
// cascade/set-null.
export const countCuttingEntriesWithPatternType = async (patternTypeId: string) =>
  prisma.cuttingEntry.count({ where: { patternTypeId } });

export const deletePatternType = (id: string) => prisma.patternType.delete({ where: { id } });
