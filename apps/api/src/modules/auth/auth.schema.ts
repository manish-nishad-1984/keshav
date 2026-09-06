import { z } from 'zod';

export const loginSchema = z.object({
  identifier: z.string().min(1, 'Email or mobile is required'),
  password: z.string().min(1, 'Password is required'),
  rememberMe: z.boolean().optional().default(false),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const forgotPasswordSchema = z.object({
  identifier: z.string().min(1, 'Email or mobile is required'),
});
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
