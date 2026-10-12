import { z } from 'zod';

export const listPressEntriesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  karigarId: z.string().uuid().optional(),
  search: z.string().optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
});
export type ListPressEntriesQuery = z.infer<typeof listPressEntriesQuerySchema>;

// "HH:mm", 24-hour — same rule as the other entry forms.
const entryTimeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Time must be HH:mm')
  .nullable()
  .optional();

// The rate is one of the rates the admin set up in Settings for the chosen mode (online / offline).
export const createPressEntrySchema = z.object({
  karigarId: z.string().uuid(),
  date: z.coerce.date(),
  entryTime: entryTimeSchema,
  isOnline: z.boolean(),
  pieces: z.coerce.number().int().positive(),
  rate: z.coerce.number().positive().max(100000),
  remarks: z.string().trim().max(500).nullable().optional(),
});
export type CreatePressEntryInput = z.infer<typeof createPressEntrySchema>;

export const updatePressEntrySchema = createPressEntrySchema.partial();
export type UpdatePressEntryInput = z.infer<typeof updatePressEntrySchema>;

// Each mode has a list of rates (per piece) the admin keeps in Settings; the user picks one.
const rateListSchema = z
  .array(z.coerce.number().positive().max(100000))
  .min(1, 'Add at least one rate')
  .max(30)
  .refine((rates) => new Set(rates.map((r) => r.toFixed(2))).size === rates.length, { message: 'A rate appears twice' });

export const pressRatesSchema = z.object({
  onlineRates: rateListSchema,
  offlineRates: rateListSchema,
});
export type PressRates = z.infer<typeof pressRatesSchema>;
