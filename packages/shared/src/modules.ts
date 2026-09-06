import type { ModuleKey, PermissionKey } from '@ckfast/types';

export type NavGroupKey = 'general' | 'admin';

export const NAV_GROUPS: { key: NavGroupKey; label: string }[] = [
  { key: 'general', label: 'General' },
  { key: 'admin', label: 'Administration' },
];

export interface ModuleDefinition {
  key: ModuleKey;
  label: string;
  singular: string;
  path: string;
  icon: string;
  group: NavGroupKey;
  order: number;
  permission: PermissionKey;
  description: string;
  hiddenInNav?: boolean;
}

export const MODULES: ModuleDefinition[] = [
  {
    key: 'dashboard',
    label: 'Dashboard',
    singular: 'Dashboard',
    path: '/dashboard',
    icon: 'LayoutDashboard',
    group: 'general',
    order: 1,
    permission: 'dashboard:view',
    description: 'Overview.',
  },
  {
    key: 'karigars',
    label: 'Karigar Master',
    singular: 'Karigar',
    path: '/karigars',
    icon: 'Shirt',
    group: 'general',
    order: 10,
    permission: 'karigars:view',
    description: 'Workers who stitch, cut, finish and pack garments.',
  },
  {
    key: 'production_entries',
    label: 'Daily Entry',
    singular: 'Production Entry',
    path: '/production-entries',
    icon: 'ClipboardList',
    group: 'general',
    order: 15,
    permission: 'production_entries:view',
    description: 'Daily production logged per karigar, item, and quantity.',
  },
  {
    key: 'production_history',
    label: 'Production History',
    singular: 'Production Entry',
    path: '/production-history',
    icon: 'ScrollText',
    group: 'general',
    order: 17,
    permission: 'production_history:view',
    description: 'Search and review past production entries.',
  },
  {
    key: 'photo_gallery',
    label: 'Photo Gallery',
    singular: 'Photo',
    path: '/photo-gallery',
    icon: 'Images',
    group: 'general',
    order: 18,
    permission: 'photo_gallery:view',
    description: 'Browse production photos by date, karigar, or item.',
  },
  {
    key: 'payments',
    label: 'Payment / Ledger',
    singular: 'Payment',
    path: '/payments',
    icon: 'Wallet',
    group: 'general',
    order: 19,
    permission: 'payments:view',
    description: 'Per-karigar payment ledger and payment entries.',
  },
  {
    key: 'reports',
    label: 'Reports',
    singular: 'Report',
    path: '/reports',
    icon: 'FileBarChart',
    group: 'general',
    order: 20,
    permission: 'reports:view',
    description: 'Production, karigar, item, and payment reports.',
  },
  {
    key: 'items',
    label: 'Item / Design Master',
    singular: 'Item',
    path: '/items',
    icon: 'Layers',
    group: 'general',
    order: 21,
    permission: 'items:view',
    description: 'Style/item catalog with auto-generated style numbers.',
  },
  {
    key: 'company_settings',
    label: 'Settings',
    singular: 'Setting',
    path: '/settings',
    icon: 'Settings',
    group: 'general',
    order: 30,
    permission: 'company_settings:view',
    description: 'Company info, work types, and general configuration.',
  },
  {
    key: 'users',
    label: 'Users',
    singular: 'User',
    path: '/users',
    icon: 'Users',
    group: 'admin',
    order: 90,
    permission: 'users:view',
    description: 'People with access.',
  },
  {
    key: 'roles',
    label: 'Roles',
    singular: 'Role',
    path: '/roles',
    icon: 'ShieldCheck',
    group: 'admin',
    order: 91,
    permission: 'roles:view',
    description: 'Permission sets.',
  },
  {
    key: 'audit_logs',
    label: 'Audit Log',
    singular: 'Audit Entry',
    path: '/audit-logs',
    icon: 'History',
    group: 'admin',
    order: 92,
    permission: 'audit_logs:view',
    description: 'Who did what, when.',
  },
  // The new project appends its real modules here as they're built — same array, same shape.
];

export const getModule = (key: ModuleKey) => MODULES.find((m) => m.key === key);

export const getModulesByGroup = (group: NavGroupKey) =>
  MODULES.filter((m) => m.group === group && !m.hiddenInNav);

export const getModuleByPath = (path: string) =>
  [...MODULES]
    .sort((a, b) => b.path.length - a.path.length)
    .find((m) => path.startsWith(m.path));
