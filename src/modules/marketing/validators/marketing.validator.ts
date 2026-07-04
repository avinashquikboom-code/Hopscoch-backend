import { z } from 'zod';

export const createBannerSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  imageUrl: z.string().url('Invalid image URL'),
  link: z.string().url().optional(),
  position: z.enum(['HOME', 'CATEGORY', 'PRODUCT', 'ALL']).default('HOME'),
  isActive: z.boolean().default(true),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

export const updateBannerSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  imageUrl: z.string().url().optional(),
  link: z.string().url().optional(),
  position: z.enum(['HOME', 'CATEGORY', 'PRODUCT', 'ALL']).optional(),
  isActive: z.boolean().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

export const createCampaignSchema = z.object({
  name: z.string().min(1, 'Campaign name is required'),
  description: z.string().optional(),
  type: z.enum(['EMAIL', 'PUSH', 'SMS', 'ALL']).default('ALL'),
  message: z.string().min(1, 'Message is required'),
  targetAudience: z.enum(['ALL', 'CUSTOMERS', 'NEW_USERS', 'INACTIVE']).default('ALL'),
  scheduledDate: z.string().datetime().optional(),
  isActive: z.boolean().default(true),
});

export type CreateBannerDto = z.infer<typeof createBannerSchema>;
export type UpdateBannerDto = z.infer<typeof updateBannerSchema>;
export type CreateCampaignDto = z.infer<typeof createCampaignSchema>;
