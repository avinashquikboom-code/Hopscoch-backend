import { z } from 'zod';

export const listProductsSchema = z.object({
  categoryId: z.string().optional(),
  category: z.string().optional(),
  brandId: z.string().optional(),
  minPrice: z.coerce.number().positive().optional(),
  maxPrice: z.coerce.number().positive().optional(),
  page: z.coerce.number().positive().default(1),
  limit: z.coerce.number().positive().max(500).default(20),
  sort: z.enum(['price_asc', 'price_desc', 'rating', 'newest', 'popular']).default('newest'),
  search: z.string().optional(),
  q: z.string().optional(),
  query: z.string().optional(),
  isFeatured: z.preprocess((v) => (v === 'true' ? true : v === 'false' ? false : v), z.boolean().optional()),
  isTrending: z.preprocess((v) => (v === 'true' ? true : v === 'false' ? false : v), z.boolean().optional()),
  isNewArrival: z.preprocess((v) => (v === 'true' ? true : v === 'false' ? false : v), z.boolean().optional()),
  isBestSeller: z.preprocess((v) => (v === 'true' ? true : v === 'false' ? false : v), z.boolean().optional()),
  gender: z.enum(['MALE', 'FEMALE', 'UNISEX']).optional(),
  ageGroup: z.enum(['ADULT', 'KID', 'INFANT']).optional(),
});
