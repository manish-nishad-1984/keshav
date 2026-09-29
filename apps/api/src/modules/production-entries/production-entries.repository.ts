import { prisma } from '../../lib/prisma';
import type { Prisma } from '@prisma/client';

const includeRelations = {
  carrier: true,
  overlockCarrier: true,
  flatlockKarigar: true,
  workType: true,
  item: { include: { category: true } },
  cuttingEntry: true,
} as const;

export const listProductionEntries = async (
  organizationId: string,
  page: number,
  pageSize: number,
  filters: { search?: string; carrierId?: string; itemId?: string; dateFrom?: Date; dateTo?: Date },
) => {
  const where: Prisma.ProductionEntryWhereInput = {
    organizationId,
    deletedAt: null,
    ...(filters.carrierId ? { carrierId: filters.carrierId } : {}),
    ...(filters.itemId ? { itemId: filters.itemId } : {}),
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
            { lotNumber: { contains: filters.search, mode: 'insensitive' } },
            { carrier: { fullName: { contains: filters.search, mode: 'insensitive' } } },
            { item: { styleNo: { contains: filters.search, mode: 'insensitive' } } },
            { item: { itemName: { contains: filters.search, mode: 'insensitive' } } },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.productionEntry.findMany({
      where,
      include: includeRelations,
      orderBy: { date: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.productionEntry.count({ where }),
  ]);

  return { items, total };
};

export const findProductionEntryById = (organizationId: string, id: string) =>
  prisma.productionEntry.findFirst({ where: { id, organizationId, deletedAt: null }, include: includeRelations });

interface ProductionEntryData {
  date: Date;
  cuttingEntryId?: string;
  lotNumber?: string;
  designNumber?: string;
  workTypeId: string;
  itemId: string;
  carrierId: string;
  carrierQuantity: number;
  carrierRate: number;
  carrierTotal: number;
  overlockCarrierId?: string | null;
  overlockRate?: number | null;
  overlockTotal?: number | null;
  flatlockKarigarId?: string | null;
  flatlockRate?: number | null;
  flatlockTotal?: number | null;
  photoUrl?: string | null;
  remarks?: string;
}

export const createProductionEntry = (
  organizationId: string,
  data: ProductionEntryData,
  createdById: string | null,
) =>
  prisma.productionEntry.create({
    data: { organizationId, ...data, createdById: createdById ?? undefined },
    include: includeRelations,
  });

export const updateProductionEntry = (
  id: string,
  data: Partial<Omit<ProductionEntryData, 'cuttingEntryId' | 'lotNumber'>>,
  updatedById: string | null,
) =>
  prisma.productionEntry.update({
    where: { id },
    data: { ...data, updatedById: updatedById ?? undefined },
    include: includeRelations,
  });

export const softDeleteProductionEntry = (id: string, updatedById: string | null) =>
  prisma.productionEntry.update({
    where: { id },
    data: { deletedAt: new Date(), updatedById: updatedById ?? undefined },
  });
