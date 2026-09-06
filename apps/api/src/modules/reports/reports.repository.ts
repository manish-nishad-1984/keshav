import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';

const dateFilter = (dateFrom?: Date, dateTo?: Date): Prisma.ProductionEntryWhereInput['date'] | undefined =>
  dateFrom || dateTo ? { ...(dateFrom ? { gte: dateFrom } : {}), ...(dateTo ? { lte: dateTo } : {}) } : undefined;

export const getKarigarSummary = async (organizationId: string, dateFrom?: Date, dateTo?: Date) => {
  const date = dateFilter(dateFrom, dateTo);
  const [karigars, sums] = await Promise.all([
    prisma.karigar.findMany({ where: { organizationId, deletedAt: null }, orderBy: { fullName: 'asc' } }),
    prisma.productionEntry.groupBy({
      by: ['karigarId'],
      where: { organizationId, deletedAt: null, ...(date ? { date } : {}) },
      _sum: { quantity: true, totalAmount: true },
    }),
  ]);

  const sumMap = new Map(sums.map((s) => [s.karigarId, s]));
  return karigars
    .map((karigar) => {
      const s = sumMap.get(karigar.id);
      return {
        karigarId: karigar.id,
        karigarName: karigar.fullName,
        karigarCode: karigar.code,
        totalQuantity: s?._sum.quantity ?? 0,
        totalAmount: Number(s?._sum.totalAmount ?? 0),
      };
    })
    .filter((row) => row.totalQuantity > 0);
};

export const getItemSummary = async (organizationId: string, dateFrom?: Date, dateTo?: Date) => {
  const date = dateFilter(dateFrom, dateTo);
  const [items, sums] = await Promise.all([
    prisma.item.findMany({ where: { organizationId, deletedAt: null }, orderBy: { styleNo: 'asc' } }),
    prisma.productionEntry.groupBy({
      by: ['itemId'],
      where: { organizationId, deletedAt: null, ...(date ? { date } : {}) },
      _sum: { quantity: true, totalAmount: true },
    }),
  ]);

  const sumMap = new Map(sums.map((s) => [s.itemId, s]));
  return items
    .map((item) => {
      const s = sumMap.get(item.id);
      return {
        itemId: item.id,
        styleNo: item.styleNo,
        itemName: item.itemName,
        totalQuantity: s?._sum.quantity ?? 0,
        totalAmount: Number(s?._sum.totalAmount ?? 0),
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
  const conditions = [Prisma.sql`"organizationId" = ${organizationId}::uuid`, Prisma.sql`"deletedAt" IS NULL`];
  if (dateFrom) conditions.push(Prisma.sql`"date" >= ${dateFrom}`);
  if (dateTo) conditions.push(Prisma.sql`"date" <= ${dateTo}`);
  const where = Prisma.join(conditions, ' AND ');

  const rows = await prisma.$queryRaw<{ month: string; totalQuantity: number; totalAmount: string }[]>(Prisma.sql`
    SELECT to_char(date_trunc('month', "date"), 'YYYY-MM') AS month,
           SUM("quantity")::int AS "totalQuantity",
           SUM("totalAmount")::numeric(14,2) AS "totalAmount"
    FROM "production_entries"
    WHERE ${where}
    GROUP BY month
    ORDER BY month ASC
  `);

  return rows.map((row) => ({
    month: row.month,
    totalQuantity: row.totalQuantity,
    totalAmount: Number(row.totalAmount),
  }));
};
