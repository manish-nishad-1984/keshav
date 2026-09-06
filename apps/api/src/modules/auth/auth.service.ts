import { randomUUID } from 'node:crypto';
import type { PermissionKey } from '@ckfast/types';
import { parseLoginIdentifier } from '@ckfast/shared';
import { env } from '../../lib/env';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../../lib/jwt';
import { hashToken } from '../../lib/tokenHash';
import { parseDurationMs } from '../../lib/duration';
import { comparePassword, hashPassword } from '../../lib/password';
import { badRequest, unauthorized } from '../../lib/httpError';
import * as repo from './auth.repository';
import type { LoginInput, ResetPasswordInput } from './auth.schema';

type UserWithAccess = NonNullable<Awaited<ReturnType<typeof repo.findUserByEmail>>>;

const toPermissions = (user: UserWithAccess): { permissions: PermissionKey[]; roles: string[] } => {
  const permissions = new Set<PermissionKey>();
  const roles: string[] = [];
  for (const userRole of user.roles) {
    roles.push(userRole.role.slug);
    for (const rp of userRole.role.permissions) {
      permissions.add(rp.permission.key as PermissionKey);
    }
  }
  return { permissions: [...permissions], roles };
};

interface RequestMeta {
  ipAddress: string | null;
  userAgent: string | null;
}

const issueTokens = async (user: UserWithAccess, rememberMe: boolean, meta: RequestMeta) => {
  const { permissions, roles } = toPermissions(user);

  const accessToken = signAccessToken({
    sub: user.id,
    email: user.email,
    roles,
    isSuperAdmin: user.isSuperAdmin,
    tv: user.tokenVersion,
  });

  const familyId = randomUUID();
  const jti = randomUUID();
  const refreshTtl = rememberMe ? env.JWT_REFRESH_TTL_LONG : env.JWT_REFRESH_TTL;
  const refreshToken = signRefreshToken(
    { sub: user.id, jti, fam: familyId, tv: user.tokenVersion },
    refreshTtl,
  );

  await repo.createRefreshToken({
    userId: user.id,
    tokenHash: hashToken(refreshToken),
    familyId,
    expiresAt: new Date(Date.now() + parseDurationMs(refreshTtl)),
    userAgent: meta.userAgent,
    ipAddress: meta.ipAddress,
  });

  return { accessToken, refreshToken, refreshTtlMs: parseDurationMs(refreshTtl), permissions, roles };
};

const rotateTokens = async (user: UserWithAccess, familyId: string, meta: RequestMeta) => {
  const { permissions, roles } = toPermissions(user);

  const accessToken = signAccessToken({
    sub: user.id,
    email: user.email,
    roles,
    isSuperAdmin: user.isSuperAdmin,
    tv: user.tokenVersion,
  });

  const jti = randomUUID();
  const refreshToken = signRefreshToken({ sub: user.id, jti, fam: familyId, tv: user.tokenVersion }, env.JWT_REFRESH_TTL);
  const expiresAt = new Date(Date.now() + parseDurationMs(env.JWT_REFRESH_TTL));

  const created = await repo.createRefreshToken({
    userId: user.id,
    tokenHash: hashToken(refreshToken),
    familyId,
    expiresAt,
    userAgent: meta.userAgent,
    ipAddress: meta.ipAddress,
  });

  return { accessToken, refreshToken, refreshTtlMs: parseDurationMs(env.JWT_REFRESH_TTL), createdId: created.id, permissions, roles };
};

export const login = async (input: LoginInput, meta: RequestMeta) => {
  const { kind, value } = parseLoginIdentifier(input.identifier);

  let user: UserWithAccess | null;
  if (kind === 'email') {
    user = await repo.findUserByEmail(value);
  } else {
    const candidates = await repo.findUsersByMobile(value);
    if (candidates.length > 1) {
      throw unauthorized('Multiple accounts share this mobile number. Sign in with your email instead.');
    }
    user = candidates[0] ?? null;
  }

  if (!user || !user.isActive) {
    throw unauthorized('Invalid credentials');
  }

  if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
    const minutesLeft = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60_000);
    throw unauthorized(`Too many attempts. Try again in ${minutesLeft} minute(s).`);
  }

  if (user.status === 'SUSPENDED' || user.status === 'DISABLED') {
    throw unauthorized('Invalid credentials');
  }

  const validPassword = await comparePassword(input.password, user.passwordHash);
  if (!validPassword) {
    await repo.registerFailedLogin(user.id, env.LOGIN_MAX_ATTEMPTS, env.LOGIN_LOCK_MINUTES);
    throw unauthorized('Invalid credentials');
  }

  await repo.registerSuccessfulLogin(user.id, meta.ipAddress);

  const tokens = await issueTokens(user, input.rememberMe, meta);

  return {
    user: {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      isSuperAdmin: user.isSuperAdmin,
      mustChangePassword: user.mustChangePassword,
      permissions: tokens.permissions,
      roles: tokens.roles,
    },
    ...tokens,
  };
};

export const refresh = async (rawToken: string | undefined, meta: RequestMeta) => {
  if (!rawToken) {
    throw unauthorized('Missing refresh token');
  }

  let payload;
  try {
    payload = verifyRefreshToken(rawToken);
  } catch {
    throw unauthorized('Invalid or expired refresh token');
  }

  const tokenHash = hashToken(rawToken);
  const existing = await repo.findRefreshTokenByHash(tokenHash);
  if (!existing) {
    throw unauthorized('Invalid refresh token');
  }

  if (existing.revokedAt) {
    // Reuse of a rotated/revoked token — possible theft. Kill the whole family.
    await repo.revokeFamily(existing.familyId, 'REUSE_DETECTED');
    throw unauthorized('Refresh token reuse detected; all sessions revoked');
  }

  if (existing.expiresAt.getTime() < Date.now()) {
    throw unauthorized('Refresh token expired');
  }

  const user = await repo.findUserById(payload.sub);
  if (!user || !user.isActive || user.tokenVersion !== payload.tv) {
    throw unauthorized('Refresh token no longer valid');
  }

  const rotated = await rotateTokens(user, existing.familyId, meta);
  await repo.revokeRefreshToken(existing.id, 'ROTATED', rotated.createdId);

  return {
    user: {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      isSuperAdmin: user.isSuperAdmin,
      mustChangePassword: user.mustChangePassword,
      permissions: rotated.permissions,
      roles: rotated.roles,
    },
    accessToken: rotated.accessToken,
    refreshToken: rotated.refreshToken,
    refreshTtlMs: rotated.refreshTtlMs,
  };
};

export const logout = async (rawToken: string | undefined) => {
  if (!rawToken) return;
  try {
    const payload = verifyRefreshToken(rawToken);
    await repo.revokeFamily(payload.fam, 'LOGOUT');
  } catch {
    // Already invalid/expired — nothing to revoke.
  }
};

export const logoutEverywhere = async (userId: string) => {
  await repo.logoutEverywhere(userId, 'LOGOUT_EVERYWHERE');
};

const RESET_TOKEN_TTL_MS = 30 * 60_000;

export const forgotPassword = async (identifier: string, ipAddress: string | null) => {
  const { kind, value } = parseLoginIdentifier(identifier);
  const user = kind === 'email' ? await repo.findUserByEmail(value) : (await repo.findUsersByMobile(value))[0];

  if (user && user.isActive) {
    const rawToken = randomUUID() + randomUUID();
    await repo.createPasswordResetToken({
      userId: user.id,
      tokenHash: hashToken(rawToken),
      expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
      ipAddress,
    });
    // In a real deployment this would be emailed/SMSed to the user, never returned to the caller.
  }
  // Response is identical whether or not the account exists, to avoid leaking account existence.
};

export const resetPassword = async (input: ResetPasswordInput) => {
  const tokenHash = hashToken(input.token);
  const resetToken = await repo.findPasswordResetTokenByHash(tokenHash);

  if (!resetToken || resetToken.usedAt || resetToken.expiresAt.getTime() < Date.now()) {
    throw badRequest('This reset link is invalid or has expired');
  }

  const passwordHash = await hashPassword(input.password);
  await repo.updatePassword(resetToken.userId, passwordHash);
  await repo.markPasswordResetTokenUsed(resetToken.id);
  await repo.logoutEverywhere(resetToken.userId, 'PASSWORD_RESET');
};
