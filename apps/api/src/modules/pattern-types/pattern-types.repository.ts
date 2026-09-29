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

// A pattern type is referenced by two separate columns on CuttingEntry (patternTypeId and
// characterId, both "Pattern Type" pickers in the UI) — count both, including soft-deleted
// cutting entries, since CuttingEntry's FKs to this table have no cascade/set-null.
export const countCuttingEntriesWithPatternType = async (patternTypeId: string) =>
  prisma.cuttingEntry.count({
    where: { OR: [{ patternTypeId }, { characterId: patternTypeId }] },
  });

export const deletePatternType = (id: string) => prisma.patternType.delete({ where: { id } });
