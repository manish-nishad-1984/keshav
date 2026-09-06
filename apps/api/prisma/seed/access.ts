import type { PrismaClient } from '@prisma/client';
import { ALL_PERMISSIONS, MODULE_KEYS, MODULE_PERMISSIONS } from '@ckfast/types';
import type { ModuleKey } from '@ckfast/types';

export const seedPermissions = async (prisma: PrismaClient) => {
  const rows = ALL_PERMISSIONS.map((key) => {
    const [module, action] = key.split(':');
    return { key, module, action };
  });

  await prisma.permission.createMany({ data: rows, skipDuplicates: true });
  await prisma.permission.deleteMany({ where: { key: { notIn: ALL_PERMISSIONS } } });

  const all = await prisma.permission.findMany();
  return new Map(all.map((p) => [p.key, p.id]));
};

const all = (moduleKey: ModuleKey) => MODULE_PERMISSIONS[moduleKey].map((a) => `${moduleKey}:${a}`);
const only = (moduleKey: ModuleKey, ...actions: string[]) => actions.map((a) => `${moduleKey}:${a}`);

interface RoleSeed {
  slug: string;
  name: string;
  description: string;
  permissions: string[];
}

const ROLE_SEEDS: RoleSeed[] = [
  {
    slug: 'super_admin',
    name: 'Super Administrator',
    description: 'Bypasses every check.',
    permissions: ALL_PERMISSIONS,
  },
  {
    slug: 'admin',
    name: 'Administrator',
    description: 'Full access, no bypass flag.',
    permissions: ALL_PERMISSIONS,
  },
  {
    slug: 'viewer',
    name: 'Viewer',
    description: 'Read-only everywhere.',
    permissions: MODULE_KEYS.flatMap((m) => only(m, 'view')),
  },
];

export const seedRoles = async (prisma: PrismaClient, organizationId: string, permissionIds: Map<string, string>) => {
  for (const seed of ROLE_SEEDS) {
    const role = await prisma.role.upsert({
      where: { organizationId_slug: { organizationId, slug: seed.slug } },
      create: {
        organizationId,
        slug: seed.slug,
        name: seed.name,
        description: seed.description,
        isSystem: true,
      },
      update: { name: seed.name, description: seed.description, isSystem: true },
    });

    const desiredIds = seed.permissions.map((k) => permissionIds.get(k)).filter((id): id is string => Boolean(id));

    await prisma.rolePermission.deleteMany({ where: { roleId: role.id, permissionId: { notIn: desiredIds } } });
    await prisma.rolePermission.createMany({
      data: desiredIds.map((permissionId) => ({ roleId: role.id, permissionId })),
      skipDuplicates: true,
    });
  }
};

export { all };
