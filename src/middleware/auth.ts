import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AppError } from './errorHandler';
import prisma from '../utils/prisma';
import AuthService from '../modules/auth/services/auth.service';

export interface AuthRequest extends Request {
  user?: {
    id: number;
    email: string;
    role: string;
  };
}

// Helper to manually parse cookies since cookie-parser is not installed
const parseCookies = (cookieHeader: string | undefined): Record<string, string> => {
  const cookies: Record<string, string> = {};
  if (!cookieHeader) return cookies;
  
  cookieHeader.split(';').forEach(cookie => {
    const parts = cookie.split('=');
    if (parts.length === 2) {
      cookies[parts[0].trim()] = parts[1].trim();
    }
  });
  return cookies;
};

export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const cookies = parseCookies(req.headers.cookie);
    let token = '';
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    } else {
      token = cookies.accessToken || cookies.auth_token || '';
    }

    if (!token) {
      throw new AppError('Authentication token required', 401);
    }

    let decoded: any;
    const secrets = [
      process.env.JWT_SECRET || 'your-super-secret-jwt-key',
      process.env.ADMIN_JWT_SECRET || 'your-admin-jwt-secret',
      process.env.WEBSITE_JWT_SECRET || 'your-website-jwt-secret',
      process.env.MOBILE_JWT_SECRET || 'your-mobile-jwt-secret',
    ];

    let verified = false;
    let expired = false;

    for (const secret of secrets) {
      try {
        decoded = jwt.verify(token, secret);
        verified = true;
        break;
      } catch (err: any) {
        if (err.name === 'TokenExpiredError') {
          expired = true;
        }
      }
    }

    // If access token is expired or verification failed, check for refresh token in cookies
    if (!verified || expired) {
      const refreshToken = cookies.refreshToken || cookies.refresh_token;
      if (refreshToken) {
        try {
          // Attempt automatic token refresh
          const tokens = await AuthService.refreshAccessToken(refreshToken, 'admin');
          
          // Set new cookies on response
          res.cookie('accessToken', tokens.accessToken, {
            httpOnly: false,
            secure: false,
            maxAge: 24 * 60 * 60 * 1000,
            path: '/'
          });
          res.cookie('refreshToken', tokens.refreshToken, {
            httpOnly: true,
            secure: false,
            maxAge: 7 * 24 * 60 * 60 * 1000,
            path: '/'
          });

          // Set custom header to notify client
          res.setHeader('X-New-Access-Token', tokens.accessToken);
          
          decoded = jwt.decode(tokens.accessToken);
          verified = true;
        } catch (refreshErr) {
          throw new AppError('Authentication failed: Invalid signature or expired token', 401);
        }
      } else {
        throw new AppError('Authentication failed: Invalid signature or expired token', 401);
      }
    }

    if (!verified || !decoded) {
      throw new AppError('Authentication failed: Invalid signature or expired token', 401);
    }

    // Verify user exists
    const user = await prisma.user.findUnique({
      where: { id: Number(decoded.userId) },
      select: {
        id: true,
        email: true,
        role: true,
        isActive: true,
        deletedAt: true,
      },
    });

    if (!user || !user.isActive || user.deletedAt) {
      throw new AppError('User not found or inactive', 401);
    }

    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
    };

    next();
  } catch (error) {
    next(error);
  }
};

export const authorize = (...roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw new AppError('Authentication required', 401);
    }

    if (!roles.includes(req.user.role)) {
      throw new AppError('Insufficient permissions', 403);
    }

    next();
  };
};
