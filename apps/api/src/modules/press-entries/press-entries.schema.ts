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

// No rate: it comes from Settings (online / offline) when the entry is saved.
export const createPressEntrySchema = z.object({
  karigarId: z.string().uuid(),
  date: z.coerce.date(),
  entryTime: entryTimeSchema,
  isOnline: z.boolean(),
  pieces: z.coerce.number().int().positive(),
  remarks: z.string().trim().max(500).nullable().optional(),
});
export type CreatePressEntryInput = z.infer<typeof createPressEntrySchema>;

export const updatePressEntrySchema = createPressEntrySchema.partial();
export type UpdatePressEntryInput = z.infer<typeof updatePressEntrySchema>;

export const pressRatesSchema = z.object({
  onlineRate: z.coerce.number().positive().max(100000),
  offlineRate: z.coerce.number().positive().max(100000),
});
export type PressRates = z.infer<typeof pressRatesSchema>;
