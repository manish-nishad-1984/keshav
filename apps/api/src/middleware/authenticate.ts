import type { NextFunction, Request, Response } from 'express';
import type { PermissionKey } from '@ckfast/types';
import { verifyAccessToken } from '../lib/jwt';
import { prisma } from '../lib/prisma';
import { unauthorized } from '../lib/httpError';
import { setContextActor } from '../lib/requestContext';

export const authenticate = async (req: Request, _res: Response, next: NextFunction) => {
  try {
    const header = req.get('authorization');
    if (!header?.startsWith('Bearer ')) {
      throw unauthorized('Missing access token');
    }
    const token = header.slice('Bearer '.length);

    let payload;
    try {
      payload = verifyAccessToken(token);
    } catch {
      throw unauthorized('Invalid or expired access token');
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      include: {
        roles: {
          include: {
            role: {
              include: {
                permissions: { include: { permission: true } },
              },
            },
          },
        },
      },
    });

    if (!user || !user.isActive || user.status === 'SUSPENDED' || user.status === 'DISABLED') {
      throw unauthorized('Account is not active');
    }

    if (user.tokenVersion !== payload.tv) {
      throw unauthorized('Token has been revoked');
    }

    const permissions = new Set<PermissionKey>();
    const roleSlugs: string[] = [];
    for (const userRole of user.roles) {
      roleSlugs.push(userRole.role.slug);
      for (const rolePermission of userRole.role.permissions) {
        permissions.add(rolePermission.permission.key as PermissionKey);
      }
    }

    req.auth = {
      userId: user.id,
      organizationId: user.organizationId,
      email: user.email,
      isSuperAdmin: user.isSuperAdmin,
      roles: roleSlugs,
      permissions,
      tokenVersion: user.tokenVersion,
    };

    setContextActor({
      actorId: user.id,
      actorEmail: user.email,
      organizationId: user.organizationId,
      permissions,
      isSuperAdmin: user.isSuperAdmin,
    });

    next();
  } catch (err) {
    next(err);
  }
};
