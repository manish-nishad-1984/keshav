import { prisma } from '../../lib/prisma';

// `date` columns are stored as UTC-midnight instants of the calendar day the user picked (a plain
// "YYYY-MM-DD" input parses that way per the JS Date spec — see ProductionEntryPage's date input).
// Building "today"/"N days ago" via `new Date()` + `setHours(0,0,0,0)` instead would zero the
// clock in the SERVER's local timezone, which is a different instant whenever that timezone isn't
// UTC — the exact bug documented in reports.repository.ts, just on the JS side instead of raw SQL.
// Going through a local "YYYY-MM-DD" key first keeps "today" meaning the local calendar day while
// still producing a Date that matches how entries are actually stored.
const localDateKey = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const utcMidnight = (dateKey: string) => new Date(`${dateKey}T00:00:00.000Z`);

const startOfToday = () => utcMidnight(localDateKey(new Date()));

const startOfMonth = () => {
  const d = new Date();
  return utcMidnight(localDateKey(new Date(d.getFullYear(), d.getMonth(), 1)));
};

const daysAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return utcMidnight(localDateKey(d));
};

export const getCounts = async (organizationId: string) => {
  const today = startOfToday();

  const [totalKarigars, todayAgg, allTimeProduction, allTimePayments] = await Promise.all([
    prisma.karigar.count({ where: { organizationId, deletedAt: null, isActive: true } }),
    prisma.productionEntry.aggregate({
      where: { organizationId, deletedAt: null, date: today },
      _sum: { carrierQuantity: true, carrierTotal: true },
    }),
    prisma.productionEntry.aggregate({
      where: { organizationId, deletedAt: null },
      _sum: { carrierTotal: true },
    }),
    prisma.payment.aggregate({
      where: { organizationId, deletedAt: null },
      _sum: { amount: true },
    }),
  ]);

  const totalProduced = Number(allTimeProduction._sum.carrierTotal ?? 0);
  const totalPaid = Number(allTimePayments._sum.amount ?? 0);

  return {
    totalKarigars,
    todayPieces: todayAgg._sum.carrierQuantity ?? 0,
    todayAmount: Number(todayAgg._sum.carrierTotal ?? 0),
    pendingPayment: Math.max(totalProduced - totalPaid, 0),
  };
};

// Uses `to_char` for the date label for the same reason as the reports module's monthly summary:
// node-postgres parses raw DATE results using the server's local timezone, which would otherwise
// shift the label by a day depending on where the server runs.
export const getProductionTrend = async (organizationId: string) => {
  const since = daysAgo(6);

  const rows = await prisma.$queryRaw<{ day: string; quantity: number; amount: string }[]>`
    SELECT to_char("date", 'YYYY-MM-DD') AS day,
           SUM("carrierQuantity")::int AS quantity,
           SUM("carrierTotal")::numeric(14,2) AS amount
    FROM "production_entries"
    WHERE "organizationId" = ${organizationId}::uuid
      AND "deletedAt" IS NULL
      AND "date" >= ${since}
    GROUP BY day
    ORDER BY day ASC
  `;

  const byDay = new Map(rows.map((r) => [r.day, { quantity: r.quantity, amount: Number(r.amount) }]));
  const result: { day: string; quantity: number; amount: number }[] = [];
  for (let i = 6; i >= 0; i -= 1) {
    const d = daysAgo(i);
    const key = d.toISOString().slice(0, 10);
    const entry = byDay.get(key);
    result.push({ day: key, quantity: entry?.quantity ?? 0, amount: entry?.amount ?? 0 });
  }
  return result;
};

export const getTopKarigars = async (organizationId: string, limit = 5) => {
  const month = startOfMonth();

  const sums = await prisma.productionEntry.groupBy({
    by: ['carrierId'],
    where: { organizationId, deletedAt: null, date: { gte: month } },
    _sum: { carrierQuantity: true, carrierTotal: true },
    orderBy: { _sum: { carrierTotal: 'desc' } },
    take: limit,
  });

  if (sums.length === 0) return [];

  const karigars = await prisma.karigar.findMany({
    where: { id: { in: sums.map((s) => s.carrierId) } },
    select: { id: true, fullName: true, code: true, photoUrl: true },
  });
  const karigarMap = new Map(karigars.map((k) => [k.id, k]));

  return sums.map((s) => {
    const karigar = karigarMap.get(s.carrierId);
    return {
      karigarId: s.carrierId,
      karigarName: karigar?.fullName ?? 'Unknown',
      karigarCode: karigar?.code ?? '',
      photoUrl: karigar?.photoUrl ?? null,
      totalQuantity: s._sum.carrierQuantity ?? 0,
      totalAmount: Number(s._sum.carrierTotal ?? 0),
    };
  });
};

export const getWorkTypeBreakdown = async (organizationId: string) => {
  const month = startOfMonth();

  const sums = await prisma.productionEntry.groupBy({
    by: ['workTypeId'],
    where: { organizationId, deletedAt: null, date: { gte: month } },
    _sum: { carrierQuantity: true },
  });

  if (sums.length === 0) return [];

  const workTypes = await prisma.workType.findMany({
    where: { id: { in: sums.map((s) => s.workTypeId) } },
    select: { id: true, name: true },
  });
  const nameMap = new Map(workTypes.map((w) => [w.id, w.name]));

  return sums
    .map((s) => ({
      workTypeId: s.workTypeId,
      workTypeName: nameMap.get(s.workTypeId) ?? 'Unknown',
      totalQuantity: s._sum.carrierQuantity ?? 0,
    }))
    .sort((a, b) => b.totalQuantity - a.totalQuantity);
};
