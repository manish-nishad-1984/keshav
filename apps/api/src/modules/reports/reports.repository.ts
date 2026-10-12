import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { getEarningsByKarigar } from '../payments/earnings';

const dateFilter = (dateFrom?: Date, dateTo?: Date): Prisma.ProductionEntryWhereInput['date'] | undefined =>
  dateFrom || dateTo ? { ...(dateFrom ? { gte: dateFrom } : {}), ...(dateTo ? { lte: dateTo } : {}) } : undefined;

// Per-karigar report on the shared earnings (stitching, overlock, flatlock, press, salary) — the
// same figures as the Payments ledger and the dashboard.
export const getKarigarSummary = async (organizationId: string, dateFrom?: Date, dateTo?: Date) => {
  const [karigars, earnings] = await Promise.all([
    prisma.karigar.findMany({ where: { organizationId, deletedAt: null }, orderBy: { fullName: 'asc' } }),
    getEarningsByKarigar(organizationId, { dateFrom, dateTo }),
  ]);
  return karigars
    .map((karigar) => ({
      karigarId: karigar.id,
      karigarName: karigar.fullName,
      karigarCode: karigar.code,
      totalQuantity: earnings.get(karigar.id)?.pieces ?? 0,
      totalAmount: earnings.get(karigar.id)?.total ?? 0,
    }))
    .filter((row) => row.totalQuantity > 0 || row.totalAmount > 0);
};

export const getItemSummary = async (organizationId: string, dateFrom?: Date, dateTo?: Date) => {
  const date = dateFilter(dateFrom, dateTo);
  const [items, sums] = await Promise.all([
    prisma.item.findMany({ where: { organizationId, deletedAt: null }, orderBy: { itemName: 'asc' } }),
    prisma.productionEntry.groupBy({
      by: ['itemId'],
      where: { organizationId, deletedAt: null, ...(date ? { date } : {}) },
      _sum: { carrierQuantity: true, carrierTotal: true },
    }),
  ]);

  const sumMap = new Map(sums.map((s) => [s.itemId, s]));
  return items
    .map((item) => {
      const s = sumMap.get(item.id);
      return {
        itemId: item.id,
        itemName: item.itemName,
        totalQuantity: s?._sum.carrierQuantity ?? 0,
        totalAmount: Number(s?._sum.carrierTotal ?? 0),
      };
    })
    .filter((row) => row.totalQuantity > 0);
};

// Prisma's groupBy can't truncate a date to month — raw SQL is the only way to get this
// aggregation shape. `month` is returned as a plain "YYYY-MM" string (via to_char), not a Date —
// node-postgres parses a raw DATE result using the server process's LOCAL timezone (not UTC),
// so on a server running outside IST this would silently attach the wrong calendar month once
// serialized back to a JS Date. A plain string sidesteps that entirely; the frontend formats it
// without ever constructing a Date from it.
export const getMonthlySummary = async (organizationId: string, dateFrom?: Date, dateTo?: Date) => {
  const where = (extra: Prisma.Sql[] = []) => {
    const conditions = [Prisma.sql`"organizationId" = ${organizationId}::uuid`, Prisma.sql`"deletedAt" IS NULL`, ...extra];
    if (dateFrom) conditions.push(Prisma.sql`"date" >= ${dateFrom}`);
    if (dateTo) conditions.push(Prisma.sql`"date" <= ${dateTo}`);
    return Prisma.join(conditions, ' AND ');
  };

  const [production, press, sample, salary] = await Promise.all([

    prisma.$queryRaw<{ month: string; totalQuantity: number; totalAmount: string }[]>(Prisma.sql`
      SELECT to_char(date_trunc('month', "date"), 'YYYY-MM') AS month,
             SUM("carrierQuantity")::int AS "totalQuantity",
             SUM("carrierTotal" + COALESCE("overlockTotal", 0) + COALESCE("flatlockTotal", 0))::numeric(14,2) AS "totalAmount"
      FROM "production_entries"
      WHERE ${where()}
      GROUP BY month
    `),
    prisma.$queryRaw<{ month: string; totalAmount: string }[]>(Prisma.sql`
      SELECT to_char(date_trunc('month', "date"), 'YYYY-MM') AS month, SUM("total")::numeric(14,2) AS "totalAmount"
      FROM "press_entries"
      WHERE ${where()}
      GROUP BY month
    `),
    prisma.$queryRaw<{ month: string; totalAmount: string }[]>(Prisma.sql`
      SELECT to_char(date_trunc('month', "date"), 'YYYY-MM') AS month, SUM("total")::numeric(14,2) AS "totalAmount"
      FROM "sample_entries"
      WHERE ${where()}
      GROUP BY month
    `),
    prisma.$queryRaw<{ month: string; totalAmount: string }[]>(Prisma.sql`
      SELECT to_char(date_trunc('month', "date"), 'YYYY-MM') AS month, SUM("salaryAmount")::numeric(14,2) AS "totalAmount"
      FROM "payments"
      WHERE ${where([Prisma.sql`"salaryAmount" IS NOT NULL`])}
      GROUP BY month
    `),
  ]);

  // Pieces are production pieces; the amount is everything earned that month (same as the ledger).
  const months = new Map<string, { month: string; totalQuantity: number; totalAmount: number }>();
  const row = (month: string) => {
    let r = months.get(month);
    if (!r) months.set(month, (r = { month, totalQuantity: 0, totalAmount: 0 }));
    return r;
  };
  production.forEach((r) => {
    row(r.month).totalQuantity += r.totalQuantity;
    row(r.month).totalAmount += Number(r.totalAmount);
  });
  [...press, ...sample, ...salary].forEach((r) => (row(r.month).totalAmount += Number(r.totalAmount)));
  return [...months.values()].sort((x, y) => x.month.localeCompare(y.month));
};
