import { badRequest, conflict, notFound } from '../../lib/httpError';
import { prisma } from '../../lib/prisma';
import { getKarigar } from '../karigars/karigars.service';
import * as repo from './payments.repository';
import { getKarigarPending } from './earnings';
import type { CreatePaymentInput, ListPaymentsQuery, UpdatePaymentInput } from './payments.schema';

export const listPayments = (organizationId: string, query: ListPaymentsQuery) =>
  repo.listPayments(organizationId, query.page, query.pageSize, query.karigarId, query.includeDeleted);

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

// Fixed karigar salary: per day = monthly ÷ 30; a shift is 12 hours, so an overtime hour is paid at per day ÷ 12.
export const SHIFT_HOURS = 12;
export const computeSalary = (perDayRate: number, presentDays: number, overtimeHours: number) =>
  round2(presentDays * perDayRate + (overtimeHours * perDayRate) / SHIFT_HOURS);

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

  // Upad: money a Fixed karigar takes during the month. A plain payment; it comes off the next salary
  // because the salary payout pays only what is still owed.
  if (isFixedKarigar(karigar) && input.kind === 'ADVANCE') {
    if (!input.amount) throw badRequest('Enter the upad amount');
    await assertNotDuplicate(organizationId, input.karigarId, input.amount, input.paymentMode, input.confirmed);
    return repo.createPayment(organizationId, { ...base, amount: input.amount }, actorId);
  }

  if (isFixedKarigar(karigar)) {
    if (!karigar.monthlySalary) {
      throw badRequest(`Set the monthly salary of ${karigar.fullName} in Karigar Master first`);
    }
    if (input.presentDays === undefined) throw badRequest('Enter the present days');
    const perDayRate = round2(Number(karigar.monthlySalary) / 30);
    const overtimeHours = input.overtimeHours ?? 0;
    const salaryAmount = computeSalary(perDayRate, input.presentDays, overtimeHours);
    if (salaryAmount <= 0) throw badRequest('The salary works out to ₹0 — enter present days or overtime');
    // Paid now = what is owed after this salary: earlier balance (minus the upad already taken) + salary.
    const owed = round2(Math.max((await getKarigarPending(organizationId, input.karigarId)) + salaryAmount, 0));
    const paidNow = input.paidNow !== undefined ? round2(input.paidNow) : owed;
    if (paidNow > owed + 0.005 && !input.confirmed) {
      throw conflict(
        `After the upad already taken, ${inr(owed)} is owed. Paying ${inr(paidNow)} gives ${inr(paidNow - owed)} extra as an advance.`,
        'ADVANCE_CONFIRM',
      );
    }
    return repo.createPayment(
      organizationId,
      {
        ...base,
        amount: paidNow,
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
  const { presentDays, absentDays, overtimeHours, confirmed, paidNow, ...rest } = input;

  if (existing.perDayRate !== null) {
    // A salary payment: the salary (earned) comes from attendance; "paid now" is the money handed over.
    if (rest.amount !== undefined) throw badRequest('This is a salary payment — change the attendance or the amount paid now');
    const present = presentDays ?? existing.presentDays ?? 0;
    const overtime = overtimeHours ?? Number(existing.overtimeHours ?? 0);
    // Attendance unchanged: the saved salary stays as it was (a payment saved under an older rule is not recalculated).
    const sameAttendance = present === (existing.presentDays ?? 0) && Math.abs(overtime - Number(existing.overtimeHours ?? 0)) < 0.001;
    const salaryAmount = sameAttendance ? Number(existing.salaryAmount ?? 0) : computeSalary(Number(existing.perDayRate), present, overtime);
    if (salaryAmount <= 0) throw badRequest('The salary works out to ₹0 — enter present days or overtime');
    const oldSalary = Number(existing.salaryAmount ?? 0);
    const oldPaid = Number(existing.amount);
    // Not typed: an old-style payment (paid = salary) follows the new salary; otherwise paid stays.
    const amount = paidNow !== undefined ? round2(paidNow) : Math.abs(oldPaid - oldSalary) < 0.005 ? salaryAmount : oldPaid;
    if (!confirmed) {
      const owed = round2(Math.max((await getKarigarPending(organizationId, existing.karigarId, id)) + salaryAmount, 0));
      if (amount > owed + 0.005) {
        throw conflict(`${inr(owed)} is owed with this salary. Paying ${inr(amount)} gives ${inr(amount - owed)} extra as an advance.`, 'ADVANCE_CONFIRM');
      }
    }
    return repo.updatePayment(
      id,
      { ...rest, presentDays: present, absentDays: absentDays ?? existing.absentDays, overtimeHours: overtime, salaryAmount, amount },
      actorId,
    );
  }

  if (rest.amount !== undefined) {
    if (!(rest.amount > 0)) throw badRequest('Enter the payment amount');
    // An upad of a Fixed karigar is an advance by design; no warning for it.
    if (!isFixedKarigar(existing.karigar)) await assertAdvanceConfirmed(organizationId, existing.karigarId, rest.amount, confirmed, id);
  }
  return repo.updatePayment(id, { ...rest, ...(absentDays !== undefined ? { absentDays } : {}) }, actorId);
};

export const deletePayment = async (organizationId: string, id: string, actorId: string | null) => {
  await getPayment(organizationId, id);
  await repo.softDeletePayment(id, actorId);
};

export const getLedger = (organizationId: string) => repo.getLedger(organizationId);

// Every change to one payment (created, edited, deleted) with who did it, from the audit log.
export const getPaymentHistory = async (organizationId: string, id: string) => {
  const exists = await prisma.payment.findFirst({ where: { id, organizationId }, select: { id: true } });
  if (!exists) throw notFound('Payment not found');
  return prisma.auditLog.findMany({
    where: { organizationId, entityType: 'Payment', entityId: id },
    orderBy: { createdAt: 'asc' },
    select: { id: true, action: true, changedFields: true, oldValues: true, newValues: true, actorEmail: true, createdAt: true },
  });
};
