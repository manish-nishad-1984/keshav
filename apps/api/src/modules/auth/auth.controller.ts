import type { Request, Response } from 'express';
import { env } from '../../lib/env';
import { ok } from '../../lib/response';
import { forgotPasswordSchema, loginSchema, resetPasswordSchema } from './auth.schema';
import * as authService from './auth.service';

const REFRESH_COOKIE = 'refreshToken';
const REFRESH_COOKIE_PATH = `${env.API_PREFIX}/auth`;

const setRefreshCookie = (res: Response, token: string, maxAgeMs: number) => {
  res.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.COOKIE_SECURE,
    path: REFRESH_COOKIE_PATH,
    maxAge: maxAgeMs,
  });
};

const clearRefreshCookie = (res: Response) => {
  res.clearCookie(REFRESH_COOKIE, { path: REFRESH_COOKIE_PATH });
};

const meta = (req: Request) => ({
  ipAddress: req.ip ?? null,
  userAgent: req.get('user-agent') ?? null,
});

export const login = async (req: Request, res: Response) => {
  const input = loginSchema.parse(req.body);
  const result = await authService.login(input, meta(req));
  setRefreshCookie(res, result.refreshToken, result.refreshTtlMs);
  ok(res, { accessToken: result.accessToken, user: result.user });
};

export const refresh = async (req: Request, res: Response) => {
  const rawToken = req.cookies?.[REFRESH_COOKIE] as string | undefined;
  const result = await authService.refresh(rawToken, meta(req));
  setRefreshCookie(res, result.refreshToken, result.refreshTtlMs);
  ok(res, { accessToken: result.accessToken, user: result.user });
};

export const logout = async (req: Request, res: Response) => {
  const rawToken = req.cookies?.[REFRESH_COOKIE] as string | undefined;
  await authService.logout(rawToken);
  clearRefreshCookie(res);
  ok(res, { loggedOut: true });
};

export const logoutEverywhere = async (req: Request, res: Response) => {
  await authService.logoutEverywhere(req.auth!.userId);
  clearRefreshCookie(res);
  ok(res, { loggedOut: true });
};

export const forgotPassword = async (req: Request, res: Response) => {
  const input = forgotPasswordSchema.parse(req.body);
  await authService.forgotPassword(input.identifier, req.ip ?? null);
  ok(res, { message: 'If an account exists, password reset instructions have been sent.' });
};

export const resetPassword = async (req: Request, res: Response) => {
  const input = resetPasswordSchema.parse(req.body);
  await authService.resetPassword(input);
  ok(res, { message: 'Password has been reset. Please sign in again.' });
};

export const me = async (req: Request, res: Response) => {
  ok(res, {
    id: req.auth!.userId,
    email: req.auth!.email,
    isSuperAdmin: req.auth!.isSuperAdmin,
    roles: req.auth!.roles,
    permissions: [...req.auth!.permissions],
  });
};
