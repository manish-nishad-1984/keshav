import type { PermissionKey } from '@ckfast/types';

declare global {
  namespace Express {
    interface Request {
      auth?: {
        userId: string;
        organizationId: string;
        email: string;
        isSuperAdmin: boolean;
        roles: string[];
        permissions: ReadonlySet<PermissionKey>;
        tokenVersion: number;
      };
    }
  }
}

export {};
