import { z } from 'zod';

export const createPatternTypeSchema = z.object({
  name: z.string().min(1),
});
export type CreatePatternTypeInput = z.infer<typeof createPatternTypeSchema>;

export const updatePatternTypeSchema = z.object({
  name: z.string().min(1).optional(),
  isActive: z.boolean().optional(),
});
export type UpdatePatternTypeInput = z.infer<typeof updatePatternTypeSchema>;
