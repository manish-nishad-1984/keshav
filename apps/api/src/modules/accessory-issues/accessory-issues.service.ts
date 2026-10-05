import { badRequest, conflict, notFound } from '../../lib/httpError';
import { prisma } from '../../lib/prisma';
import { getCuttingEntry } from '../cutting/cutting.service';
import { getKarigar } from '../karigars/karigars.service';
import { assertAccessoriesExist } from '../accessories/accessories.service';
import * as repo from './accessory-issues.repository';
import type { TransactionLine } from './accessory-issues.repository';
import { computePositions, round3 } from './accessory-positions';
import type { KarigarLotPosition } from './accessory-positions';
import type { CreateTransactionInput, ListTransactionsQuery, UpdateTransactionInput } from './accessory-issues.schema';

type Db = Parameters<typeof computePositions>[0];
type TransactionType = 'ISSUE' | 'RETURN';

// Decimal quantities are compared with a little slack so 0.1 + 0.2 never trips a limit.
const EPS = 0.0005;
const fmt = (n: number) => String(round3(n));

export const listTransactions = (organizationId: string, query: ListTransactionsQuery) =>
  repo.listTransactions(organizationId, query.page, query.pageSize, {
    bookId: query.bookId,
    karigarId: query.karigarId,
    type: query.type,
    search: query.search,
  });

export const getTransaction = async (organizationId: string, id: string) => {
  const transaction = await repo.findTransactionById(organizationId, id);
  if (!transaction) throw notFound('Accessory entry not found');
  return transaction;
};

export const listKarigarLots = async (organizationId: string, karigarId: string, bookId: string) => {
  await getKarigar(organizationId, karigarId);
  return repo.listKarigarLots(organizationId, karigarId, bookId);
};

const positionFor = async (
  db: Db,
  organizationId: string,
  karigarId: string,
  cuttingEntryId: string,
  excludeTransactionId?: string,
): Promise<KarigarLotPosition> => {
  const [position] = await computePositions(db, organizationId, {
    karigarId,
    cuttingEntryId,
    excludeTransactionId,
    pair: { karigarId, cuttingEntryId },
  });
  if (!position) throw notFound('Lot not found');
  return position;
};

// The issue form: this karigar + lot line by line, plus what the karigar still holds from other
// lots (shown as a warning only — it does not block issuing).
export const getPosition = async (organizationId: string, karigarId: string, cuttingEntryId: string, excludeId?: string) => {
  await Promise.all([getKarigar(organizationId, karigarId), getCuttingEntry(organizationId, cuttingEntryId)]);
  const [position, all] = await Promise.all([
    positionFor(prisma, organizationId, karigarId, cuttingEntryId, excludeId),
    computePositions(prisma, organizationId, { karigarId }),
  ]);

  const pending = new Map<string, { accessoryId: string; name: string; unit: string; holding: number; lots: string[] }>();
  for (const other of all.filter((p) => p.lot.id !== cuttingEntryId)) {
    for (const line of other.lines.filter((l) => l.holding > EPS)) {
      const entry = pending.get(line.accessoryId) ?? { accessoryId: line.accessoryId, name: line.name, unit: line.unit, holding: 0, lots: [] };
      entry.holding = round3(entry.holding + line.holding);
      entry.lots.push(other.lot.lotNumber);
      pending.set(line.accessoryId, entry);
    }
  }
  return { ...position, pendingElsewhere: [...pending.values()] };
};

export const getBalance = (organizationId: string, bookId: string, karigarId?: string) =>
  computePositions(prisma, organizationId, { bookId, karigarId });

// Checks the new quantities of one transaction against the karigar's position on the lot
// (computed without that transaction).
const checkLines = (type: TransactionType, position: KarigarLotPosition, lines: TransactionLine[]) => {
  const lot = position.lot.lotNumber;
  if (type === 'ISSUE') {
    const byId = new Map(lines.map((l) => [l.accessoryId, l.quantity]));
    for (const l of lines) {
      const line = position.lines.find((p) => p.accessoryId === l.accessoryId);
      if (!line || line.perPiece === 0) {
        throw badRequest(
          `Design ${position.lot.item.itemName} doesn't use ${line?.name ?? 'this accessory'} — add it to the design in Accessory Master first`,
        );
      }
      if (round3(line.issued - line.returned + l.quantity) > line.limit + EPS) {
        throw badRequest(
          `Only ${fmt(line.canIssue)} ${line.unit} ${line.name} can be given for lot ${lot} (limit ${fmt(line.limit)}, already given ${fmt(line.issued - line.returned)})`,
        );
      }
    }
    // Lowering an issue must not leave more returned than issued.
    for (const line of position.lines) {
      if (line.issued - line.returned + (byId.get(line.accessoryId) ?? 0) < -EPS) {
        throw badRequest(`${line.name}: ${fmt(line.returned)} ${line.unit} were already returned for lot ${lot} — the issue can't be lower than that`);
      }
    }
    return;
  }

  for (const l of lines) {
    const line = position.lines.find((p) => p.accessoryId === l.accessoryId);
    const holding = line?.holding ?? 0;
    if (l.quantity > holding + EPS) {
      throw badRequest(
        `${position.karigar.fullName} holds only ${fmt(holding)} ${line?.unit ?? ''} ${line?.name ?? 'of this accessory'} from lot ${lot}`.replace(/\s+/g, ' '),
      );
    }
  }
};

const cleanLines = async (organizationId: string, lines: TransactionLine[]) => {
  const kept = lines.filter((l) => l.quantity > 0).map((l) => ({ accessoryId: l.accessoryId, quantity: round3(l.quantity) }));
  await assertAccessoriesExist(organizationId, kept.map((l) => l.accessoryId));
  return kept;
};

export const createTransaction = async (organizationId: string, input: CreateTransactionInput, actorId: string | null) => {
  await Promise.all([getKarigar(organizationId, input.karigarId), getCuttingEntry(organizationId, input.cuttingEntryId)]);
  const { lines: rawLines, ...header } = input;
  const lines = await cleanLines(organizationId, rawLines);

  return prisma.$transaction(async (tx) => {
    await repo.lockKarigarLot(tx, input.karigarId, input.cuttingEntryId);
    const position = await positionFor(tx, organizationId, input.karigarId, input.cuttingEntryId);
    if (position.piecesTaken === 0) {
      throw badRequest(`${position.karigar.fullName} has not taken any pieces of lot ${position.lot.lotNumber} (Cutting Distribution)`);
    }
    checkLines(input.type, position, lines);
    return repo.createTransaction(tx, organizationId, header, lines, actorId);
  });
};

export const updateTransaction = async (
  organizationId: string,
  id: string,
  input: UpdateTransactionInput,
  actorId: string | null,
) => {
  const existing = await getTransaction(organizationId, id);
  const { lines: rawLines, ...header } = input;
  const lines = rawLines ? await cleanLines(organizationId, rawLines) : undefined;

  return prisma.$transaction(async (tx) => {
    if (lines) {
      await repo.lockKarigarLot(tx, existing.karigarId, existing.cuttingEntryId);
      const position = await positionFor(tx, organizationId, existing.karigarId, existing.cuttingEntryId, id);
      checkLines(existing.type, position, lines);
    }
    return repo.updateTransaction(tx, id, header, lines, actorId);
  });
};

export const deleteTransaction = async (organizationId: string, id: string) => {
  const existing = await getTransaction(organizationId, id);

  await prisma.$transaction(async (tx) => {
    await repo.lockKarigarLot(tx, existing.karigarId, existing.cuttingEntryId);
    const position = await positionFor(tx, organizationId, existing.karigarId, existing.cuttingEntryId, id);
    for (const line of position.lines) {
      const net = line.issued - line.returned;
      // Removing a return puts the accessory back with the karigar — it must still fit the limit.
      if (existing.type === 'RETURN' && net > line.limit + EPS) {
        throw conflict(`Deleting this return would leave ${line.name} above the limit for lot ${position.lot.lotNumber}`);
      }
      if (existing.type === 'ISSUE' && net < -EPS) {
        throw conflict(`${line.name} was partly returned from this issue — delete the return first`);
      }
    }
    await repo.deleteTransaction(tx, id);
  });
};
