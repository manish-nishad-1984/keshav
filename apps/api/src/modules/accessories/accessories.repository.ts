import { prisma } from '../../lib/prisma';

export const listAccessories = (organizationId: string) =>
  prisma.accessory.findMany({ where: { organizationId }, orderBy: { name: 'asc' } });

export const findAccessoryById = (organizationId: string, id: string) =>
  prisma.accessory.findFirst({ where: { id, organizationId } });

export const findAccessoryByName = (organizationId: string, name: string) =>
  prisma.accessory.findFirst({ where: { organizationId, name: { equals: name, mode: 'insensitive' } } });

export const findAccessoriesByIds = (organizationId: string, ids: string[]) =>
  prisma.accessory.findMany({ where: { organizationId, id: { in: ids } }, select: { id: true } });

export const createAccessory = (organizationId: string, data: { name: string; unit: string }, createdById: string | null) =>
  prisma.accessory.create({ data: { organizationId, ...data, createdById: createdById ?? undefined } });

export const updateAccessory = (
  id: string,
  data: { name?: string; unit?: string; isActive?: boolean },
  updatedById: string | null,
) => prisma.accessory.update({ where: { id }, data: { ...data, updatedById: updatedById ?? undefined } });

export const deleteAccessory = (id: string) => prisma.accessory.delete({ where: { id } });

export const countAccessoryUsage = async (accessoryId: string) =>
  (await prisma.itemAccessory.count({ where: { accessoryId } })) +
  (await prisma.accessoryTransactionLine.count({ where: { accessoryId } }));

export const listDesignAccessories = (itemId: string) =>
  prisma.itemAccessory.findMany({
    where: { itemId },
    include: { accessory: true },
    orderBy: { accessory: { name: 'asc' } },
  });

// Every non-deleted design with its per-piece accessories, for the Accessory Master overview.
export const listDesignsWithAccessories = (organizationId: string) =>
  prisma.item.findMany({
    where: { organizationId, deletedAt: null },
    select: {
      id: true,
      itemName: true,
      isActive: true,
      accessories: { include: { accessory: true }, orderBy: { accessory: { name: 'asc' } } },
    },
    orderBy: { itemName: 'asc' },
  });

export const replaceDesignAccessories = (itemId: string, lines: { accessoryId: string; quantityPerPiece: number }[]) =>
  prisma.$transaction(async (tx) => {
    await tx.itemAccessory.deleteMany({ where: { itemId } });
    await tx.itemAccessory.createMany({ data: lines.map((l) => ({ itemId, ...l })) });
    return tx.itemAccessory.findMany({ where: { itemId }, include: { accessory: true }, orderBy: { accessory: { name: 'asc' } } });
  });
