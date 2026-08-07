import { Request, Response, NextFunction } from 'express';
import searchKeywordService from '../services/search.service';
import { ResponseFormatter } from '../../../utils/responseFormatter';

class SearchKeywordController {
  /**
   * GET /api/search/popular
   */
  public async getPopular(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const keywords = await searchKeywordService.getPopularKeywords();
      res.status(200).json(keywords);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/search/trending
   */
  public async getTrending(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const keywords = await searchKeywordService.getTrendingKeywords();
      res.status(200).json(keywords);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/search/track
   */
  public async trackKeyword(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const { keyword } = req.body;
      if (keyword) {
        await searchKeywordService.trackSearchKeyword(String(keyword));
      }
      return ResponseFormatter.success(res, 'Search tracked successfully', { tracked: true });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/admin/search-keywords
   */
  public async getAdminKeywords(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const { type, search } = req.query;
      const keywords = await searchKeywordService.getAllKeywordsAdmin(
        type ? String(type) : undefined,
        search ? String(search) : undefined
      );
      return ResponseFormatter.success(res, 'Search keywords retrieved successfully', keywords);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/admin/search-keywords
   */
  public async createKeyword(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const newKeyword = await searchKeywordService.createKeyword(req.body);
      return ResponseFormatter.success(res, 'Search keyword created successfully', newKeyword, 201);
    } catch (error: any) {
      return ResponseFormatter.error(res, error.message || 'Failed to create search keyword', 400);
    }
  }

  /**
   * PUT /api/admin/search-keywords/:id
   */
  public async updateKeyword(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return ResponseFormatter.error(res, 'Invalid keyword ID', 400);
      }
      const updated = await searchKeywordService.updateKeyword(id, req.body);
      return ResponseFormatter.success(res, 'Search keyword updated successfully', updated);
    } catch (error: any) {
      return ResponseFormatter.error(res, error.message || 'Failed to update search keyword', 400);
    }
  }

  /**
   * DELETE /api/admin/search-keywords/:id
   */
  public async deleteKeyword(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return ResponseFormatter.error(res, 'Invalid keyword ID', 400);
      }
      const result = await searchKeywordService.deleteKeyword(id);
      return ResponseFormatter.success(res, result.message, result);
    } catch (error: any) {
      return ResponseFormatter.error(res, error.message || 'Failed to delete search keyword', 400);
    }
  }

  /**
   * PATCH /api/admin/search-keywords/status
   * Body: { id: number, isActive: boolean }
   */
  public async updateStatus(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const { id, isActive } = req.body;
      const numId = parseInt(String(id), 10);
      if (isNaN(numId)) {
        return ResponseFormatter.error(res, 'Invalid keyword ID', 400);
      }
      const updated = await searchKeywordService.updateKeywordStatus(numId, Boolean(isActive));
      return ResponseFormatter.success(res, 'Keyword status updated successfully', updated);
    } catch (error: any) {
      return ResponseFormatter.error(res, error.message || 'Failed to update status', 400);
    }
  }
}

export default new SearchKeywordController();
