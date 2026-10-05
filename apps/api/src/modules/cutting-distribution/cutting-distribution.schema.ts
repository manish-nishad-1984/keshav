import { z } from 'zod';

export const listDistributionsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  bookId: z.string().uuid().optional(),
  cuttingEntryId: z.string().uuid().optional(),
  karigarId: z.string().uuid().optional(),
  search: z.string().optional(),
});
export type ListDistributionsQuery = z.infer<typeof listDistributionsQuerySchema>;

export const lotsQuerySchema = z.object({ bookId: z.string().uuid() });

// While editing, the entry's own pieces count as still available to it.
export const availabilityQuerySchema = z.object({ excludeId: z.string().uuid().optional() });

// "HH:mm", 24-hour — same rule as the cutting entry.
const entryTimeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Time must be HH:mm')
  .nullable()
  .optional();

// Zero cells are allowed in the payload (empty boxes) and dropped by the service.
const quantitiesSchema = z
  .array(
    z.object({
      colorId: z.string().uuid(),
      sizeId: z.string().uuid(),
      quantity: z.coerce.number().int().min(0),
    }),
  )
  .refine((cells) => cells.some((c) => c.quantity > 0), { message: 'Give pieces in at least one size' })
  .refine((cells) => new Set(cells.map((c) => `${c.colorId}:${c.sizeId}`)).size === cells.length, {
    message: 'A colour and size can appear only once',
  });

export const createDistributionSchema = z.object({
  cuttingEntryId: z.string().uuid(),
  karigarId: z.string().uuid(),
  date: z.coerce.date(),
  entryTime: entryTimeSchema,
  remarks: z.string().trim().max(500).nullable().optional(),
  quantities: quantitiesSchema,
});
export type CreateDistributionInput = z.infer<typeof createDistributionSchema>;

// The lot is fixed once distributed; everything else can change.
export const updateDistributionSchema = z.object({
  karigarId: z.string().uuid().optional(),
  date: z.coerce.date().optional(),
  entryTime: entryTimeSchema,
  remarks: z.string().trim().max(500).nullable().optional(),
  quantities: quantitiesSchema.optional(),
});
export type UpdateDistributionInput = z.infer<typeof updateDistributionSchema>;
