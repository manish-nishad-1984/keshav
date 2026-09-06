import { z } from 'zod';

export const createItemCategorySchema = z.object({
  name: z.string().min(1),
  prefix: z
    .string()
    .min(1)
    .max(6)
    .transform((v) => v.toUpperCase()),
});
export type CreateItemCategoryInput = z.infer<typeof createItemCategorySchema>;

export const updateItemCategorySchema = z.object({
  name: z.string().min(1).optional(),
  isActive: z.boolean().optional(),
});
export type UpdateItemCategoryInput = z.infer<typeof updateItemCategorySchema>;
