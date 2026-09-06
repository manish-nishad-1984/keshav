export interface ItemCategory {
  id: string;
  name: string;
  prefix: string;
  isActive: boolean;
}

export interface Item {
  id: string;
  categoryId: string;
  styleNo: string;
  itemName: string;
  photoUrl: string | null;
  isActive: boolean;
  category: ItemCategory;
}
