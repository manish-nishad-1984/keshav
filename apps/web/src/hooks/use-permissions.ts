import { useAuth } from '../context/AuthContext';

export const usePermissions = () => {
  const { user, hasPermission } = useAuth();
  return {
    permissions: user?.permissions ?? [],
    isSuperAdmin: user?.isSuperAdmin ?? false,
    hasPermission,
  };
};
