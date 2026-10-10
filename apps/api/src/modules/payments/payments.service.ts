import { badRequest, conflict, notFound } from '../../lib/httpError';
import { prisma } from '../../lib/prisma';
import { getKarigar } from '../karigars/karigars.service';
import * as repo from './payments.repository';
import { getKarigarPending } from './earnings';
import type { CreatePaymentInput, ListPaymentsQuery, UpdatePaymentInput } from './payments.schema';

export const listPayments = (organizationId: string, query: ListPaymentsQuery) =>
  repo.listPayments(organizationId, query.page, query.pageSize, query.karigarId);

export const getPayment = async (organizationId: string, id: string) => {
  const payment = await repo.findPaymentById(organizationId, id);
  if (!payment) throw notFound('Payment not found');
  return payment;
};

const inr = (n: number) => '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 2 });

// A payment above what is owed is allowed (an advance) but only after the user confirms it.
const assertAdvanceConfirmed = async (organizationId: string, karigarId: string, amount: number, confirmed: boolean | undefined, excludePaymentId?: string) => {
  if (confirmed) return;
  const pending = await getKarigarPending(organizationId, karigarId, excludePaymentId);
  const owed = Math.max(pending, 0);
  if (amount > owed + 0.005) {
    throw conflict(
      `Only ${inr(owed)} is pending for this karigar. This payment of ${inr(amount)} is ${inr(amount - owed)} more than owed and will be recorded as an advance.`,
      'ADVANCE_CONFIRM',
    );
  }
};

// The same karigar, amount and mode within the last two minutes is almost always a double click.
const assertNotDuplicate = async (organizationId: string, karigarId: string, amount: number, paymentMode: string, confirmed: boolean | undefined) => {
  if (confirmed) return;
  const recent = await prisma.payment.findFirst({
    where: { organizationId, karigarId, amount, paymentMode: paymentMode as never, deletedAt: null, createdAt: { gte: new Date(Date.now() - 2 * 60_000) } },
    select: { id: true },
  });
  if (recent) {
    throw conflict('The same payment to this karigar was just recorded. Is this a second payment?', 'DUPLICATE_PAYMENT');
  }
};

const round2 = (n: number) => Math.round(n * 100) / 100;

export const isFixedKarigar = (karigar: { salaryType: string }) => karigar.salaryType === 'FIXED';

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
  await assertNotDuplicate(organizationId, input.karigarId, input.amount, input.paymentMode, input.confirmed);
  await assertAdvanceConfirmed(organizationId, input.karigarId, input.amount, input.confirmed);
  return repo.createPayment(organizationId, { ...base, amount: input.amount }, actorId);
};

export const updatePayment = async (
  organizationId: string,
  id: string,
  input: UpdatePaymentInput,
  actorId: string | null,
) => {
  const existing = await getPayment(organizationId, id);
  const { presentDays, absentDays, overtimeHours, confirmed, ...rest } = input;

  if (existing.perDayRate !== null) {
    // A salary payment is worked out from attendance; its amount is never typed.
    if (rest.amount !== undefined) throw badRequest('This is a salary payment — change the present days or overtime instead of the amount');
  } else if (rest.amount !== undefined) {
    await assertAdvanceConfirmed(organizationId, existing.karigarId, rest.amount, confirmed, id);
  }

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
