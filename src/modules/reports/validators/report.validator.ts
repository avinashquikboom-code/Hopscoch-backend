import { z } from 'zod';

export const salesReportQuerySchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  page: z.string().optional().default('1'),
  limit: z.string().optional().default('20'),
});

export const inventoryReportQuerySchema = z.object({
  lowStock: z.string().optional().transform(val => val === 'true'),
  warehouseId: z.coerce.number().int().optional(),
  page: z.string().optional().default('1'),
  limit: z.string().optional().default('20'),
});

export const customerReportQuerySchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  page: z.string().optional().default('1'),
  limit: z.string().optional().default('20'),
});

export const orderReportQuerySchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  status: z.enum(['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED', 'RETURNED', 'REPLACED', 'REFUNDED']).optional(),
  page: z.string().optional().default('1'),
  limit: z.string().optional().default('20'),
});

export type SalesReportQueryDto = z.infer<typeof salesReportQuerySchema>;
export type InventoryReportQueryDto = z.infer<typeof inventoryReportQuerySchema>;
export type CustomerReportQueryDto = z.infer<typeof customerReportQuerySchema>;
export type OrderReportQueryDto = z.infer<typeof orderReportQuerySchema>;
