import type { Karigar } from '../karigars/karigar-constants';

export const PAYMENT_MODES = ['CASH', 'BANK_TRANSFER', 'UPI', 'CHEQUE'] as const;
export type PaymentMode = (typeof PAYMENT_MODES)[number];

export const PAYMENT_MODE_LABELS: Record<PaymentMode, string> = {
  CASH: 'Cash',
  BANK_TRANSFER: 'Bank Transfer',
  UPI: 'UPI',
  CHEQUE: 'Cheque',
};

export interface LedgerRow {
  karigarId: string;
  karigarName: string;
  karigarCode: string;
  totalAmount: number;
  paidAmount: number;
  pending: number;
}

export interface Payment {
  id: string;
  date: string;
  karigarId: string;
  amount: string;
  paymentMode: PaymentMode;
  referenceNo: string | null;
  remarks: string | null;
  karigar: Karigar;
}
