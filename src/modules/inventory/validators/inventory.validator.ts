import { z } from 'zod';

export const createStockMovementSchema = z.object({
  variantId: z.string().uuid('Invalid variant ID'),
  warehouseId: z.string().uuid('Invalid warehouse ID'),
  type: z.enum(['RESTOCK', 'SALE', 'RETURN', 'ADJUSTMENT', 'DAMAGE']),
  quantityChange: z.number().int('Quantity change must be an integer'),
  reason: z.string().optional(),
  referenceOrderId: z.string().uuid().optional(),
});

export const updateInventoryThresholdSchema = z.object({
  inventoryItemId: z.string().uuid('Invalid inventory item ID'),
  lowStockThreshold: z.number().int().min(0, 'Threshold must be non-negative'),
});

export const inventoryQuerySchema = z.object({
  page: z.string().optional().default('1'),
  limit: z.string().optional().default('20'),
  warehouseId: z.string().uuid().optional(),
  lowStock: z.string().optional().transform(val => val === 'true'),
});

export type CreateStockMovementDto = z.infer<typeof createStockMovementSchema>;
export type UpdateInventoryThresholdDto = z.infer<typeof updateInventoryThresholdSchema>;
export type InventoryQueryDto = z.infer<typeof inventoryQuerySchema>;
