import { z } from 'zod';

const optionalDetail = z
  .string()
  .trim()
  .optional()
  .nullable()
  .transform((v) => (v ? v : null));

export const createSizeSchema = z.object({
  name: z.string().trim().min(1),
  detail: optionalDetail,
  sortOrder: z.coerce.number().int().min(0).optional(),
});
export type CreateSizeInput = z.infer<typeof createSizeSchema>;

export const updateSizeSchema = z.object({
  name: z.string().trim().min(1).optional(),
  detail: optionalDetail,
  sortOrder: z.coerce.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});
export type UpdateSizeInput = z.infer<typeof updateSizeSchema>;
