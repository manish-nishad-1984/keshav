export const ACTIONS = [
  'view',
  'create',
  'update',
  'delete',
  'export',
  'import',
  'approve',
  'assign',
  'manage',
] as const;
export type ActionKey = (typeof ACTIONS)[number];

const CRUD = ['view', 'create', 'update', 'delete'] as const;

export const MODULE_PERMISSIONS = {
  dashboard: ['view', 'export'],
  users: [...CRUD, 'export'],
  roles: [...CRUD],
  audit_logs: ['view', 'export'],
  notifications: ['view', 'manage'],
  company_settings: ['view', 'update', 'manage'],
  karigars: [...CRUD, 'export', 'manage'],
  items: [...CRUD, 'export', 'manage'],
  production_entries: [...CRUD, 'export'],
  production_history: ['view', 'export'],
  photo_gallery: ['view'],
  payments: [...CRUD],
  reports: ['view', 'export'],
  backups: ['view', 'create', 'manage'],
  // The new project appends its real modules here, one line each, as they're built.
} as const satisfies Record<string, readonly ActionKey[]>;

export type ModuleKey = keyof typeof MODULE_PERMISSIONS;
export type PermissionKey = {
  [M in ModuleKey]: `${M}:${(typeof MODULE_PERMISSIONS)[M][number]}`;
}[ModuleKey];

export const MODULE_KEYS = Object.keys(MODULE_PERMISSIONS) as ModuleKey[];

export const ALL_PERMISSIONS: PermissionKey[] = MODULE_KEYS.flatMap((m) =>
  MODULE_PERMISSIONS[m].map((a) => `${m}:${a}` as PermissionKey),
);

export const permissionKey = <M extends ModuleKey>(
  module: M,
  action: (typeof MODULE_PERMISSIONS)[M][number],
): PermissionKey => `${module}:${action}` as PermissionKey;

export const SYSTEM_ROLES = ['super_admin', 'admin', 'viewer'] as const;
export type SystemRoleSlug = (typeof SYSTEM_ROLES)[number];
