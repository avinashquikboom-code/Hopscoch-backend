import { AppError } from '../../../middleware/errorHandler';
import prisma from '../../../utils/prisma';
import loyaltyRuleEngine from '../../loyalty/services/loyalty_rule.engine';
import { normalizeAssetUrl } from '../../../utils/asset-url';

export class CatalogService {
  async listProducts(filters: {
    categoryId?: string;
    category?: string;
    brandId?: string;
    minPrice?: number;
    maxPrice?: number;
    page?: number;
    limit?: number;
    sort?: string;
    search?: string;
    q?: string;
    query?: string;
    isFeatured?: boolean;
    isTrending?: boolean;
    isNewArrival?: boolean;
    isBestSeller?: boolean;
    gender?: string;
    ageGroup?: string;
  }) {
    const {
      categoryId,
      category,
      brandId,
      minPrice,
      maxPrice,
      page = 1,
      limit = 100,
      sort = 'newest',
      search,
      q,
      query,
      isFeatured,
      isTrending,
      isNewArrival,
      isBestSeller,
      gender,
      ageGroup,
    } = filters;

    const skip = (page - 1) * limit;

    const where: any = {
      status: 'PUBLISHED',
      deletedAt: null,
    };

    // Category resolution by ID, slug, or name (case-insensitive + subcategory tree + gender target)
    const catInput = categoryId || category;
    if (catInput && catInput !== 'all') {
      const catStr = String(catInput).trim();
      const numCatId = Number(catStr);

      const targetLower = catStr.toLowerCase();
      const isMenTarget = targetLower === 'men' || targetLower === 'male' || targetLower === 'boy' || targetLower === 'boys';
      const isWomenTarget = targetLower === 'women' || targetLower === 'female' || targetLower === 'girl' || targetLower === 'girls';
      const isKidsTarget = targetLower === 'kids' || targetLower === 'kid' || targetLower === 'children' || targetLower === 'baby';

      if (!isNaN(numCatId) && numCatId > 0) {
        const childCategories = await prisma.category.findMany({
          where: { parentId: numCatId, deletedAt: null },
          select: { id: true },
        });
        const allCategoryIds = [numCatId, ...childCategories.map((c) => c.id)];
        where.categoryId = { in: allCategoryIds };
      } else {
        const catRecords = await prisma.category.findMany({
          where: {
            OR: [
              { slug: { equals: catStr, mode: 'insensitive' } },
              { name: { equals: catStr, mode: 'insensitive' } },
              { slug: { contains: catStr, mode: 'insensitive' } },
              { name: { contains: catStr, mode: 'insensitive' } },
            ],
            deletedAt: null,
          },
          select: { id: true },
        });

        const catIds = catRecords.map((c) => c.id);
        let allCategoryIds: number[] = [];
        if (catIds.length > 0) {
          const childCategories = await prisma.category.findMany({
            where: { parentId: { in: catIds }, deletedAt: null },
            select: { id: true },
          });
          allCategoryIds = Array.from(new Set([...catIds, ...childCategories.map((c) => c.id)]));
        }

        if (isMenTarget) {
          const genderConditions: any[] = [{ gender: 'MALE' }, { gender: 'UNISEX' }];
          if (allCategoryIds.length > 0) {
            genderConditions.push({ categoryId: { in: allCategoryIds } });
          }
          where.OR = where.OR ? [...where.OR, ...genderConditions] : genderConditions;
        } else if (isWomenTarget) {
          const genderConditions: any[] = [{ gender: 'FEMALE' }, { gender: 'UNISEX' }];
          if (allCategoryIds.length > 0) {
            genderConditions.push({ categoryId: { in: allCategoryIds } });
          }
          where.OR = where.OR ? [...where.OR, ...genderConditions] : genderConditions;
        } else if (isKidsTarget) {
          const kidsConditions: any[] = [{ ageGroup: 'KID' }, { ageGroup: 'INFANT' }];
          if (allCategoryIds.length > 0) {
            kidsConditions.push({ categoryId: { in: allCategoryIds } });
          }
          where.OR = where.OR ? [...where.OR, ...kidsConditions] : kidsConditions;
        } else if (allCategoryIds.length > 0) {
          where.categoryId = { in: allCategoryIds };
        }
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

    if (isFeatured !== undefined) where.isFeatured = isFeatured;
    if (isTrending !== undefined) where.isTrending = isTrending;
    if (isNewArrival !== undefined) where.isNewArrival = isNewArrival;
    if (isBestSeller !== undefined) where.isBestSeller = isBestSeller;
    if (gender) where.gender = gender as any;
    if (ageGroup) where.ageGroup = ageGroup as any;

    const searchKeyword = (search || q || query || '').trim();
    if (searchKeyword) {
      const numSearch = Number(searchKeyword);
      where.OR = [
        ...(isNaN(numSearch) ? [] : [{ id: numSearch }]),
        { name: { contains: searchKeyword, mode: 'insensitive' } },
        { description: { contains: searchKeyword, mode: 'insensitive' } },
        { hsnCode: { contains: searchKeyword, mode: 'insensitive' } },
        { category: { name: { contains: searchKeyword, mode: 'insensitive' } } },
        { brand: { name: { contains: searchKeyword, mode: 'insensitive' } } },
        { variants: { some: { sku: { contains: searchKeyword, mode: 'insensitive' } } } },
      ];
    }

    const orderBy: any = {};
    if (sort === 'price_asc') orderBy.basePrice = 'asc';
    else if (sort === 'price_desc') orderBy.basePrice = 'desc';
    else if (sort === 'rating') orderBy.avgRating = 'desc';
    else if (sort === 'popular') orderBy.reviewCount = 'desc';
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
            orderBy: { sortOrder: 'asc' },
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

    const products = await Promise.all(
      rawProducts.map((p) => this.formatProductResponse(p))
    );

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

  async formatProductResponse(p: any) {
    const DEFAULT_PLACEHOLDER = 'https://images.unsplash.com/photo-1576995853123-5a10305d93c0?w=600&auto=format&fit=crop&q=80';

    const toFullUrl = (url: string | null | undefined): string | null => {
      return normalizeAssetUrl(url);
    };

    const vars = p.variants || [];
    const colors = Array.from(new Set(vars.map((v: any) => v.color).filter((c: any) => c && c !== 'Default')));
    const sizes = Array.from(new Set(vars.map((v: any) => v.size).filter((s: any) => s && s !== 'One Size')));

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
    const mainCategoryName = catObj?.parent ? catObj.parent.name : catObj?.name || 'Collections';
    const mainCategoryId = catObj?.parent ? String(catObj.parent.id) : String(catObj?.id || p.categoryId || '1');
    const subCategoryName = catObj?.parent ? catObj.name : null;
    const subCategoryId = catObj?.parent ? String(catObj.id) : null;

    const rewardCalc = await loyaltyRuleEngine.calculateProductReward(p);

    let resolvedImages = (p.images || []).map((img: any) => ({
      ...img,
      url: toFullUrl(img.url) || DEFAULT_PLACEHOLDER,
    }));

    if (resolvedImages.length === 0) {
      resolvedImages = [{
        id: 0,
        productId: p.id,
        url: toFullUrl(p.thumbnailUrl) || DEFAULT_PLACEHOLDER,
        altText: p.name || 'Product Image',
        sortOrder: 0,
      }];
    }

    const resolvedThumbnailUrl = toFullUrl(p.thumbnailUrl) || (resolvedImages.length > 0 ? resolvedImages[0].url : DEFAULT_PLACEHOLDER);
    const totalStock = vars.reduce((acc: number, v: any) => acc + (v.stock || 0), 0);

    return {
      ...p,
      price: baseP,
      stock: totalStock,
      thumbnailUrl: resolvedThumbnailUrl,
      images: resolvedImages,
      colors,
      sizes,
      category: catObj ? {
        ...catObj,
        iconUrl: toFullUrl(catObj.iconUrl),
        bannerUrl: toFullUrl(catObj.bannerUrl),
        parent: catObj.parent ? {
          ...catObj.parent,
          iconUrl: toFullUrl(catObj.parent.iconUrl),
          bannerUrl: toFullUrl(catObj.parent.bannerUrl),
        } : null,
      } : null,
      brand: p.brand ? {
        ...p.brand,
        logoUrl: toFullUrl(p.brand.logoUrl),
        bannerUrl: toFullUrl(p.brand.bannerUrl),
      } : null,
      rating: Number(p.avgRating || 4.5),
      reviewCount: p.reviewCount || 0,
      review_count: p.reviewCount || 0,
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
      hsnCode: p.hsnCode || effectiveTaxRule?.hsnCode || null,
      rewardEarned: rewardCalc.earnPoints,
      maxRedeemable: rewardCalc.maxRedeemablePoints,
      allowRedemption: rewardCalc.allowRedemption,
      allowEarning: rewardCalc.allowEarning,
      appliedRuleType: rewardCalc.appliedRuleType,
      isFeatured: Boolean(p.isFeatured),
      isTrending: Boolean(p.isTrending),
      isNewArrival: Boolean(p.isNewArrival),
      isBestSeller: Boolean(p.isBestSeller),
    };
  }

  async getProductById(productId: any) {
    const numId = Number(productId);
    if (isNaN(numId) || numId <= 0) {
      throw new AppError('Product not found', 404, true, 'NOT_FOUND');
    }
    const product = await prisma.product.findUnique({
      where: { id: numId, deletedAt: null },
      include: {
        category: {
          include: { parent: true, taxRule: true },
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

    return await this.formatProductResponse(product);
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
      where: { productId: Number(productId) },
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
      where: { productId: Number(productId), deletedAt: null },
      orderBy: { price: 'asc' },
    });

    return variants;
  }

  async getRelatedProducts(productId: any) {
    const numProductId = Number(productId);
    const product = await prisma.product.findUnique({
      where: { id: numProductId, deletedAt: null },
      select: { categoryId: true, brandId: true },
    });

    if (!product) {
      throw new AppError('Product not found', 404);
    }

    const relatedProducts = await prisma.product.findMany({
      where: {
        id: { not: numProductId },
        status: 'PUBLISHED',
        deletedAt: null,
        OR: [
          { categoryId: product.categoryId },
          { brandId: product.brandId },
        ],
      },
      include: {
        category: { include: { parent: true, taxRule: true } },
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

    return await Promise.all(
      relatedProducts.map((p) => this.formatProductResponse(p))
    );
  }
}

export default new CatalogService();
