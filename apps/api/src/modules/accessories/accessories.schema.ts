import { z } from 'zod';

export const createAccessorySchema = z.object({
  name: z.string().trim().min(1),
  unit: z.string().trim().min(1).max(20).default('pcs'),
});
export type CreateAccessoryInput = z.infer<typeof createAccessorySchema>;

export const updateAccessorySchema = z.object({
  name: z.string().trim().min(1).optional(),
  unit: z.string().trim().min(1).max(20).optional(),
  isActive: z.boolean().optional(),
});
export type UpdateAccessoryInput = z.infer<typeof updateAccessorySchema>;

// The full per-piece list for one design; replaces whatever was there.
export const setDesignAccessoriesSchema = z.object({
  lines: z
    .array(
      z.object({
        accessoryId: z.string().uuid(),
        quantityPerPiece: z.coerce.number().positive().max(9999999),
      }),
    )
    .refine((lines) => new Set(lines.map((l) => l.accessoryId)).size === lines.length, {
      message: 'An accessory can appear only once per design',
    }),
});
export type SetDesignAccessoriesInput = z.infer<typeof setDesignAccessoriesSchema>;
