import { notFound } from '../../lib/httpError';
import { prisma } from '../../lib/prisma';

const num = (v: { toString(): string } | null | undefined) => (v == null ? null : Number(v.toString()));
const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);

type Cell = { color: string; size: string; quantity: number };

// Everything that happened to one lot, for the header lot lookup: cut, who got it, what came
// back, accessories and deliveries. Nothing is stored here; it is all derived from the entries.
export const getLotHistory = async (organizationId: string, bookId: string, lotNumber: string) => {
  const lot = await prisma.cuttingEntry.findFirst({
    where: { organizationId, bookId, lotNumber: lotNumber.trim(), deletedAt: null },
    include: {
      book: { select: { name: true } },
      item: { select: { itemName: true, photoUrl: true } },
      party: { select: { name: true } },
      patternType: { select: { name: true } },
      rows: {
        orderBy: { sortOrder: 'asc' },
        include: {
          color: { select: { id: true, name: true } },
          quantities: { include: { size: { select: { id: true, name: true, detail: true } } } },
        },
      },
      distributions: {
        orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
        include: {
          karigar: { select: { id: true, fullName: true, workType: { select: { name: true } } } },
          quantities: { include: { color: { select: { name: true } }, size: { select: { name: true } } } },
        },
      },
      productionEntries: {
        where: { deletedAt: null },
        orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
        include: {
          carrier: { select: { id: true, fullName: true } },
          overlockCarrier: { select: { fullName: true } },
          flatlockKarigar: { select: { fullName: true } },
          quantities: { include: { color: { select: { name: true } }, size: { select: { name: true } } } },
        },
      },
      accessoryTransactions: {
        orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
        include: {
          karigar: { select: { fullName: true } },
          lines: { include: { accessory: { select: { name: true, unit: true } } } },
        },
      },
      deliveries: {
        orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
        include: { quantities: { include: { color: { select: { name: true } }, size: { select: { name: true } } } } },
      },
    },
  });
  if (!lot) throw notFound(`Lot ${lotNumber} not found in this book`);

  const cells = (rows: { color: { name: string }; size: { name: string }; quantity: number }[]): Cell[] =>
    rows.filter((q) => q.quantity > 0).map((q) => ({ color: q.color.name, size: q.size.name, quantity: q.quantity }));

  const sizeMap = new Map<string, { id: string; name: string; detail: string | null }>();
  for (const row of lot.rows) for (const q of row.quantities) sizeMap.set(q.size.id, q.size);
  const sizes = [...sizeMap.values()];
  const cutGrid = lot.rows.map((row) => ({
    color: row.color.name,
    photoUrl: row.photoUrl,
    cells: Object.fromEntries(row.quantities.map((q) => [q.size.id, q.quantity])) as Record<string, number>,
    total: row.totalQuantity,
  }));

  const distributed = sum(lot.distributions.map((d) => d.totalQuantity));
  const produced = sum(lot.productionEntries.map((p) => p.carrierQuantity));
  const delivered = sum(lot.deliveries.map((d) => d.totalQuantity));

  const karigarMap = new Map<string, { karigarId: string; name: string; workType: string; given: number; handedIn: number }>();
  for (const d of lot.distributions) {
    const row = karigarMap.get(d.karigar.id) ?? {
      karigarId: d.karigar.id,
      name: d.karigar.fullName,
      workType: d.karigar.workType.name,
      given: 0,
      handedIn: 0,
    };
    row.given += d.totalQuantity;
    karigarMap.set(d.karigar.id, row);
  }
  for (const p of lot.productionEntries) {
    const row = karigarMap.get(p.carrier.id) ?? { karigarId: p.carrier.id, name: p.carrier.fullName, workType: '', given: 0, handedIn: 0 };
    row.handedIn += p.carrierQuantity;
    karigarMap.set(p.carrier.id, row);
  }

  const stage = lot.closedAt
    ? 'closed'
    : delivered > 0 && delivered >= lot.totalQuantity
      ? 'delivered'
      : produced >= lot.totalQuantity && produced > delivered
        ? 'ready'
        : produced > 0
          ? 'in_production'
          : distributed > 0
            ? 'with_karigars'
            : 'not_given';

  const production = lot.productionEntries.map((p) => ({
    id: p.id,
    date: p.date,
    entryTime: p.entryTime,
    karigar: p.carrier.fullName,
    quantity: p.carrierQuantity,
    rate: num(p.carrierRate),
    total: num(p.carrierTotal) ?? 0,
    overlock: p.overlockCarrier ? { karigar: p.overlockCarrier.fullName, rate: num(p.overlockRate), total: num(p.overlockTotal) ?? 0 } : null,
    flatlock: p.flatlockKarigar ? { karigar: p.flatlockKarigar.fullName, rate: num(p.flatlockRate), total: num(p.flatlockTotal) ?? 0 } : null,
    remarks: p.remarks,
    cells: cells(p.quantities),
  }));
  const labourCost = sum(production.map((p) => p.total + (p.overlock?.total ?? 0) + (p.flatlock?.total ?? 0)));

  return {
    lot: {
      id: lot.id,
      lotNumber: lot.lotNumber,
      bookName: lot.book.name,
      date: lot.date,
      entryTime: lot.entryTime,
      itemName: lot.item.itemName,
      itemPhotoUrl: lot.item.photoUrl,
      partyName: lot.party.name,
      patternType: lot.patternType.name,
      isOnline: lot.isOnline,
      pieces: num(lot.pieces),
      remainingFabric: num(lot.remainingFabric),
      averageValue: num(lot.averageValue),
      averageUnit: lot.averageUnit,
      totalQuantity: lot.totalQuantity,
      closedAt: lot.closedAt,
      closeReason: lot.closeReason,
      closeNote: lot.closeNote,
      closedShortage: lot.closedShortage,
    },
    stage,
    summary: {
      cut: lot.totalQuantity,
      distributed,
      notGiven: Math.max(lot.totalQuantity - distributed, 0),
      produced,
      withKarigars: Math.max(distributed - produced, 0),
      delivered,
      readyToDeliver: Math.max(produced - delivered, 0),
      labourCost,
    },
    sizes,
    cutGrid,
    karigars: [...karigarMap.values()]
      .map((k) => ({ ...k, pending: Math.max(k.given - k.handedIn, 0) }))
      .sort((a, b) => b.pending - a.pending),
    distributions: lot.distributions.map((d) => ({
      id: d.id,
      date: d.date,
      entryTime: d.entryTime,
      karigar: d.karigar.fullName,
      workType: d.karigar.workType.name,
      total: d.totalQuantity,
      remarks: d.remarks,
      cells: cells(d.quantities),
    })),
    production,
    accessories: lot.accessoryTransactions.map((t) => ({
      id: t.id,
      type: t.type,
      date: t.date,
      entryTime: t.entryTime,
      karigar: t.karigar.fullName,
      remarks: t.remarks,
      lines: t.lines.map((l) => ({ name: l.accessory.name, unit: l.accessory.unit, quantity: Number(l.quantity.toString()) })),
    })),
    deliveries: lot.deliveries.map((d) => ({
      id: d.id,
      challanNumber: d.challanNumber,
      billNumber: d.billNumber,
      date: d.date,
      entryTime: d.entryTime,
      total: d.totalQuantity,
      remarks: d.remarks,
      cells: cells(d.quantities),
    })),
  };
};
