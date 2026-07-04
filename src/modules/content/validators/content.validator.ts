import { z } from 'zod';

export const createStaticContentSchema = z.object({
  key: z.string().min(1, 'Key is required'),
  type: z.enum(['PAGE', 'FAQ', 'BLOG', 'POLICY']).default('PAGE'),
  title: z.string().min(1, 'Title is required'),
  content: z.string().min(1, 'Content is required'),
  metaTitle: z.string().optional(),
  metaDescription: z.string().optional(),
  isActive: z.boolean().default(true),
});

export const updateStaticContentSchema = z.object({
  key: z.string().min(1).optional(),
  type: z.enum(['PAGE', 'FAQ', 'BLOG', 'POLICY']).optional(),
  title: z.string().min(1).optional(),
  content: z.string().min(1).optional(),
  metaTitle: z.string().optional(),
  metaDescription: z.string().optional(),
  isActive: z.boolean().optional(),
});

export const createContactRequestSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email format'),
  phone: z.string().optional(),
  subject: z.string().min(5, 'Subject must be at least 5 characters'),
  message: z.string().min(10, 'Message must be at least 10 characters'),
});

export const updateContactRequestSchema = z.object({
  status: z.enum(['PENDING', 'IN_PROGRESS', 'RESOLVED']).optional(),
  response: z.string().optional(),
});

export type CreateStaticContentDto = z.infer<typeof createStaticContentSchema>;
export type UpdateStaticContentDto = z.infer<typeof updateStaticContentSchema>;
export type CreateContactRequestDto = z.infer<typeof createContactRequestSchema>;
export type UpdateContactRequestDto = z.infer<typeof updateContactRequestSchema>;
