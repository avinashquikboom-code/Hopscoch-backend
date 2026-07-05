import { z } from 'zod';

export const createPaymentSchema = z.object({
  orderId: z.coerce.number().int('Invalid order ID'),
  method: z.enum(['RAZORPAY', 'STRIPE', 'UPI', 'CARD', 'WALLET', 'COD']),
  providerRef: z.string().optional(),
});

export const processRefundSchema = z.object({
  paymentId: z.coerce.number().int('Invalid payment ID'),
  refundAmount: z.number().positive('Refund amount must be positive'),
  refundReason: z.string().min(10).max(500),
});

export const paymentQuerySchema = z.object({
  page: z.string().optional().default('1'),
  limit: z.string().optional().default('20'),
  status: z.enum(['PENDING', 'AUTHORIZED', 'PAID', 'FAILED', 'REFUNDED', 'PARTIALLY_REFUNDED']).optional(),
  method: z.enum(['RAZORPAY', 'STRIPE', 'UPI', 'CARD', 'WALLET', 'COD']).optional(),
});

export type CreatePaymentDto = z.infer<typeof createPaymentSchema>;
export type ProcessRefundDto = z.infer<typeof processRefundSchema>;
export type PaymentQueryDto = z.infer<typeof paymentQuerySchema>;
