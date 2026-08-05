import { z } from 'zod';

export const webhookLogQuerySchema = z.object({
  page: z.string().optional().default('1'),
  limit: z.string().optional().default('20'),
  eventType: z.string().optional(),
  status: z.string().optional(),
});

export type WebhookLogQueryInput = z.infer<typeof webhookLogQuerySchema>;
