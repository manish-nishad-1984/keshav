import { z } from 'zod';

export const createBookSchema = z.object({
  name: z.string().trim().min(1),
  startNumber: z.coerce.number().int().min(1).default(1),
  isActive: z.boolean().optional(),
});
export type CreateBookInput = z.infer<typeof createBookSchema>;

export const updateBookSchema = z.object({
  name: z.string().trim().min(1).optional(),
  startNumber: z.coerce.number().int().min(1).optional(),
  isActive: z.boolean().optional(),
});
export type UpdateBookInput = z.infer<typeof updateBookSchema>;
