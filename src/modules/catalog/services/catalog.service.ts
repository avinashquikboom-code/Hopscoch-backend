import { AppError } from '../../../middleware/errorHandler';
import prisma from '../../../utils/prisma';
import loyaltyRuleEngine from '../../loyalty/services/loyalty_rule.engine';

export class CatalogService {
  async listProducts(filters: {
    categoryId?: string;
    brandId?: string;
    minPrice?: number;
    maxPrice?: number;
    page?: number;
    limit?: number;
    sort?: string;
  }) {
    const {
      categoryId,
      brandId,
      minPrice,
      maxPrice,
      page = 1,
      limit = 100,
      sort = 'createdAt',
    } = filters;

    const skip = (page - 1) * limit;

    const where: any = {
      status: 'PUBLISHED',
      deletedAt: null,
    };

    if (categoryId) {
      const numCatId = Number(categoryId);
      if (!isNaN(numCatId)) {
        const childCategories = await prisma.category.findMany({
          where: { parentId: numCatId, deletedAt: null },
          select: { id: true },
        });
        const allCategoryIds = [numCatId, ...childCategories.map((c) => c.id)];
        where.categoryId = { in: allCategoryIds };
      } else {
        where.categoryId = categoryId;
      }
    }
    if (brandId) {
      const numBrandId = Number(brandId);
      where.brandId = !isNaN(numBrandId) ? numBrandId : brandId;
    }
    if (minPrice !== undefined || maxPrice !== undefined) {
      where.basePrice = {};
      if (minPrice !== undefined) where.basePrice.gte = minPrice;
      if (maxPrice !== undefined) where.basePrice.lte = maxPrice;
    }

    const orderBy: any = {};
    if (sort === 'price_asc') orderBy.basePrice = 'asc';
    else if (sort === 'price_desc') orderBy.basePrice = 'desc';
    else if (sort === 'rating') orderBy.avgRating = 'desc';
    else if (sort === 'newest') orderBy.createdAt = 'desc';
    else orderBy.createdAt = 'desc';

    const [rawProducts, total] = await Promise.all([
      prisma.product.findMany({
        where,
        include: {
          category: {
            include: { parent: true, taxRule: true },
          },
          taxRule: true,
          brand: true,
          images: {
            where: { sortOrder: 0 },
            take: 1,
          },
          variants: {
            where: { deletedAt: null },
          },
        },
        orderBy,
        skip,
        take: limit,
      }),
      prisma.product.count({ where }),
    ]);

    const products = await Promise.all(rawProducts.map(async (p) => {
      const vars = p.variants || [];
      const colors = Array.from(new Set(vars.map((v) => v.color).filter((c) => c && c !== 'Default')));
      const sizes = Array.from(new Set(vars.map((v) => v.size).filter((s) => s && s !== 'One Size')));
      let effectiveTaxRule = p.taxRule || (p.category as any)?.taxRule || null;
      if (!effectiveTaxRule && p.taxRuleId) {
        effectiveTaxRule = await prisma.tax.findUnique({
          where: { id: Number(p.taxRuleId) },
        });
      }
      if (!effectiveTaxRule && (p.category as any)?.taxRuleId) {
        effectiveTaxRule = await prisma.tax.findUnique({
          where: { id: Number((p.category as any).taxRuleId) },
        });
      }
      if (!effectiveTaxRule) {
        effectiveTaxRule = await prisma.tax.findFirst({
          where: { isActive: true },
          orderBy: { id: 'asc' },
        });
      }
      const rawRate = (p as any).taxPercent ?? (p as any).tax_percent ?? (p as any).taxRate ?? (p as any).tax_rate;
      const taxPercent = effectiveTaxRule
          ? Number(effectiveTaxRule.rate || 0)
          : (rawRate != null && !isNaN(Number(rawRate)) ? Number(rawRate) : 0);
      const rawType = (p as any).taxType ?? (p as any).tax_type ?? (p as any).type;
      const taxType = effectiveTaxRule
          ? (effectiveTaxRule.taxType || effectiveTaxRule.type || 'EXCLUSIVE')
          : (rawType ? String(rawType) : 'NONE');
      const isInclusive = String(taxType).trim().toUpperCase() === 'INCLUSIVE';
      const baseP = Number(p.basePrice || 0);
      const rawTaxVal = (taxPercent <= 0 || baseP <= 0)
          ? 0
          : (isInclusive ? baseP - (baseP / (1 + taxPercent / 100)) : (baseP * taxPercent) / 100);
      const taxAmount = Math.round(rawTaxVal * 100) / 100;

      const catObj = p.category as any;
      const mainCategoryName = catObj?.parent ? catObj.parent.name : catObj?.name || null;
      const mainCategoryId = catObj?.parent ? String(catObj.parent.id) : String(catObj?.id || p.categoryId);
      const subCategoryName = catObj?.parent ? catObj.name : null;
      const subCategoryId = catObj?.parent ? String(catObj.id) : null;

      const rewardCalc = await loyaltyRuleEngine.calculateProductReward(p);

      return {
        ...p,
        categoryName: mainCategoryName,
        parentCategoryId: mainCategoryId,
        subCategoryName: subCategoryName,
        subCategory: subCategoryName,
        subCategoryId: subCategoryId,
        taxRule: effectiveTaxRule,
        effectiveTaxRule,
        taxPercent,
        tax_percent: taxPercent,
        taxRate: taxPercent,
        tax_rate: taxPercent,
        taxType,
        tax_type: taxType,
        taxAmount,
        tax_amount: taxAmount,
        taxValue: taxAmount,
        margin: Number(p.margin || 0),
        maxMargin: Number(p.margin || 0),
        margin_ceiling: Number(p.margin || 0),
        colors,
        sizes,
        rewardEarned: rewardCalc.earnPoints,
        maxRedeemable: rewardCalc.maxRedeemablePoints,
        allowRedemption: rewardCalc.allowRedemption,
        allowEarning: rewardCalc.allowEarning,
        appliedRuleType: rewardCalc.appliedRuleType,
      };
    }));

    return {
      products,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getProductById(productId: any) {
    const product = await prisma.product.findUnique({
      where: { id: Number(productId), deletedAt: null },
      include: {
        category: {
          include: { taxRule: true },
        },
        taxRule: true,
        brand: true,
        images: {
          orderBy: { sortOrder: 'asc' },
        },
        variants: {
          where: { deletedAt: null },
        },
      },
    });

    if (!product) {
      throw new AppError('Product not found', 404);
    }

    const vars = product.variants || [];
    const colors = Array.from(new Set(vars.map((v) => v.color).filter((c) => c && c !== 'Default')));
    const sizes = Array.from(new Set(vars.map((v) => v.size).filter((s) => s && s !== 'One Size')));
    let effectiveTaxRule = product.taxRule || (product.category as any)?.taxRule || null;
    if (!effectiveTaxRule && product.taxRuleId) {
      effectiveTaxRule = await prisma.tax.findUnique({
        where: { id: Number(product.taxRuleId) },
      });
    }
    if (!effectiveTaxRule && (product.category as any)?.taxRuleId) {
      effectiveTaxRule = await prisma.tax.findUnique({
        where: { id: Number((product.category as any).taxRuleId) },
      });
    }
    if (!effectiveTaxRule) {
      effectiveTaxRule = await prisma.tax.findFirst({
        where: { isActive: true },
        orderBy: { id: 'asc' },
      });
    }
    const rawRate = (product as any).taxPercent ?? (product as any).tax_percent ?? (product as any).taxRate ?? (product as any).tax_rate;
    const taxPercent = effectiveTaxRule
        ? Number(effectiveTaxRule.rate || 0)
        : (rawRate != null && !isNaN(Number(rawRate)) ? Number(rawRate) : 0);
    const rawType = (product as any).taxType ?? (product as any).tax_type ?? (product as any).type;
    const taxType = effectiveTaxRule
        ? (effectiveTaxRule.taxType || effectiveTaxRule.type || 'EXCLUSIVE')
        : (rawType ? String(rawType) : 'NONE');

    const isInclusive = String(taxType).trim().toUpperCase() === 'INCLUSIVE';
    const baseP = Number(product.basePrice || 0);
    const rawTaxVal = (taxPercent <= 0 || baseP <= 0)
        ? 0
        : (isInclusive ? baseP - (baseP / (1 + taxPercent / 100)) : (baseP * taxPercent) / 100);
    const taxAmount = Math.round(rawTaxVal * 100) / 100;

    const rewardCalc = await loyaltyRuleEngine.calculateProductReward(product);

    return {
      ...product,
      taxRule: effectiveTaxRule,
      effectiveTaxRule,
      taxPercent,
      tax_percent: taxPercent,
      taxRate: taxPercent,
      tax_rate: taxPercent,
      taxType,
      tax_type: taxType,
      taxAmount,
      tax_amount: taxAmount,
      taxValue: taxAmount,
      tax_value: taxAmount,
      margin: Number(product.margin || 0),
      maxMargin: Number(product.margin || 0),
      margin_ceiling: Number(product.margin || 0),
      hsnCode: product.hsnCode || effectiveTaxRule?.hsnCode || null,
      colors,
      sizes,
      rewardEarned: rewardCalc.earnPoints,
      maxRedeemable: rewardCalc.maxRedeemablePoints,
      allowRedemption: rewardCalc.allowRedemption,
      allowEarning: rewardCalc.allowEarning,
      appliedRuleType: rewardCalc.appliedRuleType,
    };
  }

  async getProductImages(productId: any) {
    const product = await prisma.product.findUnique({
      where: { id: Number(productId), deletedAt: null },
      select: { id: true },
    });

    if (!product) {
      throw new AppError('Product not found', 404);
    }

    const images = await prisma.productImage.findMany({
      where: { productId },
      orderBy: { sortOrder: 'asc' },
    });

    return images;
  }

  async getProductVariants(productId: any) {
    const product = await prisma.product.findUnique({
      where: { id: Number(productId), deletedAt: null },
      select: { id: true },
    });

    if (!product) {
      throw new AppError('Product not found', 404);
    }

    const variants = await prisma.productVariant.findMany({
      where: { productId, deletedAt: null },
      orderBy: { price: 'asc' },
    });

    return variants;
  }

  async getRelatedProducts(productId: any) {
    const product = await prisma.product.findUnique({
      where: { id: Number(productId), deletedAt: null },
      select: { categoryId: true, brandId: true },
    });

    if (!product) {
      throw new AppError('Product not found', 404);
    }

    const relatedProducts = await prisma.product.findMany({
      where: {
        id: { not: productId },
        status: 'PUBLISHED',
        deletedAt: null,
        OR: [
          { categoryId: product.categoryId },
          { brandId: product.brandId },
        ],
      },
      include: {
        category: true,
        brand: true,
        images: {
          where: { sortOrder: 0 },
          take: 1,
        },
        variants: {
          where: { deletedAt: null },
        },
      },
      take: 8,
    });

    return relatedProducts;
  }
}

export default new CatalogService();
