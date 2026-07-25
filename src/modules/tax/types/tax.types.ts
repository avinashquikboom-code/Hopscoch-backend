export type TaxTypeEnum = string;

export const TAX_ERROR_MESSAGES = {
  DUPLICATE_CODE: 'Tax code already exists. Please use a unique tax code.',
  DUPLICATE_NAME: 'Tax rule name already exists. Please choose a different name.',
  INVALID_RATE: 'Tax rate percentage must be between 0 and 100.',
  INVALID_COUNTRY: 'Invalid 2-letter ISO country code.',
  TAX_NOT_FOUND: 'Tax rule not found.',
  INVALID_DATES: 'Expiry date must be after the effective date.',
};

export interface TaxCalculationParams {
  price: number;
  quantity?: number;
  rate: number;
  cgstRate?: number;
  sgstRate?: number;
  igstRate?: number;
  isInclusive?: boolean;
  taxType?: string;
  country?: string;
  state?: string;
  buyerState?: string;
  sellerState?: string;
}

export interface SingleTaxCalculationResult {
  unitPrice: number;
  lineSubtotal: number;
  taxableAmount: number;
  rate: number;
  taxAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  finalPrice: number;
  isInclusive: boolean;
  taxType: string;
}

export interface TaxFilterQuery {
  page?: number;
  limit?: number;
  search?: string;
  taxType?: string;
  country?: string;
  isActive?: boolean;
  sortBy?: 'name' | 'taxCode' | 'rate' | 'priority' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
}

export interface BulkTaxActionParams {
  action: 'ENABLE' | 'DISABLE' | 'DELETE';
  taxRuleIds: number[];
}
