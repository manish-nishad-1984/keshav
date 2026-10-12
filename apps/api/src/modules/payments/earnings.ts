import { prisma } from '../../lib/prisma';

export interface KarigarEarning {
  pieces: number;
  stitching: number;
  overlock: number;
  flatlock: number;
  press: number;
  sample: number;
  salary: number;
  total: number;
}

const empty = (): KarigarEarning => ({ pieces: 0, stitching: 0, overlock: 0, flatlock: 0, press: 0, sample: 0, salary: 0, total: 0 });

// The one place that decides what a karigar has earned: stitching + overlock + flatlock from
// production entries, press entries, sample work, and fixed salaries (earned when the salary is worked out).
// The ledger, dashboard and reports all read this, so they always agree. `range` limits by entry date.
export const getEarningsByKarigar = async (organizationId: string, range: { dateFrom?: Date; dateTo?: Date } = {}) => {
  const date = range.dateFrom || range.dateTo ? { ...(range.dateFrom ? { gte: range.dateFrom } : {}), ...(range.dateTo ? { lte: range.dateTo } : {}) } : undefined;
  const base = { organizationId, deletedAt: null, ...(date ? { date } : {}) };

  const [carrier, overlock, flatlock, press, sample, salary] = await Promise.all([

    prisma.productionEntry.groupBy({ by: ['carrierId'], where: base, _sum: { carrierQuantity: true, carrierTotal: true } }),
    prisma.productionEntry.groupBy({ by: ['overlockCarrierId'], where: { ...base, overlockCarrierId: { not: null } }, _sum: { overlockTotal: true } }),
    prisma.productionEntry.groupBy({ by: ['flatlockKarigarId'], where: { ...base, flatlockKarigarId: { not: null } }, _sum: { flatlockTotal: true } }),
    prisma.pressEntry.groupBy({ by: ['karigarId'], where: base, _sum: { total: true } }),
    prisma.sampleEntry.groupBy({ by: ['karigarId'], where: base, _sum: { total: true } }),
    prisma.payment.groupBy({ by: ['karigarId'], where: { ...base, salaryAmount: { not: null } }, _sum: { salaryAmount: true } }),
  ]);

  const out = new Map<string, KarigarEarning>();
  const row = (id: string) => {
    let r = out.get(id);
    if (!r) out.set(id, (r = empty()));
    return r;
  };
  carrier.forEach((s) => {
    const r = row(s.carrierId);
    r.pieces += s._sum.carrierQuantity ?? 0;
    r.stitching += Number(s._sum.carrierTotal ?? 0);
  });
  overlock.forEach((s) => (row(s.overlockCarrierId!).overlock += Number(s._sum.overlockTotal ?? 0)));
  flatlock.forEach((s) => (row(s.flatlockKarigarId!).flatlock += Number(s._sum.flatlockTotal ?? 0)));
  press.forEach((s) => (row(s.karigarId).press += Number(s._sum.total ?? 0)));
  sample.forEach((s) => (row(s.karigarId).sample += Number(s._sum.total ?? 0)));
  salary.forEach((s) => (row(s.karigarId).salary += Number(s._sum.salaryAmount ?? 0)));
  out.forEach((r) => (r.total = r.stitching + r.overlock + r.flatlock + r.press + r.sample + r.salary));
  return out;
};

export const getPaidByKarigar = async (organizationId: string) => {
  const sums = await prisma.payment.groupBy({ by: ['karigarId'], where: { organizationId, deletedAt: null }, _sum: { amount: true } });
  return new Map(sums.map((s) => [s.karigarId, Number(s._sum.amount ?? 0)]));
};

// What a karigar is still owed (earned − paid); `excludePaymentId` leaves out a payment being edited.
export const getKarigarPending = async (organizationId: string, karigarId: string, excludePaymentId?: string) => {
  const [earnings, paid] = await Promise.all([
    getEarningsByKarigar(organizationId),
    prisma.payment.aggregate({
      where: { organizationId, karigarId, deletedAt: null, ...(excludePaymentId ? { id: { not: excludePaymentId } } : {}) },
      _sum: { amount: true },
    }),
  ]);
  return (earnings.get(karigarId)?.total ?? 0) - Number(paid._sum.amount ?? 0);
};
