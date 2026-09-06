import { z } from 'zod';

const paymentModeEnum = z.enum(['CASH', 'BANK_TRANSFER', 'UPI', 'CHEQUE']);

export const listPaymentsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  karigarId: z.string().uuid().optional(),
});
export type ListPaymentsQuery = z.infer<typeof listPaymentsQuerySchema>;

export const createPaymentSchema = z.object({
  date: z.coerce.date(),
  karigarId: z.string().uuid(),
  amount: z.coerce.number().positive(),
  paymentMode: paymentModeEnum,
  referenceNo: z.string().optional(),
  remarks: z.string().optional(),
});
export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;

export const updatePaymentSchema = z.object({
  date: z.coerce.date().optional(),
  karigarId: z.string().uuid().optional(),
  amount: z.coerce.number().positive().optional(),
  paymentMode: paymentModeEnum.optional(),
  referenceNo: z.string().optional(),
  remarks: z.string().optional(),
});
export type UpdatePaymentInput = z.infer<typeof updatePaymentSchema>;
