import { AppError } from '../../../middleware/errorHandler';
import { logger } from '../../../utils/logger';
import prisma from '../../../utils/prisma';
import geminiVisionService, { ExtractedProductAttributes } from './gemini-vision.service';

export class VisualSearchService {
  /**
   * Main entry point for visual search image upload
   */
  async processVisualSearch(
    userId: number | null,
    imageFile: { buffer: Buffer; mimetype: string; originalname?: string },
    imageUrlParam?: string
  ) {
    const startTime = Date.now();
    logger.info(`[VISUAL_SEARCH] Starting visual search. User: ${userId || 'anonymous'}`);

    try {
      // 1. Call Gemini Vision service to extract attributes
      const extractedAttributes: ExtractedProductAttributes =
        await geminiVisionService.extractFashionAttributes(
          imageFile.buffer,
          imageFile.mimetype
        );

      logger.info(`[VISUAL_SEARCH] Gemini Extracted Attributes: ${JSON.stringify(extractedAttributes)}`);

      // 2. Exact Match Query (Category + Color + Pattern + Material)
      const exactMatches = await this.findExactMatches(extractedAttributes);
      logger.info(`[VISUAL_SEARCH] Exact matches found: ${exactMatches.length}`);

      const exactMatchIds = exactMatches.map(p => p.id);

      // 3. Similar Match Query (Category + Color or Category + Style) excluding exact matches
      const similarMatches = await this.findSimilarMatches(extractedAttributes, exactMatchIds);
      logger.info(`[VISUAL_SEARCH] Similar matches found: ${similarMatches.length}`);

      // 4. Log search result in AIImageSearchLog
      const wasFallback = exactMatches.length === 0;
      const totalResults = exactMatches.length + similarMatches.length;
      const latencyMs = Date.now() - startTime;

      try {
        await prisma.aIImageSearchLog.create({
          data: {
            userId: userId || undefined,
            imageUrl: imageUrlParam || imageFile.originalname || 'uploaded_image',
            extractedCategory: extractedAttributes.category,
            extractedColor: extractedAttributes.color,
            extractedMaterial: extractedAttributes.material,
            extractedPattern: extractedAttributes.pattern,
            extractedStyle: extractedAttributes.style,
            resultCount: totalResults,
            wasFallback,
            providerLatencyMs: latencyMs,
            status: 'success',
          },
        });
      } catch (logErr) {
        logger.warn(`[VISUAL_SEARCH] Failed to log AI image search log: ${logErr}`);
      }

      return {
        extractedAttributes,
        exactMatches: (exactMatches || []).map(p => this.formatProduct(p)),
        similarMatches: (similarMatches || []).map(p => this.formatProduct(p)),
        confidence: extractedAttributes.confidence,
        wasFallback,
        latencyMs,
      };
    } catch (error: any) {
      const errorTime = Date.now() - startTime;
      logger.error(`[VISUAL_SEARCH] Search process failed after ${errorTime}ms:`, error?.message || error);

      try {
        await prisma.aIImageSearchLog.create({
          data: {
            userId: userId || undefined,
            imageUrl: imageUrlParam || 'failed_upload',
            resultCount: 0,
            status: 'failed',
            providerLatencyMs: errorTime,
          },
        });
      } catch (_) {}

      throw new AppError(error?.message || 'Visual search process failed', 500);
    }
  }

  /**
   * Find exact matches where category, color, pattern, and material match
   */
  private async findExactMatches(attrs: ExtractedProductAttributes) {
    const categoryQuery = attrs.category;
    const colorQuery = attrs.color;
    const materialQuery = attrs.material;
    const patternQuery = attrs.pattern;

    return prisma.product.findMany({
      where: {
        status: 'PUBLISHED',
        deletedAt: null,
        AND: [
          // Category match
          {
            OR: [
              { category: { name: { contains: categoryQuery, mode: 'insensitive' } } },
              { category: { slug: { contains: categoryQuery.toLowerCase(), mode: 'insensitive' } } },
              { name: { contains: categoryQuery, mode: 'insensitive' } },
              { description: { contains: categoryQuery, mode: 'insensitive' } },
            ],
          },
          // Color match
          {
            OR: [
              { variants: { some: { color: { contains: colorQuery, mode: 'insensitive' } } } },
              { name: { contains: colorQuery, mode: 'insensitive' } },
              { description: { contains: colorQuery, mode: 'insensitive' } },
            ],
          },
          // Material match
          {
            OR: [
              { variants: { some: { material: { contains: materialQuery, mode: 'insensitive' } } } },
              { description: { contains: materialQuery, mode: 'insensitive' } },
              { name: { contains: materialQuery, mode: 'insensitive' } },
            ],
          },
          // Pattern match
          {
            OR: [
              { variants: { some: { pattern: { contains: patternQuery, mode: 'insensitive' } } } },
              { description: { contains: patternQuery, mode: 'insensitive' } },
              { name: { contains: patternQuery, mode: 'insensitive' } },
            ],
          },
        ],
      },
      take: 10,
      include: {
        images: {
          orderBy: { sortOrder: 'asc' },
          take: 2,
        },
        category: true,
        brand: true,
        variants: true,
      },
    });
  }

  /**
   * Find similar matches with relaxed matching criteria (category + color or category + style)
   */
  private async findSimilarMatches(attrs: ExtractedProductAttributes, excludeIds: number[]) {
    const categoryQuery = attrs.category;
    const colorQuery = attrs.color;
    const styleQuery = attrs.style;

    return prisma.product.findMany({
      where: {
        status: 'PUBLISHED',
        deletedAt: null,
        id: { notIn: excludeIds },
        AND: [
          // Category match OR Style match
          {
            OR: [
              { category: { name: { contains: categoryQuery, mode: 'insensitive' } } },
              { name: { contains: categoryQuery, mode: 'insensitive' } },
              { description: { contains: categoryQuery, mode: 'insensitive' } },
              { description: { contains: styleQuery, mode: 'insensitive' } },
            ],
          },
          // Color match OR Style match
          {
            OR: [
              { variants: { some: { color: { contains: colorQuery, mode: 'insensitive' } } } },
              { name: { contains: colorQuery, mode: 'insensitive' } },
              { description: { contains: colorQuery, mode: 'insensitive' } },
              { description: { contains: styleQuery, mode: 'insensitive' } },
              { name: { contains: styleQuery, mode: 'insensitive' } },
            ],
          },
        ],
      },
      take: 12,
      include: {
        images: {
          orderBy: { sortOrder: 'asc' },
          take: 2,
        },
        category: true,
        brand: true,
        variants: true,
      },
    });
  }

  async getQueryHistory(userId: number) {
    return prisma.aIImageSearchLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });
  }

  async deleteQuery(userId: number, queryId: number) {
    const query = await prisma.aIImageSearchLog.findUnique({
      where: { id: queryId },
    });

    if (!query) {
      throw new AppError('Query log not found', 404);
    }
    if (query.userId !== userId) {
      throw new AppError('Unauthorized', 403);
    }

    await prisma.aIImageSearchLog.delete({
      where: { id: queryId },
    });
  }

  private formatProduct(p: any) {
    const rawImages = p.images || [];
    const imageUrls = rawImages.map((img: any) => typeof img === 'string' ? img : (img.url || img.imageUrl)).filter(Boolean);
    if (p.thumbnailUrl && !imageUrls.includes(p.thumbnailUrl)) {
      imageUrls.unshift(p.thumbnailUrl);
    }
    if (imageUrls.length === 0 && p.imageUrl) {
      imageUrls.push(p.imageUrl);
    }
    return {
      id: String(p.id),
      name: p.name || 'Product',
      title: p.name || 'Product',
      description: p.description || '',
      price: Number(p.basePrice || p.price || 0),
      originalPrice: p.compareAtPrice ? Number(p.compareAtPrice) : (p.originalPrice ? Number(p.originalPrice) : undefined),
      category: typeof p.category === 'string' ? p.category : (p.category?.name || p.category?.slug || 'clothing'),
      brand: typeof p.brand === 'string' ? p.brand : (p.brand?.name || 'Hopscotch'),
      images: imageUrls,
      imageUrl: imageUrls[0] || p.thumbnailUrl || null,
      rating: p.rating || 4.5,
      reviewCount: p.reviewCount || 12,
      isNew: p.isNew || false,
      isTrending: p.isTrending || false,
      isFeatured: p.isFeatured || false,
      stock: p.stock ?? 10,
    };
  }
}

export default new VisualSearchService();
