import type { Karigar, WorkType } from '../karigars/karigar-constants';
import type { Item } from '../items/item-constants';

export interface ProductionEntry {
  id: string;
  date: string;
  cuttingEntryId: string | null;
  lotNumber: string | null;
  designNumber: string | null;
  workTypeId: string;
  itemId: string;

  carrierId: string;
  carrierQuantity: number;
  carrierRate: string;
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
}
