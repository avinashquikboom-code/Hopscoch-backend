import { z } from 'zod';

export const uploadImageSchema = z.object({
  imageUrl: z.string().url(),
});
