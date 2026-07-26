export interface TaxBreakdownItem {
  taxRuleId: number | null;
  name: string;
  rate: number;
  taxType: 'INCLUSIVE' | 'EXCLUSIVE';
  taxableAmount: number;
  taxAmount: number;
}

export interface ItemWithTaxCalculation {
  cartItemId?: number;
  productId: number;
  variantId?: number;
  productName: string;
  quantity: number;
  unitPrice: number;
  lineSubtotal: number;
  effectiveTaxRule: any;
  rate: number;
  taxType: 'INCLUSIVE' | 'EXCLUSIVE';
  hsnCode: string | null;
  taxAmount: number;
}

export interface TaxCalculationResult {
  subtotal: number;
  totalExclusiveTax: number;
  totalInclusiveTax: number;
  totalTax: number;
  taxBreakdown: TaxBreakdownItem[];
  itemsWithTax: ItemWithTaxCalculation[];
}

export function calculateCartTaxes(items: any[]): TaxCalculationResult {
  let subtotal = 0;
  let totalExclusiveTax = 0;
  let totalInclusiveTax = 0;
  const breakdownMap: Map<string, TaxBreakdownItem> = new Map();

  const itemsWithTax: ItemWithTaxCalculation[] = items.map((item) => {
    const product = item.product || item;
    const variant = item.variant;
    const quantity = item.quantity || 1;
    const unitPrice = variant && variant.price !== undefined ? Number(variant.price) : Number(product.basePrice || 0);
    const lineSubtotal = unitPrice * quantity;
    subtotal += lineSubtotal;

    const rule = product.taxRule || product.category?.taxRule || null;
    let rate = rule
      ? Number(rule.rate ?? 0)
      : (product.taxPercent != null ? Number(product.taxPercent) : (product.tax_percent != null ? Number(product.tax_percent) : 0));
    if (isNaN(rate) || rate < 0) rate = 0;
    const rawType = (rule?.taxType || rule?.type || product.taxType || 'EXCLUSIVE').toString().toUpperCase();
    const taxType: 'INCLUSIVE' | 'EXCLUSIVE' = rawType === 'INCLUSIVE' ? 'INCLUSIVE' : 'EXCLUSIVE';
    const hsnCode = product.hsnCode || rule?.hsnCode || null;

    let lineTaxAmount = 0;
    if (rate > 0) {
      // Always calculate tax as rate/100 of listed price to be added to total
      lineTaxAmount = Math.round((lineSubtotal * (rate / 100)) * 100) / 100;
      if (taxType === 'INCLUSIVE') {
        totalInclusiveTax += lineTaxAmount;
      } else {
        totalExclusiveTax += lineTaxAmount;
      }

      const key = `${rule?.id || 0}_${rate}_${taxType}`;
      const existing = breakdownMap.get(key);
      if (existing) {
        existing.taxableAmount = Math.round((existing.taxableAmount + lineSubtotal) * 100) / 100;
        existing.taxAmount = Math.round((existing.taxAmount + lineTaxAmount) * 100) / 100;
      } else {
        breakdownMap.set(key, {
          taxRuleId: rule?.id || null,
          name: rule?.name || `GST ${rate}%`,
          rate,
          taxType,
          taxableAmount: lineSubtotal,
          taxAmount: lineTaxAmount,
        });
      }
    }

    return {
      cartItemId: item.id,
      productId: product.id,
      variantId: variant?.id,
      productName: product.name || '',
      quantity,
      unitPrice,
      lineSubtotal,
      effectiveTaxRule: rule,
      rate,
      taxType,
      hsnCode,
      taxAmount: lineTaxAmount,
    };
  });

  const totalTax = Math.round((totalExclusiveTax + totalInclusiveTax) * 100) / 100;
  const taxBreakdown = Array.from(breakdownMap.values());

  return {
    subtotal: Math.round(subtotal * 100) / 100,
    totalExclusiveTax: Math.round(totalExclusiveTax * 100) / 100,
    totalInclusiveTax: Math.round(totalInclusiveTax * 100) / 100,
    totalTax,
    taxBreakdown,
    itemsWithTax,
  };
}

export interface TaxRule {
  rate: number;
  taxType?: 'INCLUSIVE' | 'EXCLUSIVE';
  type?: string;
}

export interface SingleTaxResult {
  displayPrice: number;
  basePrice: number;
  taxAmount: number;
  finalPrice: number;
}

export function calculateTax(price: number, rule: TaxRule | null): SingleTaxResult {
  if (!rule || !rule.rate || rule.rate === 0) {
    return { displayPrice: price, basePrice: price, taxAmount: 0, finalPrice: price };
  }

  const rawType = (rule.taxType || rule.type || 'EXCLUSIVE').toString().toUpperCase();
  const taxType = rawType === 'INCLUSIVE' ? 'INCLUSIVE' : 'EXCLUSIVE';

  if (taxType === 'INCLUSIVE') {
    const basePrice = price / (1 + rule.rate / 100);
    const taxAmount = price - basePrice;
    return {
      displayPrice: price,
      basePrice: Math.round(basePrice * 100) / 100,
      taxAmount: Math.round(taxAmount * 100) / 100,
      finalPrice: price,
    };
  }

  const taxAmount = price * (rule.rate / 100);
  return {
    displayPrice: price,
    basePrice: price,
    taxAmount: Math.round(taxAmount * 100) / 100,
    finalPrice: Math.round((price + taxAmount) * 100) / 100,
  };
}
