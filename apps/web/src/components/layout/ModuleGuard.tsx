import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import type { ModuleKey } from '@ckfast/types';
import { MODULE_PERMISSIONS } from '@ckfast/types';
import { usePermissions } from '../../hooks/use-permissions';

export const ModuleGuard = ({ moduleKey, children }: { moduleKey: ModuleKey; children: ReactNode }) => {
  const { hasPermission, isSuperAdmin } = usePermissions();

  const allowed =
    isSuperAdmin || MODULE_PERMISSIONS[moduleKey].some((action) => hasPermission(`${moduleKey}:${action}` as never));

  if (!allowed) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};
