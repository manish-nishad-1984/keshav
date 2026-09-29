import { z } from 'zod';

export const listCuttingEntriesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  itemId: z.string().uuid().optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
});
export type ListCuttingEntriesQuery = z.infer<typeof listCuttingEntriesQuerySchema>;

const cuttingLineSchema = z.object({
  size: z.string().min(1),
  quantity: z.coerce.number().int().positive(),
  rate: z.coerce.number().positive(),
});

export const createCuttingEntrySchema = z.object({
  lotNumber: z.string().min(1),
  date: z.coerce.date(),
  patternTypeId: z.string().uuid(),
  characterId: z.string().uuid(),
  isOnline: z.boolean(),
  itemId: z.string().uuid(),
  partyName: z.string().min(1),
  averageValue: z.coerce.number().positive(),
  averageUnit: z.enum(['KILOGRAM', 'METER']),
  colorId: z.string().uuid(),
  lines: z.array(cuttingLineSchema).min(1),
});
export type CreateCuttingEntryInput = z.infer<typeof createCuttingEntrySchema>;

export const updateCuttingEntrySchema = z.object({
  date: z.coerce.date().optional(),
  patternTypeId: z.string().uuid().optional(),
  characterId: z.string().uuid().optional(),
  isOnline: z.boolean().optional(),
  itemId: z.string().uuid().optional(),
  partyName: z.string().min(1).optional(),
  averageValue: z.coerce.number().positive().optional(),
  averageUnit: z.enum(['KILOGRAM', 'METER']).optional(),
  colorId: z.string().uuid().optional(),
  lines: z.array(cuttingLineSchema).min(1).optional(),
});
export type UpdateCuttingEntryInput = z.infer<typeof updateCuttingEntrySchema>;
