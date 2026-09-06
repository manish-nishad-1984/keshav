import { prisma } from '../../lib/prisma';

export const listWorkTypes = (organizationId: string) =>
  prisma.workType.findMany({ where: { organizationId }, orderBy: { name: 'asc' } });

export const findWorkTypeById = (organizationId: string, id: string) =>
  prisma.workType.findFirst({ where: { id, organizationId } });

export const findWorkTypeByName = (organizationId: string, name: string) =>
  prisma.workType.findFirst({ where: { organizationId, name } });

export const createWorkType = (organizationId: string, data: { name: string }, createdById: string | null) =>
  prisma.workType.create({ data: { organizationId, ...data, createdById: createdById ?? undefined } });

export const updateWorkType = (
  id: string,
  data: Partial<{ name: string; isActive: boolean }>,
  updatedById: string | null,
) => prisma.workType.update({ where: { id }, data: { ...data, updatedById: updatedById ?? undefined } });

// Deliberately counts soft-deleted karigars too — same reasoning as ItemCategory's
// countItemsInCategory: Karigar.workType has no onDelete cascade/set-null, so a soft-deleted
// karigar still holds a real FK to this work type, and hard-deleting it would fail at the
// database level (P2003) otherwise.
export const countKarigarsWithWorkType = (workTypeId: string) => prisma.karigar.count({ where: { workTypeId } });

export const deleteWorkType = (id: string) => prisma.workType.delete({ where: { id } });
