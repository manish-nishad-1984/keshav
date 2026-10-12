import { prisma } from '../../lib/prisma';
import type { Prisma } from '@prisma/client';

const includeRelations = {
  karigar: { select: { id: true, code: true, fullName: true } },
  workType: { select: { id: true, name: true } },
  item: { select: { id: true, itemName: true, photoUrl: true } },
} as const;

export const listSampleEntries = async (
  organizationId: string,
  page: number,
  pageSize: number,
  filters: { karigarId?: string; search?: string; dateFrom?: Date; dateTo?: Date },
) => {
  const where: Prisma.SampleEntryWhereInput = {
    organizationId,
    deletedAt: null,
    ...(filters.karigarId ? { karigarId: filters.karigarId } : {}),
    ...(filters.dateFrom || filters.dateTo
      ? {
          date: {
            ...(filters.dateFrom ? { gte: filters.dateFrom } : {}),
            ...(filters.dateTo ? { lte: filters.dateTo } : {}),
          },
        }
      : {}),
    ...(filters.search
      ? {
          OR: [
            { karigar: { fullName: { contains: filters.search, mode: 'insensitive' } } },
            { karigar: { code: { contains: filters.search, mode: 'insensitive' } } },
            { item: { itemName: { contains: filters.search, mode: 'insensitive' } } },
          ],
        }
      : {}),
  };

  const [items, total, sums] = await Promise.all([
    prisma.sampleEntry.findMany({
      where,
      include: includeRelations,
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.sampleEntry.count({ where }),
    prisma.sampleEntry.aggregate({ where, _sum: { quantity: true, total: true } }),
  ]);

  return { items, total, totals: { quantity: sums._sum.quantity ?? 0, amount: Number(sums._sum.total ?? 0) } };
};

export const findSampleEntryById = (organizationId: string, id: string) =>
  prisma.sampleEntry.findFirst({ where: { id, organizationId, deletedAt: null }, include: includeRelations });

interface SampleEntryData {
  karigarId: string;
  workTypeId: string;
  itemId: string;
  date: Date;
  entryTime?: string | null;
  quantity: number;
  rate: number;
  total: number;
  remarks?: string | null;
}

export const createSampleEntry = (organizationId: string, data: SampleEntryData, createdById: string | null) =>
  prisma.sampleEntry.create({
    data: { organizationId, ...data, createdById: createdById ?? undefined },
    include: includeRelations,
  });

export const updateSampleEntry = (id: string, data: Partial<SampleEntryData>, updatedById: string | null) =>
  prisma.sampleEntry.update({
    where: { id },
    data: { ...data, updatedById: updatedById ?? undefined },
    include: includeRelations,
  });

export const softDeleteSampleEntry = (id: string, updatedById: string | null) =>
  prisma.sampleEntry.update({ where: { id }, data: { deletedAt: new Date(), updatedById: updatedById ?? undefined } });
