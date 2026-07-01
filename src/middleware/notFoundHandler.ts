import { Request, Response, NextFunction } from 'express';
import { ResponseFormatter } from '../utils/responseFormatter';

export const notFoundHandler = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  ResponseFormatter.error(
    res,
    `Route ${req.method} ${req.path} not found`,
    404,
    'NOT_FOUND'
  );
};
