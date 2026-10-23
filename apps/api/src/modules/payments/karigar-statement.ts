import { notFound } from '../../lib/httpError';
import { prisma } from '../../lib/prisma';
import { getKarigarPending } from './earnings';

const num = (v: { toString(): string } | null | undefined) => (v == null ? 0 : Number(v.toString()));
const round2 = (n: number) => Math.round(n * 100) / 100;
const sum = (values: number[]) => round2(values.reduce((a, b) => a + b, 0));

// For the payment form: what the karigar is owed now, and — for a Fixed karigar — the upad (advance)
// taken since the last salary, which comes off the next salary.
export const getKarigarAccount = async (organizationId: string, karigarId: string) => {
  const karigar = await prisma.karigar.findFirst({
    where: { id: karigarId, organizationId, deletedAt: null },
    select: { id: true, fullName: true, salaryType: true, monthlySalary: true },
  });
  if (!karigar) throw notFound('Karigar not found');

  const lastSalary = await prisma.payment.findFirst({
    where: { organizationId, karigarId, deletedAt: null, salaryAmount: { not: null } },
    orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    select: { date: true, createdAt: true, salaryAmount: true, amount: true },
  });
  const [pending, advances] = await Promise.all([
    getKarigarPending(organizationId, karigarId),
    prisma.payment.findMany({
      where: {
        organizationId,
        karigarId,
        deletedAt: null,
        salaryAmount: null,
        ...(lastSalary ? { createdAt: { gt: lastSalary.createdAt } } : {}),
      },
      orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
      select: { id: true, date: true, entryTime: true, amount: true, paymentMode: true, remarks: true },
    }),
  ]);

  return {
    karigarId: karigar.id,
    salaryType: karigar.salaryType,
    monthlySalary: karigar.monthlySalary ? num(karigar.monthlySalary) : null,
    // Earned − paid till now. Negative = the karigar has taken more than earned (upad / advance).
    pending: round2(pending),
    lastSalary: lastSalary ? { date: lastSalary.date, salary: num(lastSalary.salaryAmount), paid: num(lastSalary.amount) } : null,
    advances: advances.map((a) => ({ ...a, amount: num(a.amount) })),
    advanceTotal: sum(advances.map((a) => num(a.amount))),
  };
};

// The karigar's report card for a period: every piece of work (lot, work, pcs, rate, amount), every
// payment taken, and the balance — opening (before the period) + earned − paid = closing.
export const getKarigarStatement = async (organizationId: string, karigarId: string, range: { dateFrom?: Date; dateTo?: Date }) => {
  const karigar = await prisma.karigar.findFirst({
    where: { id: karigarId, organizationId },
    select: { id: true, code: true, fullName: true, mobile: true, salaryType: true, monthlySalary: true, workType: { select: { name: true } } },
  });
  if (!karigar) throw notFound('Karigar not found');

  const inRange = range.dateFrom || range.dateTo ? { ...(range.dateFrom ? { gte: range.dateFrom } : {}), ...(range.dateTo ? { lte: range.dateTo } : {}) } : undefined;
  const base = { organizationId, deletedAt: null, ...(inRange ? { date: inRange } : {}) };
  const lot = { select: { lotNumber: true } } as const;
  const item = { select: { itemName: true } } as const;

  const [stitching, overlock, flatlock, press, sample, payments, before] = await Promise.all([
    prisma.productionEntry.findMany({ where: { ...base, carrierId: karigarId }, include: { cuttingEntry: lot, item }, orderBy: { date: 'asc' } }),
    prisma.productionEntry.findMany({ where: { ...base, overlockCarrierId: karigarId }, include: { cuttingEntry: lot, item }, orderBy: { date: 'asc' } }),
    prisma.productionEntry.findMany({ where: { ...base, flatlockKarigarId: karigarId }, include: { cuttingEntry: lot, item }, orderBy: { date: 'asc' } }),
    prisma.pressEntry.findMany({ where: { ...base, karigarId }, orderBy: { date: 'asc' } }),
    prisma.sampleEntry.findMany({ where: { ...base, karigarId }, include: { item, workType: { select: { name: true } } }, orderBy: { date: 'asc' } }),
    prisma.payment.findMany({ where: { ...base, karigarId }, orderBy: [{ date: 'asc' }, { createdAt: 'asc' }] }),
    range.dateFrom ? openingBalance(organizationId, karigarId, range.dateFrom) : Promise.resolve(0),
  ]);

  type Line = { date: Date; lot: string; design: string; work: string; qty: number; rate: number; amount: number };
  const work: Line[] = [
    ...stitching.map((p) => ({ date: p.date, lot: p.cuttingEntry?.lotNumber ?? p.lotNumber ?? '', design: p.item.itemName, work: 'Stitching', qty: p.carrierQuantity, rate: num(p.carrierRate), amount: num(p.carrierTotal) })),
    ...overlock.map((p) => ({ date: p.date, lot: p.cuttingEntry?.lotNumber ?? p.lotNumber ?? '', design: p.item.itemName, work: 'Overlock', qty: p.carrierQuantity, rate: num(p.overlockRate), amount: num(p.overlockTotal) })),
    ...flatlock.map((p) => ({ date: p.date, lot: p.cuttingEntry?.lotNumber ?? p.lotNumber ?? '', design: p.item.itemName, work: 'Flatlock', qty: p.carrierQuantity, rate: num(p.flatlockRate), amount: num(p.flatlockTotal) })),
    ...press.map((p) => ({ date: p.date, lot: '', design: '', work: `Press (${p.isOnline ? 'online' : 'offline'})`, qty: p.pieces, rate: num(p.rate), amount: num(p.total) })),
    ...sample.map((s) => ({ date: s.date, lot: '', design: s.item.itemName, work: `Sample · ${s.workType.name}`, qty: s.quantity, rate: num(s.rate), amount: num(s.total) })),
  ].sort((a, b) => a.date.getTime() - b.date.getTime());

  const salaries = payments
    .filter((p) => p.salaryAmount !== null)
    .map((p) => ({ date: p.date, presentDays: p.presentDays, absentDays: p.absentDays, overtimeHours: num(p.overtimeHours), perDayRate: num(p.perDayRate), amount: num(p.salaryAmount) }));
  const paid = payments.map((p) => ({
    date: p.date,
    entryTime: p.entryTime,
    amount: num(p.amount),
    mode: p.paymentMode,
    kind: p.salaryAmount !== null ? ('SALARY' as const) : ('UPAD' as const),
    remarks: p.remarks,
  }));

  const workTotal = sum(work.map((w) => w.amount));
  const salaryTotal = sum(salaries.map((s) => s.amount));
  const earned = round2(workTotal + salaryTotal);
  const paidTotal = sum(paid.map((p) => p.amount));
  const opening = round2(before);

  return {
    karigar: {
      id: karigar.id,
      code: karigar.code,
      name: karigar.fullName,
      mobile: karigar.mobile,
      workType: karigar.workType.name,
      salaryType: karigar.salaryType,
      monthlySalary: karigar.monthlySalary ? num(karigar.monthlySalary) : null,
    },
    range: { dateFrom: range.dateFrom ?? null, dateTo: range.dateTo ?? null },
    work,
    salaries,
    payments: paid,
    totals: {
      opening,
      pieces: work.reduce((a, w) => a + (w.work.startsWith('Sample') ? 0 : w.qty), 0),
      workTotal,
      salaryTotal,
      earned,
      paid: paidTotal,
      paidTimes: paid.length,
      // Positive = still to pay the karigar; negative = karigar has taken extra (advance).
      closing: round2(opening + earned - paidTotal),
    },
  };
};

// Earned − paid before `dateFrom`: the balance the period starts with.
const openingBalance = async (organizationId: string, karigarId: string, dateFrom: Date) => {
  const where = { organizationId, deletedAt: null, date: { lt: dateFrom } };
  const [st, ov, fl, pr, sa, pay] = await Promise.all([
    prisma.productionEntry.aggregate({ where: { ...where, carrierId: karigarId }, _sum: { carrierTotal: true } }),
    prisma.productionEntry.aggregate({ where: { ...where, overlockCarrierId: karigarId }, _sum: { overlockTotal: true } }),
    prisma.productionEntry.aggregate({ where: { ...where, flatlockKarigarId: karigarId }, _sum: { flatlockTotal: true } }),
    prisma.pressEntry.aggregate({ where: { ...where, karigarId }, _sum: { total: true } }),
    prisma.sampleEntry.aggregate({ where: { ...where, karigarId }, _sum: { total: true } }),
    prisma.payment.aggregate({ where: { ...where, karigarId }, _sum: { amount: true, salaryAmount: true } }),
  ]);
  const earned =
    num(st._sum.carrierTotal) + num(ov._sum.overlockTotal) + num(fl._sum.flatlockTotal) + num(pr._sum.total) + num(sa._sum.total) + num(pay._sum.salaryAmount);
  return earned - num(pay._sum.amount);
};
