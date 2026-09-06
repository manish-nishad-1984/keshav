import type { ComponentType } from 'react';
import { Route } from 'react-router-dom';
import type { ModuleKey } from '@ckfast/types';
import { MODULES } from '@ckfast/shared';
import { ModuleGuard } from '../components/layout/ModuleGuard';
import { ModulePlaceholder } from '../components/layout/ModulePlaceholder';
import { DashboardPage } from '../pages/DashboardPage';
import { UsersPage } from '../pages/UsersPage';
import { RolesPage } from '../pages/RolesPage';
import { AuditLogsPage } from '../pages/AuditLogsPage';
import { KarigarsPage } from '../pages/KarigarsPage';
import { ItemsPage } from '../pages/ItemsPage';
import { SettingsPage } from '../pages/SettingsPage';
import { ProductionEntryPage } from '../pages/ProductionEntryPage';
import { ProductionHistoryPage } from '../pages/ProductionHistoryPage';
import { PhotoGalleryPage } from '../pages/PhotoGalleryPage';
import { PaymentsPage } from '../pages/PaymentsPage';
import { ReportsPage } from '../pages/ReportsPage';

// Every module gets a route automatically. Add a page here once it's built;
// anything missing falls back to a placeholder — the router never needs editing.
const MODULE_PAGES: Partial<Record<ModuleKey, ComponentType>> = {
  dashboard: DashboardPage,
  users: UsersPage,
  roles: RolesPage,
  audit_logs: AuditLogsPage,
  karigars: KarigarsPage,
  items: ItemsPage,
  company_settings: SettingsPage,
  production_entries: ProductionEntryPage,
  production_history: ProductionHistoryPage,
  photo_gallery: PhotoGalleryPage,
  payments: PaymentsPage,
  reports: ReportsPage,
};

export const moduleRoutes = MODULES.map((module) => {
  const Page = MODULE_PAGES[module.key];
  return (
    <Route
      key={module.key}
      path={module.path}
      element={
        <ModuleGuard moduleKey={module.key}>{Page ? <Page /> : <ModulePlaceholder module={module} />}</ModuleGuard>
      }
    />
  );
});
