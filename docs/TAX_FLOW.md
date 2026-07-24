# Tax Calculation & Processing Flow

## Decision Tree

```
Product Price Requested
         │
         ▼
Check Product-Specific Tax (ProductTax)
         │
  ┌──────┴──────┐
Found         Not Found
  │             │
  ▼             ▼
Apply Rule   Check Product / Category Tax Rule (taxRuleId)
                │
         ┌──────┴──────┐
       Found         Not Found
         │             │
         ▼             ▼
      Apply Rule    Check Country Default Tax (CountryTax)
                       │
                       ▼
                    Apply Country Default / Fallback Rate
```

---

## Indian GST Component Logic

1. **Intra-State Sale** (`Buyer State == Seller State`):
   - CGST = `Rate / 2`
   - SGST = `Rate / 2`
   - IGST = `0`

2. **Inter-State Sale** (`Buyer State != Seller State`):
   - CGST = `0`
   - SGST = `0`
   - IGST = `Rate`

---

## Inclusive vs Exclusive Calculation

- **Exclusive Tax**:
  - `Taxable Amount = Line Subtotal`
  - `Tax Amount = Line Subtotal * (Rate / 100)`
  - `Final Price = Line Subtotal + Tax Amount`

- **Inclusive Tax**:
  - `Taxable Amount = Line Subtotal / (1 + Rate / 100)`
  - `Tax Amount = Line Subtotal - Taxable Amount`
  - `Final Price = Line Subtotal`
