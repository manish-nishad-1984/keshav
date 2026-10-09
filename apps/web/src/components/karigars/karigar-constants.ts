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
  // Fixed (attendance-paid) karigars: per day = this ÷ 30.
  monthlySalary: string | null;
  // Only on a single karigar (GET /karigars/:id), not in lists.
  documents?: KarigarDocument[];
}

export type KarigarDocumentType = 'AADHAAR_FRONT' | 'AADHAAR_BACK' | 'PAN' | 'OTHER';

export interface KarigarDocument {
  id: string;
  type: KarigarDocumentType;
  label: string | null;
  fileUrl: string;
  sortOrder: number;
}
