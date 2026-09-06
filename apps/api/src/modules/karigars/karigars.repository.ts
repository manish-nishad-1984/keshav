import { prisma } from '../../lib/prisma';
import type { Prisma } from '@prisma/client';

export const listKarigars = async (
  organizationId: string,
  page: number,
  pageSize: number,
  search?: string,
  workTypeId?: string,
) => {
  const where: Prisma.KarigarWhereInput = {
    organizationId,
    deletedAt: null,
    ...(workTypeId ? { workTypeId } : {}),
    ...(search
      ? {
          OR: [
            { fullName: { contains: search, mode: 'insensitive' } },
            { code: { contains: search, mode: 'insensitive' } },
            { mobile: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.karigar.findMany({
      where,
      include: { workType: true },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.karigar.count({ where }),
  ]);

  return { items, total };
};

export const findKarigarById = (organizationId: string, id: string) =>
  prisma.karigar.findFirst({ where: { id, organizationId, deletedAt: null }, include: { workType: true } });

export const createKarigar = (
  organizationId: string,
  code: string,
  data: {
    fullName: string;
    mobile: string;
    workTypeId: string;
    photoUrl?: string;
    joinDate?: Date;
    address?: string;
    remarks?: string;
  },
  createdById: string | null,
) =>
  prisma.karigar.create({
    data: {
      organizationId,
      code,
      ...data,
      createdById: createdById ?? undefined,
    },
    include: { workType: true },
  });

export const updateKarigar = (
  id: string,
  data: Partial<{
    fullName: string;
    mobile: string;
    workTypeId: string;
    photoUrl: string | null;
    joinDate: Date | null;
    address: string;
    remarks: string;
    isActive: boolean;
  }>,
  updatedById: string | null,
) =>
  prisma.karigar.update({
    where: { id },
    data: { ...data, updatedById: updatedById ?? undefined },
    include: { workType: true },
  });

export const softDeleteKarigar = (id: string, updatedById: string | null) =>
  prisma.karigar.update({
    where: { id },
    data: { deletedAt: new Date(), isActive: false, updatedById: updatedById ?? undefined },
  });
