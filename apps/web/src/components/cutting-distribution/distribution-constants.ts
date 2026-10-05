import type { Color, Size } from '../cutting/cutting-constants';

export const DISTRIBUTIONS_QUERY_KEY = ['cutting-distributions'] as const;

export interface DistributionQuantity {
  id: string;
  colorId: string;
  sizeId: string;
  quantity: number;
  color: Color;
  size: Size;
}

export interface Distribution {
  id: string;
  cuttingEntryId: string;
  karigarId: string;
  date: string;
  entryTime: string | null;
  remarks: string | null;
  totalQuantity: number;
  cuttingEntry: {
    id: string;
    lotNumber: string;
    date: string;
    totalQuantity: number;
    bookId: string;
    item: { id: string; itemName: string };
    party: { id: string; name: string };
  };
  karigar: { id: string; code: string; fullName: string; workType: { id: string; name: string } };
  quantities: DistributionQuantity[];
}

// A lot of the selected book, for the lot dropdown.
export interface DistributionLot {
  id: string;
  lotNumber: string;
  date: string;
  totalQuantity: number;
  distributedQuantity: number;
  item: { itemName: string };
  party: { name: string };
}

export interface AvailabilityCell {
  sizeId: string;
  cut: number;
  distributed: number;
  remaining: number;
}

// The lot's colour × size grid with what was cut, given earlier and still left.
export interface Availability {
  cuttingEntry: {
    id: string;
    lotNumber: string;
    date: string;
    totalQuantity: number;
    item: { id: string; itemName: string };
    party: { id: string; name: string };
  };
  sizes: { id: string; name: string; detail: string | null }[];
  colors: { colorId: string; name: string; photoUrl: string | null; cells: AvailabilityCell[] }[];
}

export const cellKey = (colorId: string, sizeId: string) => `${colorId}:${sizeId}`;
