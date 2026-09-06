import { prisma } from '../../lib/prisma';

const userWithAccess = {
  roles: {
    include: {
      role: {
        include: {
          permissions: { include: { permission: true } },
        },
      },
    },
  },
} as const;

export const findUserByEmail = (email: string) =>
  prisma.user.findUnique({ where: { email: email.toLowerCase() }, include: userWithAccess });

export const findUsersByMobile = (mobile: string) =>
  prisma.user.findMany({ where: { mobile, isActive: true }, include: userWithAccess });

export const findUserById = (id: string) =>
  prisma.user.findUnique({ where: { id }, include: userWithAccess });

export const registerFailedLogin = (userId: string, maxAttempts: number, lockMinutes: number) =>
  prisma.$transaction(async (tx) => {
    const user = await tx.user.update({
      where: { id: userId },
      data: { failedLoginAttempts: { increment: 1 } },
    });
    if (user.failedLoginAttempts >= maxAttempts) {
      return tx.user.update({
        where: { id: userId },
        data: { lockedUntil: new Date(Date.now() + lockMinutes * 60_000) },
      });
    }
    return user;
  });

export const registerSuccessfulLogin = (userId: string, ip: string | null) =>
  prisma.user.update({
    where: { id: userId },
    data: {
      failedLoginAttempts: 0,
      lockedUntil: null,
      lastLoginAt: new Date(),
      lastLoginIp: ip ?? undefined,
    },
  });

export const createRefreshToken = (data: {
  userId: string;
  tokenHash: string;
  familyId: string;
  expiresAt: Date;
  userAgent: string | null;
  ipAddress: string | null;
}) => prisma.refreshToken.create({ data });

export const findRefreshTokenByHash = (tokenHash: string) =>
  prisma.refreshToken.findUnique({ where: { tokenHash } });

export const revokeRefreshToken = (id: string, reason: string, replacedByTokenId?: string) =>
  prisma.refreshToken.update({
    where: { id },
    data: { revokedAt: new Date(), revokedReason: reason, replacedByTokenId },
  });

export const revokeFamily = (familyId: string, reason: string) =>
  prisma.refreshToken.updateMany({
    where: { familyId, revokedAt: null },
    data: { revokedAt: new Date(), revokedReason: reason },
  });

export const revokeAllTokensForUser = (userId: string, reason: string) =>
  prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date(), revokedReason: reason },
  });

export const bumpTokenVersion = (userId: string) =>
  prisma.user.update({ where: { id: userId }, data: { tokenVersion: { increment: 1 } } });

export const logoutEverywhere = (userId: string, reason: string) =>
  prisma.$transaction([
    prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date(), revokedReason: reason },
    }),
    prisma.user.update({ where: { id: userId }, data: { tokenVersion: { increment: 1 } } }),
  ]);

export const createPasswordResetToken = (data: { userId: string; tokenHash: string; expiresAt: Date; ipAddress: string | null }) =>
  prisma.passwordResetToken.create({ data });

export const findPasswordResetTokenByHash = (tokenHash: string) =>
  prisma.passwordResetToken.findUnique({ where: { tokenHash } });

export const markPasswordResetTokenUsed = (id: string) =>
  prisma.passwordResetToken.update({ where: { id }, data: { usedAt: new Date() } });

export const updatePassword = (userId: string, passwordHash: string) =>
  prisma.user.update({ where: { id: userId }, data: { passwordHash, mustChangePassword: false } });
