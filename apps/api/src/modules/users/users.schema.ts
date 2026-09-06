import { z } from 'zod';

export const listUsersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
});
export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;

export const createUserSchema = z.object({
  fullName: z.string().min(1),
  email: z.string().email(),
  mobile: z.string().optional(),
  branchId: z.string().uuid().optional(),
  employeeCode: z.string().optional(),
  designation: z.string().optional(),
  roleIds: z.array(z.string().uuid()).default([]),
  password: z.string().min(8),
});
export type CreateUserInput = z.infer<typeof createUserSchema>;

export const updateUserSchema = z.object({
  fullName: z.string().min(1).optional(),
  mobile: z.string().optional(),
  branchId: z.string().uuid().nullable().optional(),
  employeeCode: z.string().optional(),
  designation: z.string().optional(),
  roleIds: z.array(z.string().uuid()).optional(),
  status: z.enum(['ACTIVE', 'INVITED', 'SUSPENDED', 'DISABLED']).optional(),
  isActive: z.boolean().optional(),
});
export type UpdateUserInput = z.infer<typeof updateUserSchema>;

export const setUserStatusSchema = z.object({
  status: z.enum(['ACTIVE', 'INVITED', 'SUSPENDED', 'DISABLED']),
});
export type SetUserStatusInput = z.infer<typeof setUserStatusSchema>;
