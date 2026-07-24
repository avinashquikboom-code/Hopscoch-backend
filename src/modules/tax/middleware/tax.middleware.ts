import { Request, Response, NextFunction } from 'express';
import { TaxValidator } from '../validators/tax.validator';

export function validateCreateTaxMiddleware(req: Request, res: Response, next: NextFunction): void {
  const { isValid, errors } = TaxValidator.validateCreateDto(req.body);
  if (!isValid) {
    res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors,
    });
    return;
  }
  next();
}

export function validateUpdateTaxMiddleware(req: Request, res: Response, next: NextFunction): void {
  const { isValid, errors } = TaxValidator.validateUpdateDto(req.body);
  if (!isValid) {
    res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors,
    });
    return;
  }
  next();
}
