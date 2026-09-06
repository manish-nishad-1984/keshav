import { z } from 'zod';

export const reportDateRangeQuerySchema = z.object({
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
});
export type ReportDateRangeQuery = z.infer<typeof reportDateRangeQuerySchema>;
