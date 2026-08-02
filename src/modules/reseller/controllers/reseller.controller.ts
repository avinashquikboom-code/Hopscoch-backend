import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../../middleware/auth';
import { ResellerService } from '../services/reseller.service';

export class ResellerController {
  /**
   * POST /api/reseller/share or POST /api/mobile/reseller/share
   * Create a reseller share link with desired added margin
   */
  async createShareLink(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ success: false, message: 'Unauthorized' });
        return;
      }

      const { productId, variantId, addedMargin } = req.body;
      if (!productId) {
        res.status(400).json({ success: false, message: 'Product ID is required' });
        return;
      }

      const linkData = await ResellerService.createShareLink(
        userId,
        Number(productId),
        variantId ? Number(variantId) : undefined,
        addedMargin !== undefined ? Number(addedMargin) : 0
      );

      res.status(201).json({
        success: true,
        message: 'Reseller share link generated successfully',
        data: linkData,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/reseller/share/:shareCode or GET /api/mobile/reseller/share/:shareCode
   * Resolve a share link and get marked-up price details
   */
  async getShareLinkDetails(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { shareCode } = req.params;
      if (!shareCode) {
        res.status(400).json({ success: false, message: 'Share code is required' });
        return;
      }

      const result = await ResellerService.getShareLinkByCode(shareCode);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/reseller/my-links or GET /api/mobile/reseller/my-links
   * List all share links created by the current user with performance metrics
   */
  async getMyResellerLinks(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ success: false, message: 'Unauthorized' });
        return;
      }

      const links = await ResellerService.getMyResellerLinks(userId);
      res.status(200).json({
        success: true,
        data: links,
      });
    } catch (error) {
      next(error);
    }
  }
}
