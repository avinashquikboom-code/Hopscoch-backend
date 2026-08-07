import prisma from '../../../utils/prisma';
import { SearchKeywordType } from '@prisma/client';

export interface CreateSearchKeywordDto {
  keyword: string;
  type: 'POPULAR' | 'TRENDING';
  priority?: number;
  isActive?: boolean;
}

export interface UpdateSearchKeywordDto {
  keyword?: string;
  type?: 'POPULAR' | 'TRENDING';
  priority?: number;
  isActive?: boolean;
}

class SearchKeywordService {
  private popularCache: { id: number; keyword: string }[] | null = null;
  private trendingCache: { id: number; keyword: string }[] | null = null;
  private cacheTimestamp: number = 0;
  private CACHE_TTL_MS = 60 * 1000; // 1 minute TTL with instant invalidation on mutations

  public invalidateCache(): void {
    this.popularCache = null;
    this.trendingCache = null;
    this.cacheTimestamp = 0;
  }

  /**
   * Seed default search keywords if table is empty
   */
  public async ensureSeedKeywords(): Promise<void> {
    try {
      const count = await prisma.searchKeyword.count();
      if (count === 0) {
        const defaultPopular = [
          'Lehenga Choli',
          'Anarkali Suit',
          'Silk Saree',
          'Couture Dress',
          'Designer Kurti',
        ];
        const defaultTrending = [
          'Winter Jackets',
          'Pashmina Shawl',
          'Velvet Suits',
          'Wedding Wear',
        ];

        for (let i = 0; i < defaultPopular.length; i++) {
          await prisma.searchKeyword.create({
            data: {
              keyword: defaultPopular[i],
              type: SearchKeywordType.POPULAR,
              priority: i + 1,
              isActive: true,
              searchCount: 10 - i,
            },
          });
        }

        for (let i = 0; i < defaultTrending.length; i++) {
          await prisma.searchKeyword.create({
            data: {
              keyword: defaultTrending[i],
              type: SearchKeywordType.TRENDING,
              priority: i + 1,
              isActive: true,
              searchCount: 10 - i,
            },
          });
        }
      }
    } catch (error) {
      // Non-blocking log if already seeded or during concurrent init
    }
  }

  /**
   * Public: Get Popular Search Keywords
   * Sorted by priority ASC, searchCount DESC
   */
  public async getPopularKeywords(): Promise<{ id: number; keyword: string }[]> {
    const now = Date.now();
    if (this.popularCache && now - this.cacheTimestamp < this.CACHE_TTL_MS) {
      return this.popularCache;
    }

    await this.ensureSeedKeywords();

    const keywords = await prisma.searchKeyword.findMany({
      where: {
        type: SearchKeywordType.POPULAR,
        isActive: true,
      },
      orderBy: [
        { priority: 'asc' },
        { searchCount: 'desc' },
      ],
      select: {
        id: true,
        keyword: true,
      },
    });

    this.popularCache = keywords;
    this.cacheTimestamp = Date.now();
    return keywords;
  }

  /**
   * Public: Get Trending Search Keywords
   * Sorted by priority ASC, searchCount DESC
   */
  public async getTrendingKeywords(): Promise<{ id: number; keyword: string }[]> {
    const now = Date.now();
    if (this.trendingCache && now - this.cacheTimestamp < this.CACHE_TTL_MS) {
      return this.trendingCache;
    }

    await this.ensureSeedKeywords();

    const keywords = await prisma.searchKeyword.findMany({
      where: {
        type: SearchKeywordType.TRENDING,
        isActive: true,
      },
      orderBy: [
        { priority: 'asc' },
        { searchCount: 'desc' },
      ],
      select: {
        id: true,
        keyword: true,
      },
    });

    this.trendingCache = keywords;
    this.cacheTimestamp = Date.now();
    return keywords;
  }

  /**
   * Public Search Analytics: Track Keyword Usage
   * Body { "keyword": "Silk Saree" }
   */
  public async trackSearchKeyword(keyword: string): Promise<void> {
    if (!keyword || !keyword.trim()) return;
    const cleanKeyword = keyword.trim();

    try {
      // Find matching keyword case-insensitively
      const existing = await prisma.searchKeyword.findFirst({
        where: {
          keyword: {
            equals: cleanKeyword,
            mode: 'insensitive',
          },
        },
      });

      if (existing) {
        await prisma.searchKeyword.update({
          where: { id: existing.id },
          data: {
            searchCount: { increment: 1 },
          },
        });
        this.invalidateCache();
      }
    } catch (error) {
      // Silent error handling for search tracking
    }
  }

  /**
   * Admin: Get all search keywords
   */
  public async getAllKeywordsAdmin(type?: string, search?: string) {
    await this.ensureSeedKeywords();

    const where: any = {};
    if (type && (type === 'POPULAR' || type === 'TRENDING')) {
      where.type = type as SearchKeywordType;
    }
    if (search && search.trim()) {
      where.keyword = {
        contains: search.trim(),
        mode: 'insensitive',
      };
    }

    const keywords = await prisma.searchKeyword.findMany({
      where,
      orderBy: [
        { priority: 'asc' },
        { searchCount: 'desc' },
      ],
    });

    return keywords;
  }

  /**
   * Admin: Add new keyword
   */
  public async createKeyword(dto: CreateSearchKeywordDto) {
    if (!dto.keyword || !dto.keyword.trim()) {
      throw new Error('Keyword is required');
    }
    const cleanKeyword = dto.keyword.trim();

    const existing = await prisma.searchKeyword.findFirst({
      where: {
        keyword: {
          equals: cleanKeyword,
          mode: 'insensitive',
        },
      },
    });

    if (existing) {
      throw new Error(`Keyword "${cleanKeyword}" already exists`);
    }

    const newKeyword = await prisma.searchKeyword.create({
      data: {
        keyword: cleanKeyword,
        type: dto.type === 'TRENDING' ? SearchKeywordType.TRENDING : SearchKeywordType.POPULAR,
        priority: dto.priority !== undefined ? Number(dto.priority) : 0,
        isActive: dto.isActive !== undefined ? Boolean(dto.isActive) : true,
      },
    });

    this.invalidateCache();
    return newKeyword;
  }

  /**
   * Admin: Edit keyword
   */
  public async updateKeyword(id: number, dto: UpdateSearchKeywordDto) {
    const existing = await prisma.searchKeyword.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new Error('Search keyword not found');
    }

    const dataToUpdate: any = {};
    if (dto.keyword !== undefined && dto.keyword.trim()) {
      const cleanKeyword = dto.keyword.trim();
      const duplicate = await prisma.searchKeyword.findFirst({
        where: {
          keyword: {
            equals: cleanKeyword,
            mode: 'insensitive',
          },
          id: { not: id },
        },
      });
      if (duplicate) {
        throw new Error(`Keyword "${cleanKeyword}" already exists`);
      }
      dataToUpdate.keyword = cleanKeyword;
    }

    if (dto.type !== undefined) {
      dataToUpdate.type = dto.type === 'TRENDING' ? SearchKeywordType.TRENDING : SearchKeywordType.POPULAR;
    }
    if (dto.priority !== undefined) {
      dataToUpdate.priority = Number(dto.priority);
    }
    if (dto.isActive !== undefined) {
      dataToUpdate.isActive = Boolean(dto.isActive);
    }

    const updated = await prisma.searchKeyword.update({
      where: { id },
      data: dataToUpdate,
    });

    this.invalidateCache();
    return updated;
  }

  /**
   * Admin: Delete keyword
   */
  public async deleteKeyword(id: number) {
    const existing = await prisma.searchKeyword.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new Error('Search keyword not found');
    }

    await prisma.searchKeyword.delete({
      where: { id },
    });

    this.invalidateCache();
    return { success: true, message: 'Keyword deleted successfully' };
  }

  /**
   * Admin: Toggle Active/Inactive Status
   */
  public async updateKeywordStatus(id: number, isActive: boolean) {
    const existing = await prisma.searchKeyword.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new Error('Search keyword not found');
    }

    const updated = await prisma.searchKeyword.update({
      where: { id },
      data: { isActive: Boolean(isActive) },
    });

    this.invalidateCache();
    return updated;
  }
}

export default new SearchKeywordService();
