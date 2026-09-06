import jwt, { type SignOptions } from 'jsonwebtoken';
import type { AccessTokenPayload, RefreshTokenPayload } from '@ckfast/types';
import { env } from './env';

const ACCESS_AUDIENCE = 'ck-fast-access';
const REFRESH_AUDIENCE = 'ck-fast-refresh';

const asExpiresIn = (value: string) => value as SignOptions['expiresIn'];

export const signAccessToken = (payload: Omit<AccessTokenPayload, 'iat' | 'exp'>): string =>
  jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    issuer: env.JWT_ISSUER,
    audience: ACCESS_AUDIENCE,
    expiresIn: asExpiresIn(env.JWT_ACCESS_TTL),
  });

export const verifyAccessToken = (token: string): AccessTokenPayload =>
  jwt.verify(token, env.JWT_ACCESS_SECRET, {
    issuer: env.JWT_ISSUER,
    audience: ACCESS_AUDIENCE,
  }) as AccessTokenPayload;

export const signRefreshToken = (
  payload: Omit<RefreshTokenPayload, 'iat' | 'exp'>,
  ttl: string,
): string =>
  jwt.sign(payload, env.JWT_REFRESH_SECRET, {
    issuer: env.JWT_ISSUER,
    audience: REFRESH_AUDIENCE,
    expiresIn: asExpiresIn(ttl),
  });

export const verifyRefreshToken = (token: string): RefreshTokenPayload =>
  jwt.verify(token, env.JWT_REFRESH_SECRET, {
    issuer: env.JWT_ISSUER,
    audience: REFRESH_AUDIENCE,
  }) as RefreshTokenPayload;
