import rateLimit from 'express-rate-limit';
import { Request } from 'express';

const isDev = process.env.NODE_ENV !== 'production';

// Requests from the admin panel identify themselves with the admin API key.
// They are exempt from the general limiter so bursts of dashboard calls
// don't get throttled into 429s.
const isAdminPanelRequest = (req: Request): boolean => {
  const apiKey = req.headers['x-api-key'] as string | undefined;
  return !!apiKey && apiKey === (process.env.ADMIN_API_KEY || 'hopscotch-admin-api-key');
};

export const rateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isDev ? 5000 : 1000,
  skip: isAdminPanelRequest,
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isDev ? 100 : 20,
  skipSuccessfulRequests: true, // only failed attempts count toward the limit
  message: {
    success: false,
    message: 'Too many authentication attempts, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});
