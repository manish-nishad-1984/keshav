import { z } from 'zod';

export const listProductionEntriesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  karigarId: z.string().uuid().optional(),
  itemId: z.string().uuid().optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
});
export type ListProductionEntriesQuery = z.infer<typeof listProductionEntriesQuerySchema>;

export const createProductionEntrySchema = z.object({
  date: z.coerce.date(),
  karigarId: z.string().uuid(),
  workTypeId: z.string().uuid(),
  itemId: z.string().uuid(),
  quantity: z.coerce.number().int().positive(),
  rate: z.coerce.number().positive(),
  photoUrl: z.string().optional(),
  remarks: z.string().optional(),
});
export type CreateProductionEntryInput = z.infer<typeof createProductionEntrySchema>;

export const updateProductionEntrySchema = z.object({
  date: z.coerce.date().optional(),
  karigarId: z.string().uuid().optional(),
  workTypeId: z.string().uuid().optional(),
  itemId: z.string().uuid().optional(),
  quantity: z.coerce.number().int().positive().optional(),
  rate: z.coerce.number().positive().optional(),
  photoUrl: z.string().nullable().optional(),
  remarks: z.string().optional(),
});
export type UpdateProductionEntryInput = z.infer<typeof updateProductionEntrySchema>;
