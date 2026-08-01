import { z } from 'zod';

export const createBannerSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  imageUrl: z.string().min(1, 'Image URL is required'),
  link: z.string().optional(),
  type: z.string().optional().default('home'),
  position: z.string().default('HOME'),
  isActive: z.boolean().default(true),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

export const updateBannerSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  imageUrl: z.string().optional(),
  link: z.string().optional(),
  type: z.string().optional(),
  position: z.string().optional(),
  isActive: z.boolean().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
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
