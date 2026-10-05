import { z } from 'zod';

export const listProductionEntriesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  carrierId: z.string().uuid().optional(),
  itemId: z.string().uuid().optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
});
export type ListProductionEntriesQuery = z.infer<typeof listProductionEntriesQuerySchema>;

// "HH:mm", 24-hour — same rule as the cutting entry.
const entryTimeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Time must be HH:mm')
  .nullable()
  .optional();

// Rates may be left empty and filled in later (edit); totals are then 0 until they are.
const rateSchema = z.coerce.number().positive().nullable().optional();

// The stitching karigar and the lot they took (Cutting Distribution). Quantity, design and work
// type are not sent: the service takes all pieces still pending for that karigar + lot, the
// lot's design and the karigar's work type.
export const createProductionEntrySchema = z.object({
  cuttingEntryId: z.string().uuid(),
  carrierId: z.string().uuid(),
  date: z.coerce.date(),
  entryTime: entryTimeSchema,
  carrierRate: rateSchema,

  overlockCarrierId: z.string().uuid().nullable().optional(),
  overlockRate: rateSchema,

  flatlockKarigarId: z.string().uuid().nullable().optional(),
  flatlockRate: rateSchema,

  photoUrl: z.string().min(1),
  remarks: z.string().optional(),
});
export type CreateProductionEntryInput = z.infer<typeof createProductionEntrySchema>;

export const karigarLotsQuerySchema = z.object({
  karigarId: z.string().uuid(),
  bookId: z.string().uuid(),
});

// Lot, karigar and quantity are fixed once saved.
export const updateProductionEntrySchema = z.object({
  date: z.coerce.date().optional(),
  entryTime: entryTimeSchema,
  carrierRate: rateSchema,

  overlockCarrierId: z.string().uuid().nullable().optional(),
  overlockRate: rateSchema,

  flatlockKarigarId: z.string().uuid().nullable().optional(),
  flatlockRate: rateSchema,

  photoUrl: z.string().min(1).optional(),
  remarks: z.string().nullable().optional(),
});
export type UpdateProductionEntryInput = z.infer<typeof updateProductionEntrySchema>;
