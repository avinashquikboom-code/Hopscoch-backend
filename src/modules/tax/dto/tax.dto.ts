export interface CreateTaxRuleDto {
  name: string;
  taxCode: string;
  taxType: string; // GST, VAT, Sales Tax, etc.
  country?: string;
  state?: string;
  zipCode?: string;
  rate: number;
  cgst?: number;
  sgst?: number;
  igst?: number;
  description?: string;
  priority?: number;
  displayOrder?: number;
  isDefault?: boolean;
  isActive?: boolean;
  effectiveDate?: string | Date;
  expiryDate?: string | Date;
}

export interface UpdateTaxRuleDto extends Partial<CreateTaxRuleDto> {
  id?: number;
}

export interface AssignProductTaxDto {
  productId: number;
  taxRuleId?: number;
  customRate?: number;
  country?: string;
}

export interface RemoveProductTaxDto {
  productId: number;
  country?: string;
}
