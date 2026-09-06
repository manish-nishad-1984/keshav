import { prisma } from '../../lib/prisma';
import type { Prisma } from '@prisma/client';

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
    referenceNo?: string;
    remarks?: string;
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
// ledger which lists every karigar), aggregated via two groupBy queries rather than a per-karigar
// N+1 loop.
export const getLedger = async (organizationId: string) => {
  const [karigars, productionSums, paymentSums] = await Promise.all([
    prisma.karigar.findMany({ where: { organizationId, deletedAt: null }, orderBy: { fullName: 'asc' } }),
    prisma.productionEntry.groupBy({
      by: ['karigarId'],
      where: { organizationId, deletedAt: null },
      _sum: { totalAmount: true },
    }),
    prisma.payment.groupBy({
      by: ['karigarId'],
      where: { organizationId, deletedAt: null },
      _sum: { amount: true },
    }),
  ]);

  const totalByKarigar = new Map(productionSums.map((row) => [row.karigarId, Number(row._sum.totalAmount ?? 0)]));
  const paidByKarigar = new Map(paymentSums.map((row) => [row.karigarId, Number(row._sum.amount ?? 0)]));

  return karigars.map((karigar) => {
    const totalAmount = totalByKarigar.get(karigar.id) ?? 0;
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
