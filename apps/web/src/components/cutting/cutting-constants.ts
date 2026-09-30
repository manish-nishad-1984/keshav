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

export interface CuttingEntryLine {
  id: string;
  size: string;
  quantity: number;
  rate: string;
  total: string;
}

export interface CuttingEntryLineInput {
  size: string;
  quantity: number | '';
  rate: number | '';
}

export interface CuttingEntry {
  id: string;
  lotNumber: string;
  date: string;
  patternTypeId: string;
  isOnline: boolean;
  itemId: string;
  partyName: string;
  averageValue: string;
  averageUnit: AverageUnit;
  colorId: string;
  totalAmount: string;
  patternType: PatternType;
  item: { id: string; styleNo: string; itemName: string };
  color: Color;
  lines: CuttingEntryLine[];
}
