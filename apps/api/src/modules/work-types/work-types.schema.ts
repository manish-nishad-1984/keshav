import { z } from 'zod';

export const createWorkTypeSchema = z.object({
  name: z.string().min(1),
});
export type CreateWorkTypeInput = z.infer<typeof createWorkTypeSchema>;

export const updateWorkTypeSchema = z.object({
  name: z.string().min(1).optional(),
  isActive: z.boolean().optional(),
});
export type UpdateWorkTypeInput = z.infer<typeof updateWorkTypeSchema>;
