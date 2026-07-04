import { z } from 'zod';

export const updateAppSettingsSchema = z.object({
  siteName: z.string().optional(),
  siteDescription: z.string().optional(),
  siteUrl: z.string().url().optional(),
  logoUrl: z.string().url().optional(),
  faviconUrl: z.string().url().optional(),
  contactEmail: z.string().email().optional(),
  contactPhone: z.string().optional(),
  socialLinks: z.record(z.string()).optional(),
  seoTitle: z.string().optional(),
  seoDescription: z.string().optional(),
});

export const createLanguageSchema = z.object({
  code: z.string().min(2, 'Language code must be at least 2 characters'),
  name: z.string().min(2, 'Language name must be at least 2 characters'),
  nativeName: z.string().min(2, 'Native name must be at least 2 characters'),
  isActive: z.boolean().default(true),
  isDefault: z.boolean().default(false),
});

export const createCurrencySchema = z.object({
  code: z.string().min(3, 'Currency code must be at least 3 characters'),
  name: z.string().min(2, 'Currency name must be at least 2 characters'),
  symbol: z.string().min(1, 'Currency symbol is required'),
  exchangeRate: z.number().positive('Exchange rate must be positive'),
  isActive: z.boolean().default(true),
  isDefault: z.boolean().default(false),
});

export type UpdateAppSettingsDto = z.infer<typeof updateAppSettingsSchema>;
export type CreateLanguageDto = z.infer<typeof createLanguageSchema>;
export type CreateCurrencyDto = z.infer<typeof createCurrencySchema>;
