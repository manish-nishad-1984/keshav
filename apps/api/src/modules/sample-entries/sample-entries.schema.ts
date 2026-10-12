import { z } from 'zod';

export const listSampleEntriesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  karigarId: z.string().uuid().optional(),
  search: z.string().optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
});
export type ListSampleEntriesQuery = z.infer<typeof listSampleEntriesQuerySchema>;

// "HH:mm", 24-hour — same rule as the other entry forms.
const entryTimeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Time must be HH:mm')
  .nullable()
  .optional();

// The total is worked out by the server (quantity × rate).
export const createSampleEntrySchema = z.object({
  karigarId: z.string().uuid(),
  workTypeId: z.string().uuid(),
  itemId: z.string().uuid(),
  date: z.coerce.date(),
  entryTime: entryTimeSchema,
  quantity: z.coerce.number().int().positive(),
  rate: z.coerce.number().positive().max(100000),
  remarks: z.string().trim().max(500).nullable().optional(),
});
export type CreateSampleEntryInput = z.infer<typeof createSampleEntrySchema>;

export const updateSampleEntrySchema = createSampleEntrySchema.partial();
export type UpdateSampleEntryInput = z.infer<typeof updateSampleEntrySchema>;
