import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { ResponseFormatter } from '../utils/responseFormatter';

export class AppError extends Error {
  statusCode: number;
  isOperational: boolean;

  constructor(message: string, statusCode: number = 500, isOperational: boolean = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;

    Error.captureStackTrace(this, this.constructor);
  }
}

export const errorHandler = (
  err: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (err instanceof AppError) {
    logger.error({
      message: err.message,
      statusCode: err.statusCode,
      stack: err.stack,
      path: req.path,
      method: req.method,
    });

    ResponseFormatter.error(
      res,
      err.message,
      err.statusCode,
      err.name,
      []
    );
    return;
  }

  // Handle Prisma errors
  if (err.name === 'PrismaClientKnownRequestError') {
    const prismaError = err as any;
    
    if (prismaError.code === 'P2002') {
      logger.error({
        message: 'Unique constraint violation',
        details: prismaError.meta,
        path: req.path,
      });
      ResponseFormatter.error(
        res,
        'A record with this information already exists',
        409,
        'DUPLICATE_RECORD'
      );
      return;
    }

    if (prismaError.code === 'P2025') {
      logger.error({
        message: 'Record not found',
        details: prismaError.meta,
        path: req.path,
      });
      ResponseFormatter.error(
        res,
        'Record not found',
        404,
        'NOT_FOUND'
      );
      return;
    }
  }

  // Handle JWT errors
  if (err.name === 'JsonWebTokenError') {
    logger.error({
      message: 'Invalid token',
      path: req.path,
    });
    ResponseFormatter.error(
      res,
      'Invalid authentication token',
      401,
      'INVALID_TOKEN'
    );
    return;
  }

  if (err.name === 'TokenExpiredError') {
    logger.error({
      message: 'Token expired',
      path: req.path,
    });
    ResponseFormatter.error(
      res,
      'Authentication token has expired',
      401,
      'TOKEN_EXPIRED'
    );
    return;
  }

  // Handle Zod validation errors
  if (err.name === 'ZodError') {
    const zodError = err as any;
    logger.error({
      message: 'Validation error',
      errors: zodError.errors,
      path: req.path,
    });
    ResponseFormatter.error(
      res,
      'Validation failed',
      400,
      'VALIDATION_ERROR',
      zodError.errors
    );
    return;
  }

  // Default error
  logger.error({
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  ResponseFormatter.error(
    res,
    process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
    500,
    'INTERNAL_SERVER_ERROR'
  );
};
