import { badRequest, notFound } from '../../lib/httpError';
import { prisma } from '../../lib/prisma';
import { getKarigar } from '../karigars/karigars.service';
import * as repo from './payments.repository';
import type { CreatePaymentInput, ListPaymentsQuery, UpdatePaymentInput } from './payments.schema';

export const listPayments = (organizationId: string, query: ListPaymentsQuery) =>
  repo.listPayments(organizationId, query.page, query.pageSize, query.karigarId);

export const getPayment = async (organizationId: string, id: string) => {
  const payment = await repo.findPaymentById(organizationId, id);
  if (!payment) throw notFound('Payment not found');
  return payment;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

export const isFixedKarigar = (karigar: { workType: { name: string } }) => karigar.workType.name.trim().toLowerCase() === 'fixed';

// Fixed karigar salary: per day = monthly ÷ 30; overtime hours are paid at per day ÷ 8.
export const computeSalary = (perDayRate: number, presentDays: number, overtimeHours: number) =>
  round2(presentDays * perDayRate + (overtimeHours * perDayRate) / 8);

// "Now" in the organization's timezone, as a date (YYYY-MM-DD) and a time (HH:mm).
const nowInTimezone = async (organizationId: string) => {
  const org = await prisma.organization.findUnique({ where: { id: organizationId }, select: { timezone: true } });
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: org?.timezone || 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(new Date())
      .map((p) => [p.type, p.value]),
  );
  return { date: new Date(`${parts.year}-${parts.month}-${parts.day}`), entryTime: `${parts.hour}:${parts.minute}` };
};

export const createPayment = async (organizationId: string, input: CreatePaymentInput, actorId: string | null) => {
  const karigar = await getKarigar(organizationId, input.karigarId);
  const now = await nowInTimezone(organizationId);
  const base = { ...now, karigarId: input.karigarId, paymentMode: input.paymentMode, remarks: input.remarks };

  if (isFixedKarigar(karigar)) {
    if (!karigar.monthlySalary) {
      throw badRequest(`Set the monthly salary of ${karigar.fullName} in Karigar Master first`);
    }
    if (input.presentDays === undefined) throw badRequest('Enter the present days');
    const perDayRate = round2(Number(karigar.monthlySalary) / 30);
    const overtimeHours = input.overtimeHours ?? 0;
    const salaryAmount = computeSalary(perDayRate, input.presentDays, overtimeHours);
    if (salaryAmount <= 0) throw badRequest('The salary works out to ₹0 — enter present days or overtime');
    return repo.createPayment(
      organizationId,
      {
        ...base,
        amount: salaryAmount,
        presentDays: input.presentDays,
        absentDays: input.absentDays ?? 0,
        overtimeHours,
        perDayRate,
        salaryAmount,
      },
      actorId,
    );
  }

  if (!input.amount) throw badRequest('Enter the payment amount');
  return repo.createPayment(organizationId, { ...base, amount: input.amount }, actorId);
};

export const updatePayment = async (
  organizationId: string,
  id: string,
  input: UpdatePaymentInput,
  actorId: string | null,
) => {
  const existing = await getPayment(organizationId, id);
  const { presentDays, absentDays, overtimeHours, ...rest } = input;

  // A salary payment is recomputed from its attendance at the per-day rate it was made with.
  if (existing.perDayRate !== null && (presentDays !== undefined || overtimeHours !== undefined)) {
    const present = presentDays ?? existing.presentDays ?? 0;
    const overtime = overtimeHours ?? Number(existing.overtimeHours ?? 0);
    const salaryAmount = computeSalary(Number(existing.perDayRate), present, overtime);
    if (salaryAmount <= 0) throw badRequest('The salary works out to ₹0 — enter present days or overtime');
    return repo.updatePayment(
      id,
      { ...rest, presentDays: present, absentDays: absentDays ?? existing.absentDays, overtimeHours: overtime, salaryAmount, amount: salaryAmount },
      actorId,
    );
  }
  return repo.updatePayment(id, { ...rest, ...(absentDays !== undefined ? { absentDays } : {}) }, actorId);
};

export const deletePayment = async (organizationId: string, id: string, actorId: string | null) => {
  await getPayment(organizationId, id);
  await repo.softDeletePayment(id, actorId);
};

export const getLedger = (organizationId: string) => repo.getLedger(organizationId);
