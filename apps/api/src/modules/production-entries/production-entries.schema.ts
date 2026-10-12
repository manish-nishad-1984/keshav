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

// Zero cells are allowed in the payload (empty boxes) and dropped by the service.
const quantitiesSchema = z
  .array(
    z.object({
      colorId: z.string().uuid(),
      sizeId: z.string().uuid(),
      quantity: z.coerce.number().int().min(0),
    }),
  )
  .refine((cells) => new Set(cells.map((c) => `${c.colorId}:${c.sizeId}`)).size === cells.length, {
    message: 'A colour and size can appear only once',
  });

// While editing, the entry's own pieces count as still available to it.
export const availabilityQuerySchema = z.object({
  karigarId: z.string().uuid(),
  cuttingEntryId: z.string().uuid(),
  excludeId: z.string().uuid().optional(),
});

// The stitching karigar, the lot they took (Cutting Distribution) and the pieces they hand in per
// colour + size. The total, design and work type are not sent: the service sums the grid and takes
// the lot's design and the karigar's work type.
export const createProductionEntrySchema = z.object({
  cuttingEntryId: z.string().uuid(),
  carrierId: z.string().uuid(),
  date: z.coerce.date(),
  entryTime: entryTimeSchema,
  quantities: quantitiesSchema,
  // Pieces of this hand-in that need alteration (optional).
  alterationQuantity: z.coerce.number().int().min(0).default(0),
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

// Lot and karigar are fixed once saved; the grid can change (older entries without one keep theirs).
export const updateProductionEntrySchema = z.object({
  // The user saw the "karigar was paid after this entry" warning and wants to go ahead.
  confirmed: z.boolean().optional(),
  date: z.coerce.date().optional(),
  entryTime: entryTimeSchema,
  quantities: quantitiesSchema.optional(),
  alterationQuantity: z.coerce.number().int().min(0).optional(),
  carrierRate: rateSchema,

  overlockCarrierId: z.string().uuid().nullable().optional(),
  overlockRate: rateSchema,

  flatlockKarigarId: z.string().uuid().nullable().optional(),
  flatlockRate: rateSchema,

  photoUrl: z.string().min(1).optional(),
  remarks: z.string().nullable().optional(),
});
export type UpdateProductionEntryInput = z.infer<typeof updateProductionEntrySchema>;
