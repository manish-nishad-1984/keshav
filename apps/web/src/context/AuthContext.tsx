import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { PermissionKey } from '@ckfast/types';
import { apiClient, setAccessToken, setUnauthorizedHandler } from '../lib/api-client';

export interface AuthUser {
  id: string;
  fullName: string;
  email: string;
  isSuperAdmin: boolean;
  mustChangePassword: boolean;
  roles: string[];
  permissions: PermissionKey[];
}

interface LoginResponse {
  accessToken: string;
  user: AuthUser;
}

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  login: (identifier: string, password: string, rememberMe: boolean) => Promise<void>;
  logout: () => Promise<void>;
  hasPermission: (permission: PermissionKey) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const clearSession = useCallback(() => {
    setAccessToken(null);
    setUser(null);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(clearSession);
    return () => setUnauthorizedHandler(null);
  }, [clearSession]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await apiClient.post<LoginResponse>('/auth/refresh');
        if (!cancelled) {
          setAccessToken(result.accessToken);
          setUser(result.user);
        }
      } catch {
        if (!cancelled) clearSession();
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [clearSession]);

  const login = useCallback(async (identifier: string, password: string, rememberMe: boolean) => {
    const result = await apiClient.post<LoginResponse>('/auth/login', { identifier, password, rememberMe });
    setAccessToken(result.accessToken);
    setUser(result.user);
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiClient.post('/auth/logout');
    } finally {
      clearSession();
    }
  }, [clearSession]);

  const hasPermission = useCallback(
    (permission: PermissionKey) => Boolean(user?.isSuperAdmin) || Boolean(user?.permissions.includes(permission)),
    [user],
  );

  const value = useMemo(
    () => ({ user, isLoading, login, logout, hasPermission }),
    [user, isLoading, login, logout, hasPermission],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
};
