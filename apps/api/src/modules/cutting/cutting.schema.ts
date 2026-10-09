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

// One colour row of the size grid. Zero quantities are allowed in the payload (empty cells) and
// dropped by the service; a row needs at least one size with pieces.
const cuttingRowSchema = z
  .object({
    colorId: z.string().uuid(),
    photoUrl: z.string().min(1).nullable().optional(),
    quantities: z.array(
      z.object({
        sizeId: z.string().uuid(),
        quantity: z.coerce.number().int().min(0),
      }),
    ),
  })
  .refine((row) => row.quantities.some((q) => q.quantity > 0), {
    message: 'Each colour row needs pieces in at least one size',
  })
  .refine((row) => new Set(row.quantities.map((q) => q.sizeId)).size === row.quantities.length, {
    message: 'A size can appear only once per colour row',
  });

// "HH:mm", 24-hour.
const entryTimeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Time must be HH:mm')
  .nullable()
  .optional();

// No lotNumber: it is generated server-side as the next number in the chosen book.
export const createCuttingEntrySchema = z.object({
  bookId: z.string().uuid(),
  date: z.coerce.date(),
  entryTime: entryTimeSchema,
  patternTypeId: z.string().uuid(),
  isOnline: z.boolean(),
  itemId: z.string().uuid(),
  partyId: z.string().uuid(),
  pieces: z.coerce.number().int().positive(),
  averageValue: z.coerce.number().positive(),
  averageUnit: z.enum(['KILOGRAM', 'METER']),
  rows: z.array(cuttingRowSchema).min(1),
});
export type CreateCuttingEntryInput = z.infer<typeof createCuttingEntrySchema>;

export const updateCuttingEntrySchema = z.object({
  date: z.coerce.date().optional(),
  entryTime: entryTimeSchema,
  patternTypeId: z.string().uuid().optional(),
  isOnline: z.boolean().optional(),
  itemId: z.string().uuid().optional(),
  partyId: z.string().uuid().optional(),
  pieces: z.coerce.number().int().positive().optional(),
  averageValue: z.coerce.number().positive().optional(),
  averageUnit: z.enum(['KILOGRAM', 'METER']).optional(),
  rows: z.array(cuttingRowSchema).min(1).optional(),
});
export type UpdateCuttingEntryInput = z.infer<typeof updateCuttingEntrySchema>;

// Closing a lot: why the undelivered pieces are missing (required only when there are any).
export const closeLotSchema = z.object({
  reason: z.enum(['DAMAGED', 'SHORTAGE', 'RETURNED_BY_PARTY']).optional(),
  note: z.string().trim().max(500).nullable().optional(),
});
