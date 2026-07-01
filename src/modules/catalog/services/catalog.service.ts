import { AppError } from '../../../middleware/errorHandler';
import prisma from '../../../utils/prisma';

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
      limit = 20,
      sort = 'createdAt',
    } = filters;

    const skip = (page - 1) * limit;

    const where: any = {
      status: 'PUBLISHED',
      deletedAt: null,
    };

    if (categoryId) where.categoryId = categoryId;
    if (brandId) where.brandId = brandId;
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

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        include: {
          category: true,
          brand: true,
          images: {
            where: { sortOrder: 0 },
            take: 1,
          },
        },
        orderBy,
        skip,
        take: limit,
      }),
      prisma.product.count({ where }),
    ]);

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

  async getProductById(productId: string) {
    const product = await prisma.product.findUnique({
      where: { id: productId, deletedAt: null },
      include: {
        category: true,
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

    return product;
  }

  async getProductImages(productId: string) {
    const product = await prisma.product.findUnique({
      where: { id: productId, deletedAt: null },
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

  async getProductVariants(productId: string) {
    const product = await prisma.product.findUnique({
      where: { id: productId, deletedAt: null },
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

  async getRelatedProducts(productId: string) {
    const product = await prisma.product.findUnique({
      where: { id: productId, deletedAt: null },
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
      },
      take: 8,
    });

    return relatedProducts;
  }
}

export default new CatalogService();
