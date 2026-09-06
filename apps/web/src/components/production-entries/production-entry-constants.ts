import type { Karigar, WorkType } from '../karigars/karigar-constants';
import type { Item } from '../items/item-constants';

export interface ProductionEntry {
  id: string;
  date: string;
  karigarId: string;
  workTypeId: string;
  itemId: string;
  quantity: number;
  rate: string;
  totalAmount: string;
  photoUrl: string | null;
  remarks: string | null;
  karigar: Karigar;
  workType: WorkType;
  item: Item;
}
