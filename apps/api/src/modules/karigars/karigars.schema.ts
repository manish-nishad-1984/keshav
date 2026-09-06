import { z } from 'zod';

export const listKarigarsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  workTypeId: z.string().uuid().optional(),
});
export type ListKarigarsQuery = z.infer<typeof listKarigarsQuerySchema>;

export const createKarigarSchema = z.object({
  fullName: z.string().min(1),
  mobile: z.string().min(1),
  workTypeId: z.string().uuid(),
  photoUrl: z.string().optional(),
  joinDate: z.coerce.date().optional(),
  address: z.string().optional(),
  remarks: z.string().optional(),
});
export type CreateKarigarInput = z.infer<typeof createKarigarSchema>;

export const updateKarigarSchema = z.object({
  fullName: z.string().min(1).optional(),
  mobile: z.string().min(1).optional(),
  workTypeId: z.string().uuid().optional(),
  photoUrl: z.string().nullable().optional(),
  joinDate: z.coerce.date().nullable().optional(),
  address: z.string().optional(),
  remarks: z.string().optional(),
  isActive: z.boolean().optional(),
});
export type UpdateKarigarInput = z.infer<typeof updateKarigarSchema>;
