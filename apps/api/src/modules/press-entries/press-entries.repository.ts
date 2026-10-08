import { prisma } from '../../lib/prisma';
import type { Prisma } from '@prisma/client';

const includeRelations = {
  karigar: { select: { id: true, code: true, fullName: true } },
} as const;

export const listPressEntries = async (
  organizationId: string,
  page: number,
  pageSize: number,
  filters: { karigarId?: string; search?: string; dateFrom?: Date; dateTo?: Date },
) => {
  const where: Prisma.PressEntryWhereInput = {
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
          ],
        }
      : {}),
  };

  const [items, total, sums] = await Promise.all([
    prisma.pressEntry.findMany({
      where,
      include: includeRelations,
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.pressEntry.count({ where }),
    prisma.pressEntry.aggregate({ where, _sum: { pieces: true, total: true } }),
  ]);

  return { items, total, totals: { pieces: sums._sum.pieces ?? 0, amount: Number(sums._sum.total ?? 0) } };
};

export const findPressEntryById = (organizationId: string, id: string) =>
  prisma.pressEntry.findFirst({ where: { id, organizationId, deletedAt: null }, include: includeRelations });

interface PressEntryData {
  karigarId: string;
  date: Date;
  entryTime?: string | null;
  isOnline: boolean;
  pieces: number;
  rate: number;
  total: number;
  remarks?: string | null;
}

export const createPressEntry = (organizationId: string, data: PressEntryData, createdById: string | null) =>
  prisma.pressEntry.create({
    data: { organizationId, ...data, createdById: createdById ?? undefined },
    include: includeRelations,
  });

export const updatePressEntry = (id: string, data: Partial<PressEntryData>, updatedById: string | null) =>
  prisma.pressEntry.update({
    where: { id },
    data: { ...data, updatedById: updatedById ?? undefined },
    include: includeRelations,
  });

export const softDeletePressEntry = (id: string, updatedById: string | null) =>
  prisma.pressEntry.update({ where: { id }, data: { deletedAt: new Date(), updatedById: updatedById ?? undefined } });

const RATES_KEY = { scope: 'press', key: 'rates' } as const;

export const findPressRates = (organizationId: string) =>
  prisma.companySetting.findUnique({ where: { organizationId_scope_key: { organizationId, ...RATES_KEY } } });

export const savePressRates = (organizationId: string, value: { onlineRate: number; offlineRate: number }) =>
  prisma.companySetting.upsert({
    where: { organizationId_scope_key: { organizationId, ...RATES_KEY } },
    create: { organizationId, ...RATES_KEY, value },
    update: { value },
  });
