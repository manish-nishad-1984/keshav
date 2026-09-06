import { z } from 'zod';

export const listRolesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type ListRolesQuery = z.infer<typeof listRolesQuerySchema>;

export const createRoleSchema = z.object({
  name: z.string().min(1),
  slug: z
    .string()
    .min(1)
    .regex(/^[a-z0-9_]+$/, 'Use lowercase letters, numbers and underscores only'),
  description: z.string().optional(),
  permissionKeys: z.array(z.string()).default([]),
});
export type CreateRoleInput = z.infer<typeof createRoleSchema>;

export const updateRoleSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  permissionKeys: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
});
export type UpdateRoleInput = z.infer<typeof updateRoleSchema>;
