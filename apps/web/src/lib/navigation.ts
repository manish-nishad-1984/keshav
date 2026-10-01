import { useLocation } from 'react-router-dom';
import { MODULES, type ModuleDefinition } from '@ckfast/shared';
import type { ModuleKey } from '@ckfast/types';
import { usePermissions } from '../hooks/use-permissions';

// Sidebar grouping for the app shell. Module definitions (paths, permissions, icons) still come
// from @ckfast/shared; this only decides how they're grouped in the navigation. Settings is
// deliberately absent — it lives behind the gear button in the topbar.
interface NavSectionDefinition {
  key: string;
  label: string;
  icon: string;
  modules: ModuleKey[];
}

const SECTION_DEFINITIONS: NavSectionDefinition[] = [
  { key: 'dashboard', label: 'Dashboard', icon: 'House', modules: ['dashboard'] },
  { key: 'masters', label: 'Masters', icon: 'Database', modules: ['karigars', 'items'] },
  { key: 'cutting', label: 'Cutting', icon: 'Scissors', modules: ['cutting'] },
  { key: 'production', label: 'Production', icon: 'Factory', modules: ['production_entries', 'production_history', 'photo_gallery'] },
  { key: 'payments', label: 'Payments', icon: 'Wallet', modules: ['payments'] },
  { key: 'reports', label: 'Reports', icon: 'ChartColumn', modules: ['reports'] },
  { key: 'admin', label: 'Admin', icon: 'ShieldCheck', modules: ['users', 'roles', 'audit_logs'] },
];

const SETTINGS_KEY: ModuleKey = 'company_settings';

// Short labels for child links / contextual tabs, where the section name already gives context.
const SHORT_LABELS: Partial<Record<ModuleKey, string>> = {
  karigars: 'Karigars',
  items: 'Items / Designs',
  production_entries: 'Daily Entry',
  production_history: 'History',
  photo_gallery: 'Photo Gallery',
  payments: 'Payment / Ledger',
  audit_logs: 'Audit Log',
};

export const shortLabel = (module: ModuleDefinition) => SHORT_LABELS[module.key] ?? module.label;

export interface NavSection {
  key: string;
  label: string;
  icon: string;
  modules: ModuleDefinition[];
}

const byKey = new Map(MODULES.map((m) => [m.key, m]));

// Any module not placed in a section above (e.g. one added later) still gets its own entry, so
// nothing becomes unreachable.
const ALL_SECTIONS: NavSection[] = [
  ...SECTION_DEFINITIONS.map((s) => ({
    ...s,
    modules: s.modules.map((k) => byKey.get(k)).filter((m): m is ModuleDefinition => Boolean(m)),
  })),
  ...MODULES.filter(
    (m) => !m.hiddenInNav && m.key !== SETTINGS_KEY && !SECTION_DEFINITIONS.some((s) => s.modules.includes(m.key)),
  ).map((m) => ({ key: m.key, label: m.label, icon: m.icon, modules: [m] })),
];

const isActivePath = (pathname: string, module: ModuleDefinition) =>
  pathname === module.path || pathname.startsWith(`${module.path}/`);

/** Navigation filtered to what the current user may see, plus what's active. */
export const useNavigation = () => {
  const { pathname } = useLocation();
  const { hasPermission, isSuperAdmin } = usePermissions();
  const canSee = (m: ModuleDefinition) => !m.hiddenInNav && (isSuperAdmin || hasPermission(m.permission));

  const sections = ALL_SECTIONS.map((s) => ({ ...s, modules: s.modules.filter(canSee) })).filter(
    (s) => s.modules.length > 0,
  );
  const activeModule = MODULES.find((m) => isActivePath(pathname, m));
  const activeSection = sections.find((s) => s.modules.some((m) => m.key === activeModule?.key));
  const settingsModule = byKey.get(SETTINGS_KEY);
  const canSeeSettings = Boolean(settingsModule && (isSuperAdmin || hasPermission(settingsModule.permission)));

  return { sections, activeModule, activeSection, settingsModule, canSeeSettings };
};
