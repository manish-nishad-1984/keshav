import type { Prisma } from '@prisma/client';

// Where a karigar stands on each accessory for one lot they took:
//   limit    = pieces taken (Cutting Distribution) × per-piece need of the lot's design
//   net      = issued − returned
//   used     = pieces made (Daily Production Entry, capped at pieces taken) × per-piece, capped at net
//   holding  = net − used         (still with the karigar: to be used or returned)
//   canIssue = limit − net        (more that may still be given — never above the limit)
export interface AccessoryLinePosition {
  accessoryId: string;
  name: string;
  unit: string;
  perPiece: number;
  limit: number;
  issued: number;
  returned: number;
  used: number;
  holding: number;
  canIssue: number;
}

export interface KarigarLotPosition {
  karigar: { id: string; code: string; fullName: string };
  lot: { id: string; lotNumber: string; bookId: string; item: { id: string; itemName: string } };
  piecesTaken: number;
  piecesMade: number;
  lines: AccessoryLinePosition[];
}

// Quantities are DECIMAL(…, 3); keep the math on three decimals so 0.1 + 0.2 stays 0.3.
export const round3 = (n: number) => Math.round(n * 1000) / 1000;

const pairKey = (karigarId: string, cuttingEntryId: string) => `${karigarId}:${cuttingEntryId}`;

interface PositionFilter {
  bookId?: string;
  karigarId?: string;
  cuttingEntryId?: string;
  excludeTransactionId?: string;
  // A karigar + lot to include even if nothing was issued yet (the issue form).
  pair?: { karigarId: string; cuttingEntryId: string };
}

export const computePositions = async (
  db: Prisma.TransactionClient,
  organizationId: string,
  filter: PositionFilter,
): Promise<KarigarLotPosition[]> => {
  const lines = await db.accessoryTransactionLine.findMany({
    where: {
      transaction: {
        organizationId,
        ...(filter.karigarId ? { karigarId: filter.karigarId } : {}),
        ...(filter.cuttingEntryId ? { cuttingEntryId: filter.cuttingEntryId } : {}),
        ...(filter.bookId ? { cuttingEntry: { bookId: filter.bookId } } : {}),
        ...(filter.excludeTransactionId ? { id: { not: filter.excludeTransactionId } } : {}),
      },
    },
    select: {
      accessoryId: true,
      quantity: true,
      transaction: { select: { type: true, karigarId: true, cuttingEntryId: true } },
    },
  });

  const pairs = new Map<string, { karigarId: string; cuttingEntryId: string }>();
  for (const l of lines) {
    pairs.set(pairKey(l.transaction.karigarId, l.transaction.cuttingEntryId), {
      karigarId: l.transaction.karigarId,
      cuttingEntryId: l.transaction.cuttingEntryId,
    });
  }
  if (filter.pair) pairs.set(pairKey(filter.pair.karigarId, filter.pair.cuttingEntryId), filter.pair);
  if (pairs.size === 0) return [];

  const lotIds = [...new Set([...pairs.values()].map((p) => p.cuttingEntryId))];
  const karigarIds = [...new Set([...pairs.values()].map((p) => p.karigarId))];

  const [lots, karigars, taken, made] = await Promise.all([
    db.cuttingEntry.findMany({
      where: { id: { in: lotIds }, organizationId },
      select: {
        id: true,
        lotNumber: true,
        bookId: true,
        item: { select: { id: true, itemName: true, accessories: { include: { accessory: true } } } },
      },
    }),
    db.karigar.findMany({ where: { id: { in: karigarIds }, organizationId }, select: { id: true, code: true, fullName: true } }),
    db.cuttingDistribution.groupBy({
      by: ['karigarId', 'cuttingEntryId'],
      where: { cuttingEntryId: { in: lotIds }, karigarId: { in: karigarIds } },
      _sum: { totalQuantity: true },
    }),
    db.productionEntry.groupBy({
      by: ['carrierId', 'cuttingEntryId'],
      where: { cuttingEntryId: { in: lotIds }, carrierId: { in: karigarIds }, deletedAt: null },
      _sum: { carrierQuantity: true },
    }),
  ]);

  // Accessories issued earlier but no longer in the design still need a name.
  const known = new Set(lots.flatMap((lot) => lot.item.accessories.map((a) => a.accessoryId)));
  const extraIds = [...new Set(lines.map((l) => l.accessoryId))].filter((id) => !known.has(id));
  const extras = extraIds.length ? await db.accessory.findMany({ where: { id: { in: extraIds } } }) : [];
  const accessoryInfo = new Map<string, { name: string; unit: string }>([
    ...lots.flatMap((lot) => lot.item.accessories.map((a) => [a.accessoryId, { name: a.accessory.name, unit: a.accessory.unit }] as const)),
    ...extras.map((a) => [a.id, { name: a.name, unit: a.unit }] as const),
  ]);

  const takenBy = new Map(taken.map((t) => [pairKey(t.karigarId, t.cuttingEntryId), t._sum.totalQuantity ?? 0]));
  const madeBy = new Map(made.map((m) => [pairKey(m.carrierId, m.cuttingEntryId!), m._sum.carrierQuantity ?? 0]));
  const lotById = new Map(lots.map((l) => [l.id, l]));
  const karigarById = new Map(karigars.map((k) => [k.id, k]));

  const moved = new Map<string, { issued: number; returned: number }>();
  for (const l of lines) {
    const key = `${pairKey(l.transaction.karigarId, l.transaction.cuttingEntryId)}:${l.accessoryId}`;
    const entry = moved.get(key) ?? { issued: 0, returned: 0 };
    if (l.transaction.type === 'ISSUE') entry.issued += Number(l.quantity);
    else entry.returned += Number(l.quantity);
    moved.set(key, entry);
  }

  const positions: KarigarLotPosition[] = [];
  for (const [key, pair] of pairs) {
    const lot = lotById.get(pair.cuttingEntryId);
    const karigar = karigarById.get(pair.karigarId);
    if (!lot || !karigar) continue;

    const piecesTaken = takenBy.get(key) ?? 0;
    const piecesMade = madeBy.get(key) ?? 0;
    const effectiveMade = Math.min(piecesMade, piecesTaken);
    const perPiece = new Map(lot.item.accessories.map((a) => [a.accessoryId, Number(a.quantityPerPiece)]));
    const accessoryIds = new Set([
      ...perPiece.keys(),
      ...lines
        .filter((l) => pairKey(l.transaction.karigarId, l.transaction.cuttingEntryId) === key)
        .map((l) => l.accessoryId),
    ]);

    const positionLines = [...accessoryIds].map((accessoryId) => {
      const need = perPiece.get(accessoryId) ?? 0;
      const { issued, returned } = moved.get(`${key}:${accessoryId}`) ?? { issued: 0, returned: 0 };
      const limit = round3(piecesTaken * need);
      const net = round3(issued - returned);
      const used = round3(Math.max(Math.min(effectiveMade * need, net), 0));
      const info = accessoryInfo.get(accessoryId) ?? { name: 'Accessory', unit: '' };
      return {
        accessoryId,
        name: info.name,
        unit: info.unit,
        perPiece: need,
        limit,
        issued: round3(issued),
        returned: round3(returned),
        used,
        holding: round3(net - used),
        canIssue: round3(Math.max(limit - net, 0)),
      };
    });
    positionLines.sort((a, b) => a.name.localeCompare(b.name));

    positions.push({
      karigar,
      lot: { id: lot.id, lotNumber: lot.lotNumber, bookId: lot.bookId, item: { id: lot.item.id, itemName: lot.item.itemName } },
      piecesTaken,
      piecesMade,
      lines: positionLines,
    });
  }
  return positions;
};
