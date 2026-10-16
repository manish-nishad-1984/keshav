import { prisma } from '../../lib/prisma';
import { computePendingReturns } from '../accessory-issues/accessory-positions';
import { getLedger } from '../payments/payments.repository';
import { getEarningsByKarigar } from '../payments/earnings';

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

// Production entries whose wage is still ₹0 because a rate was left empty (stitching, or a chosen
// overlock / flatlock karigar).
export const countEntriesWithoutRate = (organizationId: string) =>
  prisma.productionEntry.count({
    where: {
      organizationId,
      deletedAt: null,
      OR: [
        { carrierRate: null },
        { carrierRate: 0 },
        { overlockCarrierId: { not: null }, overlockRate: null },
        { flatlockKarigarId: { not: null }, flatlockRate: null },
      ],
    },
  });

export const getCounts = async (organizationId: string) => {
  const today = startOfToday();

  const [totalKarigars, todayAgg, todayPress, todaySample, ledger, pendingRates, returnsDue] = await Promise.all([


    prisma.karigar.count({ where: { organizationId, deletedAt: null, isActive: true } }),
    prisma.productionEntry.aggregate({
      where: { organizationId, deletedAt: null, date: today },
      _sum: { carrierQuantity: true, carrierTotal: true, overlockTotal: true, flatlockTotal: true },
    }),
    prisma.pressEntry.aggregate({ where: { organizationId, deletedAt: null, date: today }, _sum: { total: true } }),
    prisma.sampleEntry.aggregate({ where: { organizationId, deletedAt: null, date: today }, _sum: { total: true } }),
    getLedger(organizationId),
    countEntriesWithoutRate(organizationId),
    computePendingReturns(prisma, organizationId),
  ]);

  return {
    totalKarigars,
    todayPieces: todayAgg._sum.carrierQuantity ?? 0,
    // Everything earned today: stitching + overlock + flatlock + press + sample work.
    todayAmount:
      Number(todayAgg._sum.carrierTotal ?? 0) +
      Number(todayAgg._sum.overlockTotal ?? 0) +
      Number(todayAgg._sum.flatlockTotal ?? 0) +
      Number(todayPress._sum.total ?? 0) +
      Number(todaySample._sum.total ?? 0),
    // Same figure as the Payments ledger: what is still owed to karigars (advances don't reduce it).
    pendingPayment: ledger.reduce((sum, row) => sum + Math.max(row.pending, 0), 0),
    entriesWithoutRate: pendingRates,
    // Karigars who still have to bring back accessories of pieces sent for alteration.
    accessoryReturnKarigars: new Set(returnsDue.map((p) => p.karigar.id)).size,
    accessoryReturnLots: new Set(returnsDue.map((p) => p.lot.id)).size,
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

// Top earners this month, on the same earnings as the ledger.
export const getTopKarigars = async (organizationId: string, limit = 5) => {
  const earnings = await getEarningsByKarigar(organizationId, { dateFrom: startOfMonth() });
  const top = [...earnings.entries()].sort((x, y) => y[1].total - x[1].total).filter(([, e]) => e.total > 0 || e.pieces > 0).slice(0, limit);
  if (top.length === 0) return [];

  const karigars = await prisma.karigar.findMany({
    where: { id: { in: top.map(([id]) => id) } },
    select: { id: true, fullName: true, code: true, photoUrl: true },
  });
  const karigarMap = new Map(karigars.map((k) => [k.id, k]));

  return top.map(([id, e]) => {
    const karigar = karigarMap.get(id);
    return {
      karigarId: id,
      karigarName: karigar?.fullName ?? 'Unknown',
      karigarCode: karigar?.code ?? '',
      photoUrl: karigar?.photoUrl ?? null,
      totalQuantity: e.pieces,
      totalAmount: e.total,
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

export type LotStage = 'not_given' | 'with_karigars' | 'in_production' | 'ready' | 'delivered' | 'closed';

// One line per lot of the book: cut, given to karigars, finished, delivered, and where each karigar
// stands. "With karigar" is what was given minus what they handed in.
export const getLotStatus = async (organizationId: string, bookId?: string) => {
  const lots = await prisma.cuttingEntry.findMany({
    where: { organizationId, deletedAt: null, ...(bookId ? { bookId } : {}) },
    select: {
      id: true,
      lotNumber: true,
      date: true,
      totalQuantity: true,
      isOnline: true,
      closedAt: true,
      closeReason: true,
      closedShortage: true,
      closedAlteration: true,
      item: { select: { itemName: true } },
      party: { select: { name: true } },
    },
    orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
  });
  if (!lots.length) return [];
  const lotIds = lots.map((l) => l.id);

  const [given, handedIn, delivered] = await Promise.all([
    prisma.cuttingDistribution.groupBy({ by: ['cuttingEntryId', 'karigarId'], where: { cuttingEntryId: { in: lotIds } }, _sum: { totalQuantity: true } }),
    prisma.productionEntry.groupBy({ by: ['cuttingEntryId', 'carrierId'], where: { cuttingEntryId: { in: lotIds }, deletedAt: null }, _sum: { carrierQuantity: true, alterationQuantity: true } }),
    prisma.delivery.groupBy({ by: ['cuttingEntryId'], where: { cuttingEntryId: { in: lotIds } }, _sum: { totalQuantity: true } }),
  ]);
  const karigarIds = [...new Set([...given.map((g) => g.karigarId), ...handedIn.map((h) => h.carrierId)])];
  const karigars = await prisma.karigar.findMany({ where: { id: { in: karigarIds } }, select: { id: true, fullName: true, workType: { select: { name: true } } } });
  const karigarById = new Map(karigars.map((k) => [k.id, k]));
  const handedBy = new Map(handedIn.map((h) => [`${h.cuttingEntryId}:${h.carrierId}`, h._sum.carrierQuantity ?? 0]));
  const alterationBy = new Map(handedIn.map((h) => [`${h.cuttingEntryId}:${h.carrierId}`, h._sum.alterationQuantity ?? 0]));
  const deliveredBy = new Map(delivered.map((d) => [d.cuttingEntryId, d._sum.totalQuantity ?? 0]));

  return lots.map((lot) => {
    const rows = given.filter((g) => g.cuttingEntryId === lot.id).map((g) => {
      const took = g._sum.totalQuantity ?? 0;
      const done = handedBy.get(`${lot.id}:${g.karigarId}`) ?? 0;
      const k = karigarById.get(g.karigarId);
      const alt = alterationBy.get(`${lot.id}:${g.karigarId}`) ?? 0;
      return { karigarId: g.karigarId, name: k?.fullName ?? 'Unknown', workType: k?.workType.name ?? '', given: took, handedIn: done, alteration: alt, pending: Math.max(took - done - alt, 0) };
    });
    const distributed = rows.reduce((s, r) => s + r.given, 0);
    const produced = rows.reduce((s, r) => s + r.handedIn, 0);
    const alteration = rows.reduce((s, r) => s + r.alteration, 0);
    const deliveredQty = deliveredBy.get(lot.id) ?? 0;
    const stage: LotStage = lot.closedAt
      ? 'closed'
      : deliveredQty > 0 && deliveredQty >= lot.totalQuantity
        ? 'delivered'
        : produced >= lot.totalQuantity && produced > deliveredQty
          ? 'ready'
          : produced > 0
            ? 'in_production'
            : distributed > 0
              ? 'with_karigars'
              : 'not_given';
    return {
      id: lot.id,
      lotNumber: lot.lotNumber,
      date: lot.date,
      isOnline: lot.isOnline,
      itemName: lot.item.itemName,
      partyName: lot.party.name,
      cut: lot.totalQuantity,
      notGiven: Math.max(lot.totalQuantity - distributed, 0),
      withKarigars: rows.reduce((s, r) => s + r.pending, 0),
      produced,
      readyToDeliver: Math.max(produced - deliveredQty, 0),
      delivered: deliveredQty,
      stage,
      closeReason: lot.closeReason,
      closedShortage: lot.closedShortage,
      closedAlteration: lot.closedAlteration,
      alteration,
      karigars: rows.sort((a, b) => b.pending - a.pending),
    };
  });
};
