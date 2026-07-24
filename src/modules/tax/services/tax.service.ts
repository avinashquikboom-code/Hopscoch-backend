import { taxRepository, TaxRepository } from '../repositories/tax.repository';
import { CreateTaxRuleDto, UpdateTaxRuleDto, AssignProductTaxDto } from '../dto/tax.dto';
import { TaxFilterQuery, BulkTaxActionParams } from '../types/tax.types';
import { TAX_ERROR_MESSAGES } from '../constants/tax.constants';
import { taxEvents } from '../events/tax.events';
import { AppError } from '../../../middleware/errorHandler';

export class TaxService {
  constructor(private repository: TaxRepository = taxRepository) {}

  async createTaxRule(dto: CreateTaxRuleDto) {
    const existingCode = await this.repository.findByCode(dto.taxCode.toUpperCase().trim());
    if (existingCode) {
      throw new AppError(TAX_ERROR_MESSAGES.DUPLICATE_CODE, 400);
    }

    const existingName = await this.repository.findByName(dto.name.trim());
    if (existingName) {
      throw new AppError(TAX_ERROR_MESSAGES.DUPLICATE_NAME, 400);
    }

    const taxRule = await this.repository.createTaxRule(dto);
    taxEvents.emit('tax_rule_created', taxRule);
    return taxRule;
  }

  async updateTaxRule(id: number, dto: UpdateTaxRuleDto) {
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new AppError(TAX_ERROR_MESSAGES.TAX_NOT_FOUND, 444);
    }

    if (dto.taxCode && dto.taxCode.toUpperCase().trim() !== existing.taxCode) {
      const codeCheck = await this.repository.findByCode(dto.taxCode.toUpperCase().trim());
      if (codeCheck) {
        throw new AppError(TAX_ERROR_MESSAGES.DUPLICATE_CODE, 400);
      }
    }

    if (dto.name && dto.name.trim().toLowerCase() !== existing.name.toLowerCase()) {
      const nameCheck = await this.repository.findByName(dto.name.trim());
      if (nameCheck) {
        throw new AppError(TAX_ERROR_MESSAGES.DUPLICATE_NAME, 400);
      }
    }

    const updated = await this.repository.updateTaxRule(id, dto);
    taxEvents.emit('tax_rule_updated', updated);
    return updated;
  }

  async deleteTaxRule(id: number) {
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new AppError(TAX_ERROR_MESSAGES.TAX_NOT_FOUND, 404);
    }

    const success = await this.repository.deleteTaxRule(id);
    taxEvents.emit('tax_rule_deleted', { id });
    return success;
  }

  async getTaxRuleById(id: number) {
    const taxRule = await this.repository.findById(id);
    if (!taxRule) {
      throw new AppError(TAX_ERROR_MESSAGES.TAX_NOT_FOUND, 404);
    }
    return taxRule;
  }

  async getTaxRules(query: TaxFilterQuery) {
    return this.repository.findMany(query);
  }

  async bulkTaxAction(params: BulkTaxActionParams) {
    if (!params.taxRuleIds || params.taxRuleIds.length === 0) {
      throw new AppError('No tax rule IDs provided for bulk action.', 400);
    }
    return this.repository.bulkAction(params);
  }

  async assignProductTax(dto: AssignProductTaxDto) {
    return this.repository.assignProductTax(dto.productId, dto.taxRuleId, dto.customRate, dto.country);
  }

  async removeProductTax(productId: number, country = 'IN') {
    return this.repository.removeProductTax(productId, country);
  }
}

export const taxService = new TaxService();
