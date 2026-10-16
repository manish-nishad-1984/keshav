import { z } from 'zod';

export const listTransactionsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  bookId: z.string().uuid().optional(),
  karigarId: z.string().uuid().optional(),
  type: z.enum(['ISSUE', 'RETURN']).optional(),
  search: z.string().optional(),
});
export type ListTransactionsQuery = z.infer<typeof listTransactionsQuerySchema>;

export const karigarLotsQuerySchema = z.object({
  karigarId: z.string().uuid(),
  bookId: z.string().uuid(),
});

export const positionQuerySchema = z.object({
  karigarId: z.string().uuid(),
  cuttingEntryId: z.string().uuid(),
  // While editing, the transaction's own quantities don't count.
  excludeId: z.string().uuid().optional(),
});

export const pendingReturnsQuerySchema = z.object({
  bookId: z.string().uuid().optional(),
  cuttingEntryId: z.string().uuid().optional(),
  karigarId: z.string().uuid().optional(),
});

export const balanceQuerySchema = z.object({
  bookId: z.string().uuid(),
  karigarId: z.string().uuid().optional(),
});

// "HH:mm", 24-hour — same rule as the cutting entry.
const entryTimeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Time must be HH:mm')
  .nullable()
  .optional();

// Zero lines are allowed in the payload (empty boxes) and dropped by the service.
const linesSchema = z
  .array(
    z.object({
      accessoryId: z.string().uuid(),
      quantity: z.coerce.number().min(0).max(9999999),
    }),
  )
  .refine((lines) => lines.some((l) => l.quantity > 0), { message: 'Enter a quantity for at least one accessory' })
  .refine((lines) => new Set(lines.map((l) => l.accessoryId)).size === lines.length, {
    message: 'An accessory can appear only once',
  });

export const createTransactionSchema = z.object({
  type: z.enum(['ISSUE', 'RETURN']),
  karigarId: z.string().uuid(),
  cuttingEntryId: z.string().uuid(),
  date: z.coerce.date(),
  entryTime: entryTimeSchema,
  remarks: z.string().trim().max(500).nullable().optional(),
  lines: linesSchema,
});
export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;

// Type, karigar and lot are fixed once saved.
export const updateTransactionSchema = z.object({
  date: z.coerce.date().optional(),
  entryTime: entryTimeSchema,
  remarks: z.string().trim().max(500).nullable().optional(),
  lines: linesSchema.optional(),
});
export type UpdateTransactionInput = z.infer<typeof updateTransactionSchema>;
