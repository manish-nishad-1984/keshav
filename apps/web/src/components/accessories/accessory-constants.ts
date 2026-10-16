export const ACCESSORIES_QUERY_KEY = ['accessories'] as const;
export const ACCESSORY_DESIGNS_QUERY_KEY = ['accessory-designs'] as const;
export const ACCESSORY_ISSUES_QUERY_KEY = ['accessory-issues'] as const;

export interface Accessory {
  id: string;
  name: string;
  unit: string;
  isActive: boolean;
}

export interface DesignAccessory {
  id: string;
  accessoryId: string;
  quantityPerPiece: string;
  accessory: Accessory;
}

export interface DesignWithAccessories {
  id: string;
  itemName: string;
  isActive: boolean;
  accessories: DesignAccessory[];
}

export type AccessoryTransactionType = 'ISSUE' | 'RETURN';

export const TRANSACTION_TYPE_LABELS: Record<AccessoryTransactionType, string> = {
  ISSUE: 'Issue',
  RETURN: 'Return',
};

export interface AccessoryTransaction {
  id: string;
  type: AccessoryTransactionType;
  karigarId: string;
  cuttingEntryId: string;
  date: string;
  entryTime: string | null;
  remarks: string | null;
  karigar: { id: string; code: string; fullName: string };
  cuttingEntry: { id: string; lotNumber: string; bookId: string; item: { id: string; itemName: string } };
  lines: { id: string; accessoryId: string; quantity: string; accessory: Accessory }[];
}

export interface KarigarLot {
  id: string;
  lotNumber: string;
  date: string;
  piecesTaken: number;
  item: { id: string; itemName: string };
}

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
  returnDue: number;
  canIssue: number;
}

export interface KarigarLotPosition {
  karigar: { id: string; code: string; fullName: string };
  lot: { id: string; lotNumber: string; bookId: string; item: { id: string; itemName: string } };
  piecesTaken: number;
  piecesMade: number;
  piecesAlteration: number;
  lines: AccessoryLinePosition[];
}

export interface PositionWithPending extends KarigarLotPosition {
  pendingElsewhere: { accessoryId: string; name: string; unit: string; holding: number; lots: string[] }[];
}

// Up to three decimals, Indian grouping, no trailing zeros.
export const formatAmount = (value: number | string) =>
  Number(value).toLocaleString('en-IN', { maximumFractionDigits: 3 });
