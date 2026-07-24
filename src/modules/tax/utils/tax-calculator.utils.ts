import { TaxCalculationParams, SingleTaxCalculationResult } from '../types/tax.types';

export function calculateSingleTax(params: TaxCalculationParams): SingleTaxCalculationResult {
  const quantity = params.quantity || 1;
  const unitPrice = Number(params.price || 0);
  const lineSubtotal = unitPrice * quantity;
  const rate = Number(params.rate || 0);
  const isInclusive = Boolean(params.isInclusive);
  const taxType = params.taxType || 'GST';

  let taxAmount = 0;
  let taxableAmount = lineSubtotal;

  if (rate > 0) {
    if (isInclusive) {
      taxableAmount = Math.round((lineSubtotal / (1 + rate / 100)) * 100) / 100;
      taxAmount = Math.round((lineSubtotal - taxableAmount) * 100) / 100;
    } else {
      taxAmount = Math.round((lineSubtotal * (rate / 100)) * 100) / 100;
    }
  }

  // GST Component Breakdown (India GST logic)
  let cgstAmount = 0;
  let sgstAmount = 0;
  let igstAmount = 0;

  if (taxType.toUpperCase().includes('GST')) {
    const cgstRate = params.cgstRate !== undefined ? params.cgstRate : (params.buyerState && params.sellerState && params.buyerState !== params.sellerState ? 0 : rate / 2);
    const sgstRate = params.sgstRate !== undefined ? params.sgstRate : (params.buyerState && params.sellerState && params.buyerState !== params.sellerState ? 0 : rate / 2);
    const igstRate = params.igstRate !== undefined ? params.igstRate : (params.buyerState && params.sellerState && params.buyerState !== params.sellerState ? rate : 0);

    if (igstRate > 0) {
      igstAmount = taxAmount;
    } else {
      cgstAmount = Math.round((taxAmount / 2) * 100) / 100;
      sgstAmount = Math.round((taxAmount - cgstAmount) * 100) / 100;
    }
  }

  const finalPrice = isInclusive ? lineSubtotal : Math.round((lineSubtotal + taxAmount) * 100) / 100;

  return {
    unitPrice,
    lineSubtotal: Math.round(lineSubtotal * 100) / 100,
    taxableAmount,
    rate,
    taxAmount,
    cgstAmount,
    sgstAmount,
    igstAmount,
    finalPrice,
    isInclusive,
    taxType,
  };
}
