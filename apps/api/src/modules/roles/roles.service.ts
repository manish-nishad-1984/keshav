import { MODULE_PERMISSIONS } from '@ckfast/types';
import { badRequest, conflict, forbidden, notFound } from '../../lib/httpError';
import * as repo from './roles.repository';
import type { CreateRoleInput, UpdateRoleInput } from './roles.schema';

export const listRoles = (organizationId: string, page: number, pageSize: number) =>
  repo.listRoles(organizationId, page, pageSize);

export const getRole = async (organizationId: string, id: string) => {
  const role = await repo.findRoleById(organizationId, id);
  if (!role) throw notFound('Role not found');
  return role;
};

export const createRole = async (organizationId: string, input: CreateRoleInput, actorId: string | null) => {
  const existing = await repo.findRoleBySlug(organizationId, input.slug);
  if (existing) throw conflict('A role with this slug already exists');

  const permissions = await repo.findPermissionsByKeys(input.permissionKeys);
  if (permissions.length !== input.permissionKeys.length) {
    throw badRequest('One or more permission keys are invalid');
  }

  return repo.createRole(
    organizationId,
    { name: input.name, slug: input.slug, description: input.description, permissionIds: permissions.map((p) => p.id) },
    actorId,
  );
};

export const updateRole = async (organizationId: string, id: string, input: UpdateRoleInput, actorId: string | null) => {
  const role = await getRole(organizationId, id);
  if (role.isSystem && (input.isActive === false)) {
    throw forbidden('System roles cannot be deactivated');
  }

  let permissionIds: string[] | undefined;
  if (input.permissionKeys) {
    const permissions = await repo.findPermissionsByKeys(input.permissionKeys);
    if (permissions.length !== input.permissionKeys.length) {
      throw badRequest('One or more permission keys are invalid');
    }
    permissionIds = permissions.map((p) => p.id);
  }

  return repo.updateRole(
    organizationId,
    id,
    { name: input.name, description: input.description, isActive: input.isActive },
    permissionIds,
    actorId,
  );
};

export const deleteRole = async (organizationId: string, id: string) => {
  const role = await getRole(organizationId, id);
  if (role.isSystem) throw forbidden('System roles cannot be deleted');
  const userCount = await repo.countUsersWithRole(id);
  if (userCount > 0) throw conflict('Reassign the users on this role before deleting it');
  await repo.softDeleteRole(id);
};

// Not a database query — the catalog is the TS source of truth in `@ckfast/types`, so the
// frontend always shows exactly the permissions that exist in code, nothing to keep in sync by hand.
export const getPermissionCatalog = () => MODULE_PERMISSIONS;
