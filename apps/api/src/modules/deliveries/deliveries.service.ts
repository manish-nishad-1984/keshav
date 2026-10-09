import { badRequest, notFound } from '../../lib/httpError';
import { prisma } from '../../lib/prisma';
import { getCuttingEntry } from '../cutting/cutting.service';
import { assertLotOpen } from '../cutting/lot-open';
import { describeLot } from '../cutting-distribution/cutting-distribution.service';
import * as repo from './deliveries.repository';
import type { DeliveryCell } from './deliveries.repository';
import type { CreateDeliveryInput, ListDeliveriesQuery, UpdateDeliveryInput } from './deliveries.schema';

type CuttingEntryWithRows = Awaited<ReturnType<typeof getCuttingEntry>>;

const cellKey = (colorId: string, sizeId: string) => `${colorId}:${sizeId}`;

export const listDeliveries = (organizationId: string, query: ListDeliveriesQuery) =>
  repo.listDeliveries(organizationId, query.page, query.pageSize, {
    bookId: query.bookId,
    cuttingEntryId: query.cuttingEntryId,
    partyId: query.partyId,
    search: query.search,
  });

export const listLots = (organizationId: string, bookId: string) => repo.listLotsWithProduction(organizationId, bookId);

export const getDelivery = async (organizationId: string, id: string) => {
  const delivery = await repo.findDeliveryById(organizationId, id);
  if (!delivery) throw notFound('Delivery not found');
  return delivery;
};

// Everything the printed challan needs: the delivery and the company header.
export const getChallan = async (organizationId: string, id: string) => {
  const [delivery, company] = await Promise.all([getDelivery(organizationId, id), repo.findOrganizationHeader(organizationId)]);
  return { delivery, company };
};

// The grid for the form: every colour × size of the lot with what was produced, delivered earlier
// and what can still go.
export const getAvailability = async (organizationId: string, cuttingEntryId: string, excludeId?: string) => {
  const entry = await getCuttingEntry(organizationId, cuttingEntryId);
  const { cut, colors, sizes } = describeLot(entry);
  const [produced, delivered] = await Promise.all([
    repo.sumProducedByCell(prisma, cuttingEntryId),
    repo.sumDeliveredByCell(prisma, cuttingEntryId, excludeId),
  ]);

  return {
    cuttingEntry: {
      id: entry.id,
      lotNumber: entry.lotNumber,
      date: entry.date,
      isOnline: entry.isOnline,
      totalQuantity: entry.totalQuantity,
      // The design photo, or the first cloth photo when the design has none.
      photoUrl: entry.item.photoUrl ?? entry.rows.find((r) => r.photoUrl)?.photoUrl ?? null,
      item: { id: entry.item.id, itemName: entry.item.itemName },
      party: { id: entry.party.id, name: entry.party.name },
    },
    sizes: sizes.map(({ id, name, detail }) => ({ id, name, detail })),
    colors: colors.map((color) => ({
      ...color,
      cells: sizes.map((size) => {
        const key = cellKey(color.colorId, size.id);
        const made = produced.get(key) ?? 0;
        const sent = delivered.get(key) ?? 0;
        return { sizeId: size.id, cut: cut.get(key) ?? 0, produced: made, delivered: sent, remaining: Math.max(made - sent, 0) };
      }),
    })),
  };
};

// Drops empty cells and checks every remaining one against the produced pieces not yet delivered.
const checkCells = async (
  db: Parameters<typeof repo.sumDeliveredByCell>[0],
  entry: CuttingEntryWithRows,
  input: DeliveryCell[],
  excludeId?: string,
): Promise<DeliveryCell[]> => {
  const cells = input.filter((c) => c.quantity > 0);
  const { colors, sizes } = describeLot(entry);
  const [produced, delivered] = await Promise.all([
    repo.sumProducedByCell(db, entry.id),
    repo.sumDeliveredByCell(db, entry.id, excludeId),
  ]);
  const colorName = (id: string) => colors.find((c) => c.colorId === id)?.name ?? 'this colour';
  const sizeName = (id: string) => sizes.find((s) => s.id === id)?.name ?? 'this size';

  for (const cell of cells) {
    const key = cellKey(cell.colorId, cell.sizeId);
    const remaining = (produced.get(key) ?? 0) - (delivered.get(key) ?? 0);
    if (cell.quantity > remaining) {
      throw badRequest(
        `Only ${Math.max(remaining, 0)} produced ${colorName(cell.colorId)} / ${sizeName(cell.sizeId)} pieces of lot ${entry.lotNumber} are left to deliver`,
      );
    }
  }
  return cells;
};

export const createDelivery = async (organizationId: string, input: CreateDeliveryInput, actorId: string | null) => {
  const { cuttingEntryId, quantities, ...header } = input;
  await assertLotOpen(cuttingEntryId);

  return prisma.$transaction(async (tx) => {
    await repo.lockCuttingEntry(tx, cuttingEntryId);
    const entry = await getCuttingEntry(organizationId, cuttingEntryId);
    const cells = await checkCells(tx, entry, quantities);
    const challanNumber = await repo.nextChallanNumber(tx, organizationId);
    return repo.createDelivery(
      tx,
      { ...header, organizationId, cuttingEntryId, partyId: entry.partyId, challanNumber },
      cells,
      actorId,
    );
  });
};

export const updateDelivery = async (organizationId: string, id: string, input: UpdateDeliveryInput, actorId: string | null) => {
  const existing = await getDelivery(organizationId, id);
  await assertLotOpen(existing.cuttingEntryId);
  const { quantities, ...header } = input;

  return prisma.$transaction(async (tx) => {
    await repo.lockCuttingEntry(tx, existing.cuttingEntryId);
    let cells: DeliveryCell[] | undefined;
    if (quantities) {
      const entry = await getCuttingEntry(organizationId, existing.cuttingEntryId);
      cells = await checkCells(tx, entry, quantities, id);
    }
    return repo.updateDelivery(tx, id, header, cells, actorId);
  });
};

export const deleteDelivery = async (organizationId: string, id: string) => {
  const existing = await getDelivery(organizationId, id);
  await assertLotOpen(existing.cuttingEntryId);
  await prisma.delivery.delete({ where: { id } });
};
