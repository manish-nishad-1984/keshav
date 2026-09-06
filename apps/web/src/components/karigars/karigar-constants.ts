export interface WorkType {
  id: string;
  name: string;
  isActive: boolean;
}

export interface Karigar {
  id: string;
  code: string;
  fullName: string;
  mobile: string;
  photoUrl: string | null;
  workTypeId: string;
  workType: WorkType;
  joinDate: string | null;
  address: string | null;
  remarks: string | null;
  isActive: boolean;
}
