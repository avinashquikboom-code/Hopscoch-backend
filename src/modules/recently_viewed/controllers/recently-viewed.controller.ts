import { Response } from 'express';
import { AuthRequest } from '../../../middleware/auth';
import { ResponseFormatter } from '../../../utils/responseFormatter';
import RecentlyViewedService from '../services/recently-viewed.service';

export class RecentlyViewController {
  async getRecentlyViewed(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        ResponseFormatter.error(res, 'Authentication required', 401);
        return;
      }
      const recentlyViewed = await RecentlyViewedService.getRecentlyViewed(req.user.id);
      ResponseFormatter.success(res, 'Recently viewed products retrieved successfully', recentlyViewed);
    } catch (error) {
      throw error;
    }
  }

  async recordView(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        ResponseFormatter.error(res, 'Authentication required', 401);
        return;
      }
      const { productId } = req.params;
      await RecentlyViewedService.recordView(req.user.id, productId);
      ResponseFormatter.success(res, 'Product view recorded successfully');
    } catch (error) {
      throw error;
    }
  }

  async clearRecentlyViewed(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        ResponseFormatter.error(res, 'Authentication required', 401);
        return;
      }
      await RecentlyViewedService.clearRecentlyViewed(req.user.id);
      ResponseFormatter.success(res, 'Recently viewed history cleared successfully');
    } catch (error) {
      throw error;
    }
  }
}

export default new RecentlyViewController();
