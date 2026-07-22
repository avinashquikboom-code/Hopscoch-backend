import rateLimit from 'express-rate-limit';
import { Request } from 'express';

const isDev = process.env.NODE_ENV !== 'production';

// Skip rate limiting for Admin API requests, static media assets, and authenticated user requests
const shouldSkipLimiter = (req: Request): boolean => {
  if (req.path.startsWith('/uploads') || req.path.startsWith('/assets')) {
    return true;
  }
  const authHeader = req.headers['authorization'];
  if (authHeader && typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    return true;
  }
  const apiKey = req.headers['x-api-key'] as string | undefined;
  return !!apiKey && apiKey === (process.env.ADMIN_API_KEY || 'hopscotch-admin-api-key');
};

// STRICT — sirf sensitive endpoints (login, OTP, password reset)
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: isDev ? 100 : 20,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many attempts, please try again later.' },
});

// GENEROUS — normal app browsing (categories, products, banners, auth/me)
export const readLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 min
  max: isDev ? 2000 : 300, // ek app-open pe ~4-16 calls, kaafi headroom
  skip: shouldSkipLimiter,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests, please try again shortly.' },
});

// General write limiter for state-changing endpoints (POST, PUT, DELETE, PATCH)
export const rateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: isDev ? 10000 : 1500,
  skip: shouldSkipLimiter,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests from this IP, please try again later.' },
});

// Backwards compatibility aliases
export const authRateLimiter = authLimiter;
export const readRateLimiter = readLimiter;


