import { z } from 'zod';

export const listCuttingEntriesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  bookId: z.string().uuid().optional(),
  search: z.string().optional(),
  itemId: z.string().uuid().optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
});
export type ListCuttingEntriesQuery = z.infer<typeof listCuttingEntriesQuerySchema>;

export const lotLookupQuerySchema = z.object({ bookId: z.string().uuid() });

const cuttingLineSchema = z.object({
  size: z.string().min(1),
  quantity: z.coerce.number().int().positive(),
  rate: z.coerce.number().positive(),
});

// No lotNumber: it is generated server-side as the next number in the chosen book.
export const createCuttingEntrySchema = z.object({
  bookId: z.string().uuid(),
  date: z.coerce.date(),
  patternTypeId: z.string().uuid(),
  isOnline: z.boolean(),
  itemId: z.string().uuid(),
  partyId: z.string().uuid(),
  pieces: z.coerce.number().int().positive(),
  averageValue: z.coerce.number().positive(),
  averageUnit: z.enum(['KILOGRAM', 'METER']),
  colorId: z.string().uuid(),
  lines: z.array(cuttingLineSchema).min(1),
});
export type CreateCuttingEntryInput = z.infer<typeof createCuttingEntrySchema>;

export const updateCuttingEntrySchema = z.object({
  date: z.coerce.date().optional(),
  patternTypeId: z.string().uuid().optional(),
  isOnline: z.boolean().optional(),
  itemId: z.string().uuid().optional(),
  partyId: z.string().uuid().optional(),
  pieces: z.coerce.number().int().positive().optional(),
  averageValue: z.coerce.number().positive().optional(),
  averageUnit: z.enum(['KILOGRAM', 'METER']).optional(),
  colorId: z.string().uuid().optional(),
  lines: z.array(cuttingLineSchema).min(1).optional(),
});
export type UpdateCuttingEntryInput = z.infer<typeof updateCuttingEntrySchema>;
