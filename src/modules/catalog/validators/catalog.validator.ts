import { z } from 'zod';

export const listProductsSchema = z.object({
  categoryId: z.string().optional(),
  brandId: z.string().optional(),
  minPrice: z.coerce.number().positive().optional(),
  maxPrice: z.coerce.number().positive().optional(),
  page: z.coerce.number().positive().default(1),
  limit: z.coerce.number().positive().max(100).default(20),
  sort: z.enum(['price_asc', 'price_desc', 'rating', 'newest']).default('newest'),
});
