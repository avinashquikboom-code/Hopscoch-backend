# Tax Module API Reference

Base URL: `/api/taxes` or `/api/admin/taxes`

---

## Endpoints

### 1. List / Search / Filter Taxes
- **URL**: `GET /api/taxes`
- **Query Params**:
  - `page` (number, default: `1`)
  - `limit` (number, default: `20`)
  - `search` (string, search by code/name)
  - `taxType` (string, e.g. `GST`, `VAT`, `SALES_TAX`)
  - `country` (string, 2-letter ISO code e.g. `IN`, `US`)
  - `isActive` (boolean `true`/`false`)
  - `sortBy` (`name`, `taxCode`, `rate`, `priority`, `createdAt`)
  - `sortOrder` (`asc`, `desc`)

#### Sample Response:
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "GST 18% Standard",
      "taxCode": "GST_18_IN",
      "country": "IN",
      "rate": 18,
      "cgst": 9,
      "sgst": 9,
      "igst": 18,
      "isActive": true,
      "taxType": {
        "code": "GST",
        "name": "GST"
      }
    }
  ],
  "pagination": {
    "total": 1,
    "page": 1,
    "limit": 20,
    "totalPages": 1
  }
}
```

---

### 2. Create Tax Rule
- **URL**: `POST /api/taxes`
- **Headers**: `Authorization: Bearer <TOKEN>`
- **Body**:
```json
{
  "name": "GST 18% Standard",
  "taxCode": "GST_18_IN",
  "taxType": "GST",
  "country": "IN",
  "rate": 18,
  "cgst": 9,
  "sgst": 9,
  "igst": 18,
  "description": "Standard 18% GST apparel rate",
  "priority": 1,
  "displayOrder": 1,
  "isDefault": true,
  "isActive": true,
  "effectiveDate": "2026-01-01"
}
```

---

### 3. Update Tax Rule
- **URL**: `PUT /api/taxes/:id`
- **Headers**: `Authorization: Bearer <TOKEN>`
- **Body**: Partial `CreateTaxRuleDto` fields.

---

### 4. Delete Tax Rule
- **URL**: `DELETE /api/taxes/:id`
- **Headers**: `Authorization: Bearer <TOKEN>`

---

### 5. Bulk Actions (Enable / Disable / Delete)
- **URL**: `POST /api/taxes/bulk`
- **Headers**: `Authorization: Bearer <TOKEN>`
- **Body**:
```json
{
  "action": "ENABLE",
  "taxRuleIds": [1, 2, 3]
}
```

---

### 6. Assign Tax to Product
- **URL**: `POST /api/taxes/assign-product`
- **Headers**: `Authorization: Bearer <TOKEN>`
- **Body**:
```json
{
  "productId": 42,
  "taxRuleId": 1,
  "country": "IN"
}
```

---

### 7. Remove Tax from Product
- **URL**: `POST /api/taxes/remove-product`
- **Headers**: `Authorization: Bearer <TOKEN>`
- **Body**:
```json
{
  "productId": 42,
  "country": "IN"
}
```
