import { z } from 'zod';

export const addToCartSchema = z.object({
  productId: z.string(),
  variantId: z.string(),
  quantity: z.number().int().positive().default(1),
});

export const updateCartItemSchema = z.object({
  quantity: z.number().int().positive().optional(),
  savedForLater: z.boolean().optional(),
});
