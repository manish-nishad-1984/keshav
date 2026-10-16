import { z } from 'zod';
import { nameSchema } from '../../lib/names';

export const createWorkTypeSchema = z.object({
  name: nameSchema,
});
export type CreateWorkTypeInput = z.infer<typeof createWorkTypeSchema>;

export const updateWorkTypeSchema = z.object({
  name: nameSchema.optional(),
  isActive: z.boolean().optional(),
});
export type UpdateWorkTypeInput = z.infer<typeof updateWorkTypeSchema>;
