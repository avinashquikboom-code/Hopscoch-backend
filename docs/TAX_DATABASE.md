# Tax Database Models Documentation

Database Engine: PostgreSQL with Prisma ORM

---

## Prisma Models Summary

### 1. `TaxType` (`tax_types`)
Stores tax classifications (`GST`, `VAT`, `Sales Tax`, `HST`, `PST`, `QST`, `Luxury Tax`, `Import Duty`, `Service Tax`, `No Tax`).
- `id`: Int, Primary Key
- `code`: String, Unique (e.g. `GST`)
- `name`: String
- `description`: String?
- `isSystem`: Boolean
- `isActive`: Boolean

---

### 2. `TaxRate` (`tax_rates`)
Tax rate percentage definitions and component rates.
- `id`: Int, Primary Key
- `code`: String, Unique
- `name`: String
- `taxTypeId`: Int, Foreign Key -> `TaxType`
- `rate`: Decimal(10,2)
- `cgstRate`: Decimal(10,2)
- `sgstRate`: Decimal(10,2)
- `igstRate`: Decimal(10,2)
- `calculationType`: String (`PERCENTAGE` | `FIXED`)
- `isInclusive`: Boolean
- `country`: String (2-letter ISO)

---

### 3. `TaxRule` (`tax_rules`)
Core configurable tax rules matching locations, priorities, and default flags.
- `id`: Int, Primary Key
- `name`: String
- `taxCode`: String, Unique
- `taxTypeId`: Int, Foreign Key -> `TaxType`
- `taxRateId`: Int?, Foreign Key -> `TaxRate`
- `country`: String
- `state`: String?
- `zipCode`: String?
- `rate`: Decimal(10,2)
- `cgst`: Decimal(10,2)
- `sgst`: Decimal(10,2)
- `igst`: Decimal(10,2)
- `description`: String?
- `priority`: Int
- `displayOrder`: Int
- `isDefault`: Boolean
- `isActive`: Boolean
- `effectiveDate`: DateTime?
- `expiryDate`: DateTime?

---

### 4. `CountryTax` (`country_taxes`)
Country-level default tax rates and tax identification label configs.
- `id`: Int, Primary Key
- `countryCode`: String, Unique (e.g. `IN`, `US`, `GB`)
- `countryName`: String
- `defaultTaxType`: String
- `defaultRate`: Decimal(10,2)
- `taxNumberLabel`: String (e.g. `GSTIN`, `VAT ID`, `EIN`)
- `isTaxEnabled`: Boolean

---

### 5. `ProductTax` (`product_taxes`)
Junction model linking products to explicit tax rules or custom override rates.
- `id`: Int, Primary Key
- `productId`: Int, Foreign Key -> `Product`
- `taxRuleId`: Int?, Foreign Key -> `TaxRule`
- `taxRateId`: Int?, Foreign Key -> `TaxRate`
- `customRate`: Decimal(10,2)?
- `country`: String

---

### 6. `TaxHistory` (`tax_history`)
Audit log recording entity mutations.
- `id`: Int, Primary Key
- `entityType`: String (`TaxRule` | `TaxRate` | `ProductTax`)
- `entityId`: Int
- `action`: String (`CREATE` | `UPDATE` | `DELETE` | `ENABLE` | `DISABLE`)
- `changes`: JSON String
- `userId`: Int?
- `userEmail`: String?
- `createdAt`: DateTime
