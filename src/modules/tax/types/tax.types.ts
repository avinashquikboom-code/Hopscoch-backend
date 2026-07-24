import { TaxTypeEnum } from '../constants/tax.constants';

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
