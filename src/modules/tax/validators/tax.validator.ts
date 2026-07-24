import { CreateTaxRuleDto, UpdateTaxRuleDto } from '../dto/tax.dto';
import { TAX_ERROR_MESSAGES, TAX_TYPES } from '../constants/tax.constants';

export class TaxValidator {
  static validateCreateDto(dto: CreateTaxRuleDto): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!dto.name || dto.name.trim().length === 0) {
      errors.push('Tax Name is required.');
    }

    if (!dto.taxCode || dto.taxCode.trim().length === 0) {
      errors.push('Tax Code is required.');
    }

    if (dto.rate === undefined || dto.rate === null || isNaN(Number(dto.rate))) {
      errors.push('Tax Rate is required and must be a valid number.');
    } else {
      const rateNum = Number(dto.rate);
      if (rateNum < 0 || rateNum > 100) {
        errors.push(TAX_ERROR_MESSAGES.INVALID_RATE);
      }
    }

    if (dto.country && dto.country.trim().length !== 2) {
      errors.push(TAX_ERROR_MESSAGES.INVALID_COUNTRY);
    }

    if (dto.effectiveDate && dto.expiryDate) {
      const start = new Date(dto.effectiveDate);
      const end = new Date(dto.expiryDate);
      if (end <= start) {
        errors.push(TAX_ERROR_MESSAGES.INVALID_DATES);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  static validateUpdateDto(dto: UpdateTaxRuleDto): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (dto.rate !== undefined && dto.rate !== null) {
      const rateNum = Number(dto.rate);
      if (isNaN(rateNum) || rateNum < 0 || rateNum > 100) {
        errors.push(TAX_ERROR_MESSAGES.INVALID_RATE);
      }
    }

    if (dto.country && dto.country.trim().length !== 2) {
      errors.push(TAX_ERROR_MESSAGES.INVALID_COUNTRY);
    }

    if (dto.effectiveDate && dto.expiryDate) {
      const start = new Date(dto.effectiveDate);
      const end = new Date(dto.expiryDate);
      if (end <= start) {
        errors.push(TAX_ERROR_MESSAGES.INVALID_DATES);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}
