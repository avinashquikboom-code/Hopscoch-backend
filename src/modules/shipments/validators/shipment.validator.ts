import { z } from 'zod';

export const createShipmentSchema = z.object({
  orderId: z.coerce.number().int('Invalid order ID'),
  courierPartner: z.string().min(1, 'Courier partner is required'),
  trackingNumber: z.string().min(1, 'Tracking number is required'),
  estimatedDeliveryDate: z.string().datetime(),
});

export const updateTrackingSchema = z.object({
  status: z.enum(['PICKED_UP', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED', 'FAILED', 'RETURNED']),
  location: z.string().optional(),
  note: z.string().max(500).optional(),
});

export const shipmentQuerySchema = z.object({
  page: z.string().optional().default('1'),
  limit: z.string().optional().default('20'),
  status: z.enum(['PENDING', 'PICKED_UP', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED', 'FAILED', 'RETURNED']).optional(),
  courier: z.string().optional(),
});

export type CreateShipmentDto = z.infer<typeof createShipmentSchema>;
export type UpdateTrackingDto = z.infer<typeof updateTrackingSchema>;
export type ShipmentQueryDto = z.infer<typeof shipmentQuerySchema>;
