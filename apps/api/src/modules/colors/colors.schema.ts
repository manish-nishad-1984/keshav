import { z } from 'zod';

export const createColorSchema = z.object({
  name: z.string().min(1),
});
export type CreateColorInput = z.infer<typeof createColorSchema>;

export const updateColorSchema = z.object({
  name: z.string().min(1).optional(),
  isActive: z.boolean().optional(),
});
export type UpdateColorInput = z.infer<typeof updateColorSchema>;
