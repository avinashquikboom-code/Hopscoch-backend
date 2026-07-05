import { z } from 'zod';

export const createAdminUserSchema = z.object({
  email: z.string().email('Invalid email format'),
  firstName: z.string().min(2, 'First name must be at least 2 characters'),
  lastName: z.string().min(2, 'Last name must be at least 2 characters'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  role: z.enum(['CUSTOMER', 'ADMIN']).default('ADMIN'),
});

export const updateAdminUserSchema = z.object({
  firstName: z.string().min(2).optional(),
  lastName: z.string().min(2).optional(),
  email: z.string().email().optional(),
  role: z.enum(['CUSTOMER', 'ADMIN']).optional(),
  isActive: z.boolean().optional(),
});

export const createRoleSchema = z.object({
  name: z.string().min(2, 'Role name must be at least 2 characters'),
  description: z.string().optional(),
  permissions: z.array(z.string()).default([]),
});

export const updateRoleSchema = z.object({
  name: z.string().min(2).optional(),
  description: z.string().optional(),
  permissions: z.array(z.string()).optional(),
});

export const activityLogQuerySchema = z.object({
  page: z.string().optional().default('1'),
  limit: z.string().optional().default('20'),
  userId: z.coerce.number().int().optional(),
  action: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

export type CreateAdminUserDto = z.infer<typeof createAdminUserSchema>;
export type UpdateAdminUserDto = z.infer<typeof updateAdminUserSchema>;
export type CreateRoleDto = z.infer<typeof createRoleSchema>;
export type UpdateRoleDto = z.infer<typeof updateRoleSchema>;
export type ActivityLogQueryDto = z.infer<typeof activityLogQuerySchema>;
