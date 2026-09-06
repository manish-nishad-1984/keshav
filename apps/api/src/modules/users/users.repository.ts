import { prisma } from '../../lib/prisma';
import type { Prisma } from '@prisma/client';

const include = {
  branch: true,
  roles: { include: { role: true } },
} as const;

export const listUsers = async (organizationId: string, page: number, pageSize: number, search?: string) => {
  const where: Prisma.UserWhereInput = {
    organizationId,
    deletedAt: null,
    ...(search
      ? {
          OR: [
            { fullName: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.user.findMany({
      where,
      include,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.user.count({ where }),
  ]);

  return { items, total };
};

export const findUserById = (organizationId: string, id: string) =>
  prisma.user.findFirst({ where: { id, organizationId, deletedAt: null }, include });

export const findUserByEmail = (email: string) => prisma.user.findUnique({ where: { email: email.toLowerCase() } });

export const createUser = (
  organizationId: string,
  data: {
    fullName: string;
    email: string;
    mobile?: string;
    branchId?: string;
    employeeCode?: string;
    designation?: string;
    passwordHash: string;
    roleIds: string[];
  },
  createdById: string | null,
) =>
  prisma.user.create({
    data: {
      organizationId,
      fullName: data.fullName,
      email: data.email.toLowerCase(),
      mobile: data.mobile,
      branchId: data.branchId,
      employeeCode: data.employeeCode,
      designation: data.designation,
      passwordHash: data.passwordHash,
      status: 'INVITED',
      mustChangePassword: true,
      createdById: createdById ?? undefined,
      roles: {
        create: data.roleIds.map((roleId) => ({ roleId, createdById: createdById ?? undefined })),
      },
    },
    include,
  });

export const updateUser = (
  organizationId: string,
  id: string,
  data: Partial<{
    fullName: string;
    mobile: string | null;
    branchId: string | null;
    employeeCode: string;
    designation: string;
    status: 'ACTIVE' | 'INVITED' | 'SUSPENDED' | 'DISABLED';
    isActive: boolean;
    roleIds: string[];
  }>,
  updatedById: string | null,
) =>
  prisma.$transaction(async (tx) => {
    const { roleIds, ...rest } = data;
    const user = await tx.user.update({
      where: { id },
      data: { ...rest, updatedById: updatedById ?? undefined },
    });

    if (roleIds) {
      await tx.userRole.deleteMany({ where: { userId: id } });
      await tx.userRole.createMany({
        data: roleIds.map((roleId) => ({ userId: id, roleId, createdById: updatedById ?? undefined })),
        skipDuplicates: true,
      });
    }

    return tx.user.findFirstOrThrow({ where: { id, organizationId }, include });
  });

export const softDeleteUser = (id: string, updatedById: string | null) =>
  prisma.user.update({
    where: { id },
    data: { deletedAt: new Date(), isActive: false, updatedById: updatedById ?? undefined },
  });

export const setStatus = (
  organizationId: string,
  id: string,
  status: 'ACTIVE' | 'INVITED' | 'SUSPENDED' | 'DISABLED',
  updatedById: string | null,
) =>
  prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id }, data: { status, updatedById: updatedById ?? undefined } });
    if (status === 'SUSPENDED' || status === 'DISABLED') {
      await tx.refreshToken.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: new Date(), revokedReason: 'STATUS_CHANGE' },
      });
    }
    return tx.user.findFirstOrThrow({ where: { id, organizationId }, include });
  });

export const resetPassword = (id: string, passwordHash: string) =>
  prisma.$transaction([
    prisma.user.update({
      where: { id },
      data: { passwordHash, mustChangePassword: true, tokenVersion: { increment: 1 } },
    }),
    prisma.refreshToken.updateMany({
      where: { userId: id, revokedAt: null },
      data: { revokedAt: new Date(), revokedReason: 'PASSWORD_RESET' },
    }),
  ]);
