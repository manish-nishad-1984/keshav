export type { ActionKey, ModuleKey, PermissionKey, SystemRoleSlug } from './rbac';
export type { AccessTokenPayload, RefreshTokenPayload } from './auth';
export type { PaginationMeta, Paginated, ApiSuccess, ApiError } from './common';

import * as rbacImpl from './rbac';

export const ACTIONS = rbacImpl.ACTIONS;
export const MODULE_PERMISSIONS = rbacImpl.MODULE_PERMISSIONS;
export const MODULE_KEYS = rbacImpl.MODULE_KEYS;
export const ALL_PERMISSIONS = rbacImpl.ALL_PERMISSIONS;
export const permissionKey = rbacImpl.permissionKey;
export const SYSTEM_ROLES = rbacImpl.SYSTEM_ROLES;
