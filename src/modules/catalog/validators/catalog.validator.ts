import { z } from 'zod';

export const listProductsSchema = z.object({
  categoryId: z.string().optional(),
  brandId: z.string().optional(),
  minPrice: z.number().positive().optional(),
  maxPrice: z.number().positive().optional(),
  page: z.number().positive().default(1),
  limit: z.number().positive().max(100).default(20),
  sort: z.enum(['price_asc', 'price_desc', 'rating', 'newest']).default('newest'),
});
