import type { Karigar, WorkType } from '../karigars/karigar-constants';
import type { Item } from '../items/item-constants';

export interface ProductionEntry {
  id: string;
  date: string;
  entryTime: string | null;
  cuttingEntryId: string | null;
  lotNumber: string | null;
  designNumber: string | null;
  workTypeId: string;
  itemId: string;

  carrierId: string;
  carrierQuantity: number;
  carrierRate: string | null;
  carrierTotal: string;

  overlockCarrierId: string | null;
  overlockRate: string | null;
  overlockTotal: string | null;

  flatlockKarigarId: string | null;
  flatlockRate: string | null;
  flatlockTotal: string | null;

  photoUrl: string | null;
  remarks: string | null;

  carrier: Karigar;
  overlockCarrier: Karigar | null;
  flatlockKarigar: Karigar | null;
  workType: WorkType;
  item: Item;
  cuttingEntry: { id: string; lotNumber: string; bookId: string; isOnline: boolean } | null;
}

// A lot the stitching karigar took (Cutting Distribution), as the entry form shows it.
export interface ProductionKarigarLot {
  id: string;
  lotNumber: string;
  date: string;
  isOnline: boolean;
  item: { id: string; itemName: string; photoUrl: string | null };
  party: { id: string; name: string };
  lotPhotoUrl: string | null;
  piecesTaken: number;
  piecesProduced: number;
  piecesPending: number;
}

// The three production stages, each done by its own karigar on the same pieces.
export const STAGE_LABELS = { stitching: 'Stitching', flatlock: 'Flatlock', overlock: 'Overlock' } as const;

// True when a stage has a karigar but its rate is still to be filled in.
export const ratePending = (entry: ProductionEntry) =>
  !entry.carrierRate ||
  (Boolean(entry.overlockCarrierId) && !entry.overlockRate) ||
  (Boolean(entry.flatlockKarigarId) && !entry.flatlockRate);
