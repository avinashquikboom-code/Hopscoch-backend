import prisma from '../../../utils/prisma';
import { CreateTaxRuleDto, UpdateTaxRuleDto } from '../dto/tax.dto';
import { TaxFilterQuery, BulkTaxActionParams } from '../types/tax.types';

export class TaxRepository {
  async getOrCreateDefaultTaxType(code: string, name: string) {
    const uppercaseCode = code.toUpperCase().replace(/\s+/g, '_');
    let taxType = await prisma.taxType.findUnique({
      where: { code: uppercaseCode },
    });
    if (!taxType) {
      taxType = await prisma.taxType.create({
        data: {
          code: uppercaseCode,
          name: name || uppercaseCode,
          isSystem: true,
          isActive: true,
        },
      });
    }
    return taxType;
  }

  async findByCode(taxCode: string) {
    return prisma.taxRule.findUnique({
      where: { taxCode },
      include: { taxType: true },
    });
  }

  async findByName(name: string) {
    return prisma.taxRule.findFirst({
      where: { name: { equals: name, mode: 'insensitive' } },
      include: { taxType: true },
    });
  }

  async findById(id: number) {
    return prisma.taxRule.findUnique({
      where: { id },
      include: { taxType: true, productTaxes: true },
    });
  }

  async createTaxRule(dto: CreateTaxRuleDto) {
    const taxTypeObj = await this.getOrCreateDefaultTaxType(dto.taxType || 'GST', dto.taxType || 'GST');
    const rateVal = Number(dto.rate);
    const cgstVal = dto.cgst !== undefined ? Number(dto.cgst) : rateVal / 2;
    const sgstVal = dto.sgst !== undefined ? Number(dto.sgst) : rateVal / 2;
    const igstVal = dto.igst !== undefined ? Number(dto.igst) : rateVal;

    // Create legacy Tax record to maintain 100% backward compatibility with Tax table
    const legacyTax = await prisma.tax.create({
      data: {
        name: dto.name,
        rate: rateVal,
        type: 'PERCENTAGE',
        taxType: dto.taxType || 'GST',
        country: dto.country || 'IN',
        state: dto.state || null,
        zipCode: dto.zipCode || null,
        isActive: dto.isActive !== false,
      },
    });

    const taxRule = await prisma.taxRule.create({
      data: {
        name: dto.name,
        taxCode: dto.taxCode.toUpperCase().trim(),
        taxTypeId: taxTypeObj.id,
        country: (dto.country || 'IN').toUpperCase(),
        state: dto.state || null,
        zipCode: dto.zipCode || null,
        rate: rateVal,
        cgst: cgstVal,
        sgst: sgstVal,
        igst: igstVal,
        description: dto.description || null,
        priority: dto.priority !== undefined ? Number(dto.priority) : 0,
        displayOrder: dto.displayOrder !== undefined ? Number(dto.displayOrder) : 0,
        isDefault: Boolean(dto.isDefault),
        isActive: dto.isActive !== false,
        effectiveDate: dto.effectiveDate ? new Date(dto.effectiveDate) : null,
        expiryDate: dto.expiryDate ? new Date(dto.expiryDate) : null,
      },
      include: { taxType: true },
    });

    await this.logHistory('TaxRule', taxRule.id, 'CREATE', JSON.stringify(taxRule));
    return taxRule;
  }

  async updateTaxRule(id: number, dto: UpdateTaxRuleDto) {
    const existing = await this.findById(id);
    if (!existing) return null;

    const data: any = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.taxCode !== undefined) data.taxCode = dto.taxCode.toUpperCase().trim();
    if (dto.country !== undefined) data.country = dto.country.toUpperCase();
    if (dto.state !== undefined) data.state = dto.state;
    if (dto.zipCode !== undefined) data.zipCode = dto.zipCode;
    if (dto.rate !== undefined) data.rate = Number(dto.rate);
    if (dto.cgst !== undefined) data.cgst = Number(dto.cgst);
    if (dto.sgst !== undefined) data.sgst = Number(dto.sgst);
    if (dto.igst !== undefined) data.igst = Number(dto.igst);
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.priority !== undefined) data.priority = Number(dto.priority);
    if (dto.displayOrder !== undefined) data.displayOrder = Number(dto.displayOrder);
    if (dto.isDefault !== undefined) data.isDefault = Boolean(dto.isDefault);
    if (dto.isActive !== undefined) data.isActive = Boolean(dto.isActive);
    if (dto.effectiveDate !== undefined) data.effectiveDate = dto.effectiveDate ? new Date(dto.effectiveDate) : null;
    if (dto.expiryDate !== undefined) data.expiryDate = dto.expiryDate ? new Date(dto.expiryDate) : null;

    if (dto.taxType) {
      const taxTypeObj = await this.getOrCreateDefaultTaxType(dto.taxType, dto.taxType);
      data.taxTypeId = taxTypeObj.id;
    }

    const updated = await prisma.taxRule.update({
      where: { id },
      data,
      include: { taxType: true },
    });

    // Update matching legacy tax entry if present
    const legacy = await prisma.tax.findFirst({
      where: { name: { equals: existing.name, mode: 'insensitive' } },
    });
    if (legacy) {
      await prisma.tax.update({
        where: { id: legacy.id },
        data: {
          name: updated.name,
          rate: updated.rate,
          taxType: dto.taxType || legacy.taxType,
          isActive: updated.isActive,
        },
      });
    }

    await this.logHistory('TaxRule', id, 'UPDATE', JSON.stringify({ before: existing, after: updated }));
    return updated;
  }

  async deleteTaxRule(id: number) {
    const existing = await this.findById(id);
    if (!existing) return false;

    await prisma.taxRule.delete({ where: { id } });
    await this.logHistory('TaxRule', id, 'DELETE', JSON.stringify(existing));
    return true;
  }

  async findMany(query: TaxFilterQuery) {
    const page = Number(query.page || 1);
    const limit = Number(query.limit || 10);
    const skip = (page - 1) * limit;

    const where: any = {};

    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { taxCode: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    if (query.country) {
      where.country = query.country.toUpperCase();
    }

    if (query.isActive !== undefined) {
      where.isActive = Boolean(query.isActive);
    }

    if (query.taxType) {
      where.taxType = {
        code: { equals: query.taxType.toUpperCase(), mode: 'insensitive' },
      };
    }

    const orderBy: any = {};
    const sortField = query.sortBy || 'createdAt';
    const sortDir = query.sortOrder || 'desc';
    orderBy[sortField] = sortDir;

    const [rules, total] = await Promise.all([
      prisma.taxRule.findMany({
        where,
        include: { taxType: true },
        skip,
        take: limit,
        orderBy,
      }),
      prisma.taxRule.count({ where }),
    ]);

    return {
      rules,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async bulkAction(params: BulkTaxActionParams) {
    const { action, taxRuleIds } = params;

    if (action === 'DELETE') {
      await prisma.taxRule.deleteMany({
        where: { id: { in: taxRuleIds } },
      });
    } else if (action === 'ENABLE') {
      await prisma.taxRule.updateMany({
        where: { id: { in: taxRuleIds } },
        data: { isActive: true },
      });
    } else if (action === 'DISABLE') {
      await prisma.taxRule.updateMany({
        where: { id: { in: taxRuleIds } },
        data: { isActive: false },
      });
    }

    await this.logHistory('TaxRule', 0, `BULK_${action}`, JSON.stringify({ ids: taxRuleIds }));
    return true;
  }

  async assignProductTax(productId: number, taxRuleId?: number, customRate?: number, country = 'IN') {
    const record = await prisma.productTax.upsert({
      where: {
        productId_country: { productId, country: country.toUpperCase() },
      },
      create: {
        productId,
        taxRuleId: taxRuleId || null,
        customRate: customRate !== undefined ? Number(customRate) : null,
        country: country.toUpperCase(),
      },
      update: {
        taxRuleId: taxRuleId || null,
        customRate: customRate !== undefined ? Number(customRate) : null,
      },
    });

    if (taxRuleId) {
      await prisma.product.update({
        where: { id: productId },
        data: { taxRuleId },
      });
    }

    await this.logHistory('ProductTax', record.id, 'ASSIGN', JSON.stringify(record));
    return record;
  }

  async removeProductTax(productId: number, country = 'IN') {
    await prisma.productTax.deleteMany({
      where: { productId, country: country.toUpperCase() },
    });

    await prisma.product.update({
      where: { id: productId },
      data: { taxRuleId: null },
    });

    await this.logHistory('ProductTax', productId, 'REMOVE', JSON.stringify({ productId, country }));
    return true;
  }

  async logHistory(entityType: string, entityId: number, action: string, changes: string, userId?: number, userEmail?: string) {
    return prisma.taxHistory.create({
      data: {
        entityType,
        entityId,
        action,
        changes,
        userId: userId || null,
        userEmail: userEmail || null,
      },
    });
  }
}

export const taxRepository = new TaxRepository();
