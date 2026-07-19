import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().optional(),
  name: z.string().optional(),
  phone: z.string().regex(/^\+?[0-9]{10,15}$/, 'Invalid phone number').optional(),
  avatarUrl: z.string().optional(),
  deviceType: z.enum(['mobile', 'web', 'admin']).optional(),
  platform: z.string().optional(),
  browser: z.string().optional(),
  os: z.string().optional(),
  deviceId: z.string().optional(),
  deviceName: z.string().optional(),
  userAgent: z.string().optional(),
  ipAddress: z.string().optional(),
  fcmToken: z.string().optional(),
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
  deviceType: z.enum(['mobile', 'web', 'admin']).optional(),
  platform: z.string().optional(),
  browser: z.string().optional(),
  os: z.string().optional(),
  deviceId: z.string().optional(),
  deviceName: z.string().optional(),
  userAgent: z.string().optional(),
  ipAddress: z.string().optional(),
  fcmToken: z.string().optional(),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters'),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;
