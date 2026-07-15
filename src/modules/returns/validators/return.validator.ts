import { z } from 'zod';

export const createReturnRequestSchema = z.object({
  orderId: z.coerce.number().int('Invalid order ID'),
  reason: z.string().min(10, 'Reason must be at least 10 characters').max(500, 'Reason must not exceed 500 characters'),
  isReplacement: z.boolean().default(false),
  images: z.array(z.string().url()).optional(),
  notes: z.string().max(1000).optional(),
});

export const updateReturnStatusSchema = z.object({
  status: z.enum(['REQUESTED', 'APPROVED', 'REJECTED', 'PICKED_UP', 'RECEIVED', 'REFUND_INITIATED', 'REFUND_COMPLETED']),
  adminNotes: z.string().max(1000).optional(),
  sellable: z.boolean().optional(),
});

export const returnQuerySchema = z.object({
  page: z.string().optional().default('1'),
  limit: z.string().optional().default('20'),
  status: z.enum(['REQUESTED', 'APPROVED', 'REJECTED', 'PICKED_UP', 'RECEIVED', 'REFUND_INITIATED', 'REFUND_COMPLETED']).optional(),
});

export type CreateReturnRequestDto = z.infer<typeof createReturnRequestSchema>;
export type UpdateReturnStatusDto = z.infer<typeof updateReturnStatusSchema>;
export type ReturnQueryDto = z.infer<typeof returnQuerySchema>;
