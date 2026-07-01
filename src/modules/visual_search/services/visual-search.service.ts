import { AppError } from '../../../middleware/errorHandler';
import { logger } from '../../../utils/logger';
import prisma from '../../../utils/prisma';
import GeminiService from './gemini.service';

export class VisualSearchService {
  async search(userId: string, data: { imageUrl: string }) {
    const { imageUrl } = data;
    const startTime = Date.now();

    logger.info(`[VISUAL_SEARCH] User ${userId} initiated visual search`);
    logger.info(`[VISUAL_SEARCH] Image URL length: ${imageUrl.length} characters`);

    try {
      // Analyze image using Gemini AI
      logger.info('[VISUAL_SEARCH] Starting Gemini image analysis...');
      const analysisStartTime = Date.now();
      const extractedData = await GeminiService.analyzeImage(imageUrl);
      const analysisTime = Date.now() - analysisStartTime;
      logger.info(`[VISUAL_SEARCH] Gemini analysis completed in ${analysisTime}ms`);
      logger.info(`[VISUAL_SEARCH] Extracted data: ${JSON.stringify(extractedData)}`);

      // Search for matching products using Gemini
      logger.info('[VISUAL_SEARCH] Starting product matching...');
      const searchStartTime = Date.now();
      const searchResult = await GeminiService.searchProducts(extractedData);
      const searchTime = Date.now() - searchStartTime;
      logger.info(`[VISUAL_SEARCH] Product matching completed in ${searchTime}ms`);
      logger.info(`[VISUAL_SEARCH] Match confidence: ${searchResult.confidence}`);
      logger.info(`[VISUAL_SEARCH] Matched product IDs: ${searchResult.matchedProductIds.join(', ')}`);

      // Fetch matched products from database
      logger.info('[VISUAL_SEARCH] Fetching product details from database...');
      const dbStartTime = Date.now();
      const matchedProducts = await prisma.product.findMany({
        where: {
          id: { in: searchResult.matchedProductIds },
          status: 'PUBLISHED',
          deletedAt: null,
        },
        include: {
          images: {
            where: { sortOrder: 0 },
            take: 1,
          },
          category: true,
          brand: true,
        },
      });
      const dbTime = Date.now() - dbStartTime;
      logger.info(`[VISUAL_SEARCH] Database query completed in ${dbTime}ms, found ${matchedProducts.length} products`);

      // Fetch similar product suggestions based on category and style
      let similarSuggestions: any[] = [];
      if (extractedData.extractedCategory || extractedData.extractedStyle) {
        logger.info('[VISUAL_SEARCH] Fetching similar product suggestions...');
        logger.info(`[VISUAL_SEARCH] Category: ${extractedData.extractedCategory}, Style: ${extractedData.extractedStyle}`);
        
        const similarStartTime = Date.now();
        const whereClause: any = {
          status: 'PUBLISHED',
          deletedAt: null,
          id: { notIn: searchResult.matchedProductIds },
        };

        if (extractedData.extractedCategory) {
          whereClause.categoryId = {
            in: await prisma.category
            .findMany({
              where: {
                name: {
                  contains: extractedData.extractedCategory,
                  mode: 'insensitive',
                },
              },
            })
            .then((cats: any[]) => cats.map((c: any) => c.id)),
          };
        }

        similarSuggestions = await prisma.product.findMany({
          where: whereClause,
          take: 8,
          include: {
            images: {
              where: { sortOrder: 0 },
              take: 1,
            },
            category: true,
            brand: true,
          },
        });
        const similarTime = Date.now() - similarStartTime;
        logger.info(`[VISUAL_SEARCH] Similar suggestions fetched in ${similarTime}ms, found ${similarSuggestions.length} products`);
      } else {
        logger.info('[VISUAL_SEARCH] No category/style data for similar suggestions');
      }

      // Create visual search query log
      const query = await prisma.aIImageSearchLog.create({
        data: {
          userId,
          imageUrl,
          resultCount: matchedProducts.length,
          status: 'success',
          providerLatencyMs: Date.now() - startTime,
          extractedCategory: extractedData.extractedCategory,
          extractedColor: extractedData.extractedColor,
          extractedMaterial: extractedData.extractedMaterial,
          extractedPattern: extractedData.extractedPattern,
          extractedBrand: extractedData.extractedBrand,
          extractedStyle: extractedData.extractedStyle,
          extractedGender: extractedData.extractedGender ? (extractedData.extractedGender.toUpperCase() as any) : undefined,
          extractedAgeGroup: extractedData.extractedAgeGroup ? (extractedData.extractedAgeGroup.toUpperCase() as any) : undefined,
        },
      });

      const totalTime = Date.now() - startTime;
      logger.info(`[VISUAL_SEARCH] Total search completed in ${totalTime}ms`);
      logger.info(`[VISUAL_SEARCH] Query ID: ${query.id}`);
      logger.info(`[VISUAL_SEARCH] User ${userId} search successful - ${matchedProducts.length} matches, ${similarSuggestions.length} similar suggestions`);

      return {
        queryId: query.id,
        imageUrl,
        status: 'success',
        confidence: searchResult.confidence,
        extractedData,
        matches: matchedProducts,
        similarSuggestions,
      };
    } catch (error) {
      const errorTime = Date.now() - startTime;
      logger.error(`[VISUAL_SEARCH] Search failed after ${errorTime}ms for user ${userId}`);
      logger.error(`[VISUAL_SEARCH] Error details: ${error}`);
      
      // Log failed attempt
      await prisma.aIImageSearchLog.create({
        data: {
          userId,
          imageUrl,
          resultCount: 0,
          status: 'failed',
          providerLatencyMs: errorTime,
        },
      });

      throw error;
    }
  }

  async getQuery(queryId: string) {
    logger.info(`[VISUAL_SEARCH] Fetching query details for queryId: ${queryId}`);
    
    const query = await prisma.aIImageSearchLog.findUnique({
      where: { id: queryId },
    });

    if (!query) {
      logger.warn(`[VISUAL_SEARCH] Query not found: ${queryId}`);
      throw new AppError('Visual search query not found', 404);
    }

    logger.info(`[VISUAL_SEARCH] Query retrieved successfully: ${queryId}`);
    return query;
  }

  async getHistory(userId: string) {
    logger.info(`[VISUAL_SEARCH] Fetching search history for user: ${userId}`);
    
    const history = await prisma.aIImageSearchLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    logger.info(`[VISUAL_SEARCH] Retrieved ${history.length} history records for user: ${userId}`);
    return history;
  }

  async deleteQuery(userId: string, queryId: string): Promise<void> {
    logger.info(`[VISUAL_SEARCH] Attempting to delete query ${queryId} by user ${userId}`);
    
    const query = await prisma.aIImageSearchLog.findUnique({
      where: { id: queryId },
    });

    if (!query) {
      logger.warn(`[VISUAL_SEARCH] Delete failed - query not found: ${queryId}`);
      throw new AppError('Visual search query not found', 404);
    }

    if (query.userId !== userId) {
      logger.warn(`[VISUAL_SEARCH] Delete failed - unauthorized: user ${userId} tried to delete query owned by ${query.userId}`);
      throw new AppError('Unauthorized to delete this query', 403);
    }

    await prisma.aIImageSearchLog.delete({
      where: { id: queryId },
    });

    logger.info(`[VISUAL_SEARCH] Query deleted successfully: ${queryId} by user ${userId}`);
  }
}

export default new VisualSearchService();
