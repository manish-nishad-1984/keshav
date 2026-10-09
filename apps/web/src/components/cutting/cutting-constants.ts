import type { Party } from '../parties/party-constants';

export interface PatternType {
  id: string;
  name: string;
  isActive: boolean;
}

export interface Color {
  id: string;
  name: string;
  isActive: boolean;
}

export type AverageUnit = 'KILOGRAM' | 'METER';

export const AVERAGE_UNIT_LABELS: Record<AverageUnit, string> = {
  KILOGRAM: 'Kilogram',
  METER: 'Meter',
};

// Size Master entry: one column of the cutting grid, e.g. name "S", detail "38/28".
export interface Size {
  id: string;
  name: string;
  detail: string | null;
  sortOrder: number;
  isActive: boolean;
}

export interface CuttingRowQuantity {
  id: string;
  sizeId: string;
  quantity: number;
  size: Size;
}

// One colour of a lot: cloth photo, colour and pieces per size.
export interface CuttingEntryRow {
  id: string;
  colorId: string;
  photoUrl: string | null;
  sortOrder: number;
  totalQuantity: number;
  color: Color;
  quantities: CuttingRowQuantity[];
}

/** Form state for a colour row; quantities are keyed by size id ('' = empty cell). */
export interface CuttingRowInput {
  key: string;
  colorId: string;
  photoUrl: string | null;
  quantities: Record<string, number | ''>;
}

export interface CuttingEntry {
  id: string;
  bookId: string;
  book: { id: string; name: string };
  lotNumber: string;
  date: string;
  /** "HH:mm" or null. */
  entryTime: string | null;
  patternTypeId: string;
  isOnline: boolean;
  itemId: string;
  partyId: string;
  party: Party;
  /** PCs that use Avg of fabric. Null only for lots created before PCs existed. */
  pieces: number | null;
  averageValue: string;
  averageUnit: AverageUnit;
  totalQuantity: number;
  /** Legacy amount of lots created before rates were removed; null for new lots. */
  totalAmount: string | null;
  patternType: PatternType;
  item: { id: string; itemName: string };
  rows: CuttingEntryRow[];
  closedAt: string | null;
  closeReason: 'DAMAGED' | 'SHORTAGE' | 'RETURNED_BY_PARTY' | null;
  closeNote: string | null;
  closedShortage: number | null;
}

export const AVERAGE_UNIT_SHORT: Record<AverageUnit, string> = {
  KILOGRAM: 'kg',
  METER: 'm',
};

// Total fabric for the lot: Avg is the fabric used for PCs pieces, so total = pieces / PCs * Avg.
export const fabricRequired = (totalQuantity: number, pieces: number | '' | null, averageValue: number | '' | string) => {
  const pcs = Number(pieces);
  const avg = Number(averageValue);
  if (!pcs || !avg || !totalQuantity) return null;
  return (totalQuantity / pcs) * avg;
};
