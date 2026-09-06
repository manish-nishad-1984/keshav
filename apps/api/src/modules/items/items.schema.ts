import { z } from 'zod';

export const listItemsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  categoryId: z.string().uuid().optional(),
});
export type ListItemsQuery = z.infer<typeof listItemsQuerySchema>;

export const createItemSchema = z.object({
  categoryId: z.string().uuid(),
  itemName: z.string().min(1),
  photoUrl: z.string().optional(),
});
export type CreateItemInput = z.infer<typeof createItemSchema>;

export const updateItemSchema = z.object({
  categoryId: z.string().uuid().optional(),
  itemName: z.string().min(1).optional(),
  photoUrl: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
});
export type UpdateItemInput = z.infer<typeof updateItemSchema>;
