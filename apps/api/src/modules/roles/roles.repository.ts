import { prisma } from '../../lib/prisma';

const include = {
  permissions: { include: { permission: true } },
  _count: { select: { users: true } },
} as const;

export const listRoles = async (organizationId: string, page: number, pageSize: number) => {
  const where = { organizationId, deletedAt: null };
  const [items, total] = await Promise.all([
    prisma.role.findMany({
      where,
      include,
      orderBy: { createdAt: 'asc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.role.count({ where }),
  ]);
  return { items, total };
};

export const findRoleById = (organizationId: string, id: string) =>
  prisma.role.findFirst({ where: { id, organizationId, deletedAt: null }, include });

export const findRoleBySlug = (organizationId: string, slug: string) =>
  prisma.role.findUnique({ where: { organizationId_slug: { organizationId, slug } } });

export const findPermissionsByKeys = (keys: string[]) =>
  prisma.permission.findMany({ where: { key: { in: keys } } });

export const createRole = (
  organizationId: string,
  data: { name: string; slug: string; description?: string; permissionIds: string[] },
  createdById: string | null,
) =>
  prisma.role.create({
    data: {
      organizationId,
      name: data.name,
      slug: data.slug,
      description: data.description,
      permissions: {
        create: data.permissionIds.map((permissionId) => ({ permissionId, createdById: createdById ?? undefined })),
      },
    },
    include,
  });

export const updateRole = (
  organizationId: string,
  id: string,
  data: Partial<{ name: string; description: string; isActive: boolean }>,
  permissionIds: string[] | undefined,
  updatedById: string | null,
) =>
  prisma.$transaction(async (tx) => {
    await tx.role.update({ where: { id }, data });

    if (permissionIds) {
      await tx.rolePermission.deleteMany({ where: { roleId: id } });
      await tx.rolePermission.createMany({
        data: permissionIds.map((permissionId) => ({ roleId: id, permissionId, createdById: updatedById ?? undefined })),
        skipDuplicates: true,
      });
    }

    return tx.role.findFirstOrThrow({ where: { id, organizationId }, include });
  });

export const softDeleteRole = (id: string) => prisma.role.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } });

export const countUsersWithRole = (roleId: string) => prisma.userRole.count({ where: { roleId } });
