import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AppError } from './errorHandler';
import prisma from '../utils/prisma';

export interface AuthRequest extends Request {
  user?: {
    id: number;
    email: string;
    role: string;
  };
}

export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError('Authentication token required', 401);
    }

    const token = authHeader.substring(7);

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
    for (const secret of secrets) {
      try {
        decoded = jwt.verify(token, secret);
        verified = true;
        break;
      } catch (err) {
        // try next secret
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
