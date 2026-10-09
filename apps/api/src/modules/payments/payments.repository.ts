import { prisma } from '../../lib/prisma';
import type { Prisma } from '@prisma/client';
import { getEarningsByKarigar, getPaidByKarigar } from './earnings';

export const listPayments = async (
  organizationId: string,
  page: number,
  pageSize: number,
  karigarId?: string,
) => {
  const where: Prisma.PaymentWhereInput = {
    organizationId,
    deletedAt: null,
    ...(karigarId ? { karigarId } : {}),
  };

  const [items, total] = await Promise.all([
    prisma.payment.findMany({
      where,
      include: { karigar: true },
      orderBy: { date: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.payment.count({ where }),
  ]);

  return { items, total };
};

export const findPaymentById = (organizationId: string, id: string) =>
  prisma.payment.findFirst({ where: { id, organizationId, deletedAt: null }, include: { karigar: true } });

export const createPayment = (
  organizationId: string,
  data: {
    date: Date;
    karigarId: string;
    amount: number;
    paymentMode: 'CASH' | 'BANK_TRANSFER' | 'UPI' | 'CHEQUE';
    entryTime?: string | null;
    referenceNo?: string;
    remarks?: string;
    presentDays?: number | null;
    absentDays?: number | null;
    overtimeHours?: number | null;
    perDayRate?: number | null;
    salaryAmount?: number | null;
  },
  createdById: string | null,
) =>
  prisma.payment.create({
    data: { organizationId, ...data, createdById: createdById ?? undefined },
    include: { karigar: true },
  });

export const updatePayment = (
  id: string,
  data: Partial<{
    date: Date;
    karigarId: string;
    amount: number;
    paymentMode: 'CASH' | 'BANK_TRANSFER' | 'UPI' | 'CHEQUE';
    referenceNo: string;
    remarks: string;
    presentDays: number | null;
    absentDays: number | null;
    overtimeHours: number | null;
    perDayRate: number | null;
    salaryAmount: number | null;
  }>,
  updatedById: string | null,
) =>
  prisma.payment.update({
    where: { id },
    data: { ...data, updatedById: updatedById ?? undefined },
    include: { karigar: true },
  });

export const softDeletePayment = (id: string, updatedById: string | null) =>
  prisma.payment.update({ where: { id }, data: { deletedAt: new Date(), updatedById: updatedById ?? undefined } });

// One row per active karigar (even those with zero production or payments, matching the mockup's
// ledger which lists every karigar). Earnings come from the shared earnings function so the
// dashboard and reports show the same figures.
export const getLedger = async (organizationId: string) => {
  const [karigars, earnings, paidByKarigar] = await Promise.all([
    prisma.karigar.findMany({ where: { organizationId, deletedAt: null }, orderBy: { fullName: 'asc' } }),
    getEarningsByKarigar(organizationId),
    getPaidByKarigar(organizationId),
  ]);

  return karigars.map((karigar) => {
    const totalAmount = earnings.get(karigar.id)?.total ?? 0;
    const paidAmount = paidByKarigar.get(karigar.id) ?? 0;
    return {
      karigarId: karigar.id,
      karigarName: karigar.fullName,
      karigarCode: karigar.code,
      totalAmount,
      paidAmount,
      pending: totalAmount - paidAmount,
    };
  });
};
