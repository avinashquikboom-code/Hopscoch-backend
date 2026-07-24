export interface ITaxRule {
  id: number;
  name: string;
  taxCode: string;
  taxTypeId: number;
  taxRateId?: number | null;
  country: string;
  state?: string | null;
  zipCode?: string | null;
  rate: number;
  cgst?: number | null;
  sgst?: number | null;
  igst?: number | null;
  description?: string | null;
  priority: number;
  displayOrder: number;
  isDefault: boolean;
  isActive: boolean;
  effectiveDate?: Date | null;
  expiryDate?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ITaxHistory {
  id: number;
  entityType: string;
  entityId: number;
  action: string;
  changes: string;
  userId?: number | null;
  userEmail?: string | null;
  createdAt: Date;
}
