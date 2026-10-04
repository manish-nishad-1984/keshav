// A lot-number series (e.g. "2025-26"). Cutting lots are numbered per book; the working book is
// picked in the header (see BookSelector / useSelectedBook).
export interface Book {
  id: string;
  name: string;
  startNumber: number;
  isActive: boolean;
  lotCount: number;
  nextLotNumber: string;
}
