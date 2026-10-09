import { conflict, notFound } from '../../lib/httpError';
import { prisma } from '../../lib/prisma';

// A closed lot takes no more distribution, production, delivery, accessory or lot edits until an
// admin reopens it. Call at the start of every change that belongs to a lot.
export const assertLotOpen = async (cuttingEntryId: string | null | undefined) => {
  if (!cuttingEntryId) return;
  const lot = await prisma.cuttingEntry.findUnique({ where: { id: cuttingEntryId }, select: { lotNumber: true, closedAt: true } });
  if (!lot) throw notFound('Lot not found');
  if (lot.closedAt) throw conflict(`Lot ${lot.lotNumber} is closed — an admin must reopen it before it can be changed`, 'LOT_CLOSED');
};
