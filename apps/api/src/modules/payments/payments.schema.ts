import { z } from 'zod';

// New payments are Cash or Bank; UPI / Cheque remain only on older entries.
const newPaymentModeEnum = z.enum(['CASH', 'BANK_TRANSFER']);
const paymentModeEnum = z.enum(['CASH', 'BANK_TRANSFER', 'UPI', 'CHEQUE']);

export const listPaymentsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  karigarId: z.string().uuid().optional(),
  // "true": deleted payments too (shown greyed in the karigar's payment history).
  includeDeleted: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v === 'true'),
});
export type ListPaymentsQuery = z.infer<typeof listPaymentsQuerySchema>;

// Attendance for a Fixed karigar; the salary is worked out from it on the server.
const attendanceSchema = {
  presentDays: z.coerce.number().int().min(0).max(31).optional(),
  absentDays: z.coerce.number().int().min(0).max(31).optional(),
  overtimeHours: z.coerce.number().min(0).max(744).optional(),
};

// No date: payments are dated now (date and time) by the server. No amount for a Fixed karigar:
// it is the salary worked out from attendance.
export const createPaymentSchema = z.object({
  karigarId: z.string().uuid(),
  amount: z.coerce.number().positive().optional(),
  paymentMode: newPaymentModeEnum,
  remarks: z.string().optional(),
  // The user saw the advance / duplicate warning and wants to go ahead.
  confirmed: z.boolean().optional(),
  // Fixed karigar only: ADVANCE = upad during the month (amount typed); SALARY (default) = month-end payout.
  kind: z.enum(['SALARY', 'ADVANCE']).optional(),
  // Salary payout: the money handed over now (default: all that is owed after the upad).
  paidNow: z.coerce.number().min(0).optional(),
  ...attendanceSchema,
});
export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;

export const updatePaymentSchema = z.object({
  amount: z.coerce.number().positive().optional(),
  paidNow: z.coerce.number().min(0).optional(),
  paymentMode: paymentModeEnum.optional(),
  referenceNo: z.string().optional(),
  remarks: z.string().optional(),
  confirmed: z.boolean().optional(),
  ...attendanceSchema,
});
export type UpdatePaymentInput = z.infer<typeof updatePaymentSchema>;
