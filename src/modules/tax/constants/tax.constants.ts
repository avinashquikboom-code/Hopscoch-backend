export const TAX_TYPES = [
  'GST',
  'VAT',
  'SALES_TAX',
  'HST',
  'PST',
  'QST',
  'LUXURY_TAX',
  'IMPORT_DUTY',
  'SERVICE_TAX',
  'NO_TAX',
] as const;

export type TaxTypeEnum = typeof TAX_TYPES[number];

export const TAX_CALCULATION_TYPES = ['PERCENTAGE', 'FIXED'] as const;
export type TaxCalculationTypeEnum = typeof TAX_CALCULATION_TYPES[number];

export const TAX_STATUSES = ['ACTIVE', 'INACTIVE'] as const;

export const DEFAULT_COUNTRY_TAX_MAP: Record<string, { type: TaxTypeEnum; defaultRate: number; taxLabel: string }> = {
  IN: { type: 'GST', defaultRate: 18, taxLabel: 'GSTIN' },
  US: { type: 'SALES_TAX', defaultRate: 8, taxLabel: 'EIN / Tax ID' },
  GB: { type: 'VAT', defaultRate: 20, taxLabel: 'VAT Reg No' },
  CA: { type: 'HST', defaultRate: 13, taxLabel: 'BN / GST No' },
  AU: { type: 'GST', defaultRate: 10, taxLabel: 'ABN' },
  AE: { type: 'VAT', defaultRate: 5, taxLabel: 'TRN' },
  DE: { type: 'VAT', defaultRate: 19, taxLabel: 'USt-IdNr' },
  FR: { type: 'VAT', defaultRate: 20, taxLabel: 'TVA' },
};

export const TAX_ERROR_MESSAGES = {
  DUPLICATE_CODE: 'Tax code already exists. Please use a unique tax code.',
  DUPLICATE_NAME: 'Tax rule name already exists. Please choose a different name.',
  INVALID_RATE: 'Tax rate percentage must be between 0 and 100.',
  INVALID_COUNTRY: 'Invalid 2-letter ISO country code.',
  TAX_NOT_FOUND: 'Tax rule not found.',
  INVALID_DATES: 'Expiry date must be after the effective date.',
};
