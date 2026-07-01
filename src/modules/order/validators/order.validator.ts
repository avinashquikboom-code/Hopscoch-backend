import { z } from 'zod';

export const createOrderSchema = z.object({
  addressId: z.string(),
});
