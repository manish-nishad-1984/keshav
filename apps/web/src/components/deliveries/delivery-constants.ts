import type { Color, Size } from '../cutting/cutting-constants';

export const DELIVERIES_QUERY_KEY = ['deliveries'] as const;

export interface DeliveryQuantity {
  id: string;
  colorId: string;
  sizeId: string;
  quantity: number;
  color: Color;
  size: Size;
}

export interface Delivery {
  id: string;
  challanNumber: number;
  cuttingEntryId: string;
  partyId: string;
  date: string;
  entryTime: string | null;
  remarks: string | null;
  totalQuantity: number;
  cuttingEntry: {
    id: string;
    lotNumber: string;
    date: string;
    bookId: string;
    isOnline: boolean;
    totalQuantity: number;
    item: { id: string; itemName: string; photoUrl: string | null };
  };
  party: { id: string; name: string; mobile: string | null; address: string | null };
  quantities: DeliveryQuantity[];
}

// A lot of the selected book that has production, for the lot dropdown.
export interface DeliveryLot {
  id: string;
  lotNumber: string;
  date: string;
  totalQuantity: number;
  producedQuantity: number;
  deliveredQuantity: number;
  item: { itemName: string };
  party: { name: string };
}

export interface DeliveryAvailabilityCell {
  sizeId: string;
  cut: number;
  produced: number;
  delivered: number;
  remaining: number;
}

// The lot's colour × size grid with what was produced, delivered earlier and is still left to send.
export interface DeliveryAvailability {
  cuttingEntry: {
    id: string;
    lotNumber: string;
    date: string;
    isOnline: boolean;
    totalQuantity: number;
    photoUrl: string | null;
    item: { id: string; itemName: string };
    party: { id: string; name: string };
  };
  sizes: { id: string; name: string; detail: string | null }[];
  colors: { colorId: string; name: string; photoUrl: string | null; cells: DeliveryAvailabilityCell[] }[];
}

export interface Challan {
  delivery: Delivery;
  company: { name: string; phone: string | null; addressLine1: string | null; gstNumber: string | null; logoUrl: string | null } | null;
}

export const cellKey = (colorId: string, sizeId: string) => `${colorId}:${sizeId}`;
