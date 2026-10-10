import { z } from 'zod';

export const listDeliveriesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  bookId: z.string().uuid().optional(),
  cuttingEntryId: z.string().uuid().optional(),
  partyId: z.string().uuid().optional(),
  search: z.string().optional(),
});
export type ListDeliveriesQuery = z.infer<typeof listDeliveriesQuerySchema>;

export const lotsQuerySchema = z.object({ bookId: z.string().uuid() });

// While editing, the delivery's own pieces count as still available to it.
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
  .refine((cells) => cells.some((c) => c.quantity > 0), { message: 'Deliver pieces in at least one size' })
  .refine((cells) => new Set(cells.map((c) => `${c.colorId}:${c.sizeId}`)).size === cells.length, {
    message: 'A colour and size can appear only once',
  });

// No party: it is always the lot's party.
export const createDeliverySchema = z.object({
  cuttingEntryId: z.string().uuid(),
  date: z.coerce.date(),
  entryTime: entryTimeSchema,
  billNumber: z.string().trim().max(50).nullable().optional(),
  remarks: z.string().trim().max(500).nullable().optional(),
  quantities: quantitiesSchema,
});
export type CreateDeliveryInput = z.infer<typeof createDeliverySchema>;

// The lot (and so the party) is fixed once delivered; everything else can change.
export const updateDeliverySchema = z.object({
  date: z.coerce.date().optional(),
  entryTime: entryTimeSchema,
  billNumber: z.string().trim().max(50).nullable().optional(),
  remarks: z.string().trim().max(500).nullable().optional(),
  quantities: quantitiesSchema.optional(),
});
export type UpdateDeliveryInput = z.infer<typeof updateDeliverySchema>;
