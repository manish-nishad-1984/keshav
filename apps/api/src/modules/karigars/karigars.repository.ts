import { prisma } from '../../lib/prisma';
import type { Prisma, SalaryType } from '@prisma/client';
import type { KarigarDocumentInput } from './karigars.schema';

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
  prisma.karigar.findFirst({
    where: { id, organizationId, deletedAt: null },
    include: { workType: true, documents: { orderBy: { sortOrder: 'asc' } } },
  });

// Documents are replaced wholesale (delete all, recreate) — the form always sends the full set.
export const replaceKarigarDocuments = (karigarId: string, documents: KarigarDocumentInput[]) =>
  prisma.$transaction([
    prisma.karigarDocument.deleteMany({ where: { karigarId } }),
    prisma.karigarDocument.createMany({
      data: documents.map((d, index) => ({
        karigarId,
        type: d.type,
        label: d.type === 'OTHER' ? (d.label?.trim() ?? null) : null,
        fileUrl: d.fileUrl,
        sortOrder: index,
      })),
    }),
  ]);

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
    salaryType?: SalaryType;
    monthlySalary?: number | null;
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
    salaryType: SalaryType;
    monthlySalary: number | null;
  }>,
  updatedById: string | null,
) =>
  prisma.karigar.update({
    where: { id },
    data: { ...data, updatedById: updatedById ?? undefined },
    include: { workType: true },
  });

export const hardDeleteKarigar = (id: string) => prisma.karigar.delete({ where: { id } });

export const softDeleteKarigar = (id: string, updatedById: string | null) =>
  prisma.karigar.update({
    where: { id },
    data: { deletedAt: new Date(), isActive: false, updatedById: updatedById ?? undefined },
  });
