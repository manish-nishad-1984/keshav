import type { NextFunction, Request, Response } from 'express';
import type { ModuleKey, PermissionKey } from '@ckfast/types';
import { MODULE_PERMISSIONS } from '@ckfast/types';
import { forbidden, unauthorized } from '../lib/httpError';

const requireAuth = (req: Request) => {
  if (!req.auth) {
    throw unauthorized();
  }
  return req.auth;
};

export const requirePermission =
  (...permissions: PermissionKey[]) =>
  (req: Request, _res: Response, next: NextFunction) => {
    try {
      const auth = requireAuth(req);
      if (auth.isSuperAdmin || permissions.some((p) => auth.permissions.has(p))) {
        return next();
      }
      throw forbidden('You do not have permission to perform this action');
    } catch (err) {
      next(err);
    }
  };

export const requireAllPermissions =
  (...permissions: PermissionKey[]) =>
  (req: Request, _res: Response, next: NextFunction) => {
    try {
      const auth = requireAuth(req);
      if (auth.isSuperAdmin || permissions.every((p) => auth.permissions.has(p))) {
        return next();
      }
      throw forbidden('You do not have permission to perform this action');
    } catch (err) {
      next(err);
    }
  };

export const requireModuleAccess =
  (moduleKey: ModuleKey) => (req: Request, _res: Response, next: NextFunction) => {
    try {
      const auth = requireAuth(req);
      if (auth.isSuperAdmin) {
        return next();
      }
      const modulePermissions = MODULE_PERMISSIONS[moduleKey].map((a) => `${moduleKey}:${a}` as PermissionKey);
      if (modulePermissions.some((p) => auth.permissions.has(p))) {
        return next();
      }
      throw forbidden('You do not have access to this module');
    } catch (err) {
      next(err);
    }
  };

export const requireRole =
  (...slugs: string[]) =>
  (req: Request, _res: Response, next: NextFunction) => {
    try {
      const auth = requireAuth(req);
      if (auth.isSuperAdmin || slugs.some((s) => auth.roles.includes(s))) {
        return next();
      }
      throw forbidden('You do not have the required role');
    } catch (err) {
      next(err);
    }
  };

export const requireSuperAdmin = (req: Request, _res: Response, next: NextFunction) => {
  try {
    const auth = requireAuth(req);
    if (auth.isSuperAdmin) {
      return next();
    }
    throw forbidden('Super admin access required');
  } catch (err) {
    next(err);
  }
};
