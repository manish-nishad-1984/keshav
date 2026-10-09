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
    key: 'cutting',
    label: 'Cutting',
    singular: 'Cutting Entry',
    path: '/cutting',
    icon: 'Scissors',
    group: 'general',
    order: 12,
    permission: 'cutting:view',
    description: 'Fabric cutting lots — the starting point of production.',
  },
  {
    key: 'cutting_distribution',
    label: 'Cutting Distribution',
    singular: 'Distribution',
    path: '/cutting-distribution',
    icon: 'PackageOpen',
    group: 'general',
    order: 13,
    permission: 'cutting_distribution:view',
    description: 'Cut pieces of a lot handed to karigars, by colour and size.',
  },
  {
    key: 'accessory_issues',
    label: 'Accessory Issue',
    singular: 'Accessory Issue',
    path: '/accessory-issues',
    icon: 'PackagePlus',
    group: 'general',
    order: 14,
    permission: 'accessory_issues:view',
    description: 'Accessories given to karigars against the lots they took, and what they still hold.',
  },
  {
    key: 'accessories',
    label: 'Accessory Master',
    singular: 'Accessory',
    path: '/accessories',
    icon: 'Package',
    group: 'general',
    order: 24,
    permission: 'accessories:view',
    description: 'Zips, locks, chains… and how many each design needs per piece.',
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
    key: 'press_entries',
    label: 'Press Entry',
    singular: 'Press Entry',
    path: '/press-entries',
    icon: 'Shirt',
    group: 'general',
    order: 16,
    permission: 'press_entries:view',
    description: 'Pieces ironed by press karigars, at the online / offline rate from Settings.',
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
    key: 'deliveries',
    label: 'Delivery',
    singular: 'Delivery',
    path: '/deliveries',
    icon: 'Truck',
    group: 'general',
    order: 18,
    permission: 'deliveries:view',
    description: 'Finished pieces of a lot sent to its party, by colour and size, with a challan.',
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
    description: 'Design catalog used by cutting and production entries.',
  },
  {
    key: 'parties',
    label: 'Party Master',
    singular: 'Party',
    path: '/parties',
    icon: 'Handshake',
    group: 'general',
    order: 22,
    permission: 'parties:view',
    description: 'Parties that cutting lots are made for.',
  },
  {
    key: 'books',
    label: 'Book Master',
    singular: 'Book',
    path: '/books',
    icon: 'BookOpen',
    group: 'general',
    order: 23,
    permission: 'books:view',
    description: 'Lot number series per book (e.g. 2025-26), selected in the header.',
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
