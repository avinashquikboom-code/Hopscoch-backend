import { z } from 'zod';

export const addToCartSchema = z.object({
  productId: z.union([z.string(), z.number()]),
  variantId: z.union([z.string(), z.number()]).optional(),
  quantity: z.number().int().positive().default(1),
});

export const updateCartItemSchema = z.object({
  quantity: z.number().int().positive().optional(),
  savedForLater: z.boolean().optional(),
});
