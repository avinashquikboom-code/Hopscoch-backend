# Production Tax Management Module

## Overview
The **Tax Management Module** for FCISELLER provides enterprise-grade, multi-country tax rule configuration and product tax calculation. It supports diverse global tax structures including **GST**, **VAT**, **Sales Tax**, **HST**, **PST**, **QST**, **Luxury Tax**, **Import Duty**, **Service Tax**, and **No Tax**.

---

## Architecture & File Structure

```
Hopscoch-backend/src/modules/tax/
├── constants/
│   └── tax.constants.ts      # Enums, error messages, and country mappings
├── types/
│   └── tax.types.ts          # Calculation parameters and query types
├── interfaces/
│   └── tax.interface.ts      # Entity interfaces for TaxRule and TaxHistory
├── dto/
│   └── tax.dto.ts            # DTOs for create, update, and assignment
├── validators/
│   └── tax.validator.ts      # Validation logic for rates, codes, and dates
├── utils/
│   └── tax-calculator.utils.ts # Single item calculation & CGST/SGST/IGST math
├── events/
│   └── tax.events.ts         # Event Emitter for audit logging & alerts
├── middleware/
│   └── tax.middleware.ts     # Request payload validation middleware
├── repositories/
│   └── tax.repository.ts     # Data access layer interfacing Prisma DB
├── services/
│   └── tax.service.ts        # Core business logic and validation orchestration
├── controllers/
│   └── tax.controller.ts     # HTTP request handlers
└── routes/
    └── tax.routes.ts         # API routes definition
```

---

## Key Features
- **Multi-Country Support**: Automatic classification and default rules for India (`GST`), United States (`Sales Tax`), United Kingdom (`VAT`), Canada (`HST`), Australia (`GST`), UAE (`VAT`), Germany (`VAT`), and France (`VAT`).
- **GST Component Breakdown**: Automatic split into CGST %, SGST %, and IGST % for intra-state vs inter-state Indian commerce.
- **Product Tax Assignments**: Assign individual tax rules or custom override rates per product per country.
- **Audit History**: Complete `tax_history` logging tracking every creation, edit, bulk status change, and deletion.
- **Backward Compatibility**: Dual-sync with legacy `Tax` model ensuring existing product foreign keys remain unbroken.
