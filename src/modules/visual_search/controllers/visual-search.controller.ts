import { Response } from 'express';
import { AuthRequest } from '../../../middleware/auth';
import { ResponseFormatter } from '../../../utils/responseFormatter';
import VisualSearchService from '../services/visual-search.service';
import { logger } from '../../../utils/logger';

export class VisualSearchController {
  /**
   * Primary Visual Search Endpoint: POST /api/v1/mobile/search/visual
   * Accepts multipart file upload (req.file) or base64 / imageUrl in body.
   */
  async searchVisual(req: AuthRequest, res: Response): Promise<void> {
    try {
      let imageBuffer: Buffer | null = null;
      let mimetype = 'image/jpeg';
      let originalname = 'search_image.jpg';

      if (req.file) {
        imageBuffer = req.file.buffer;
        mimetype = req.file.mimetype || 'image/jpeg';
        originalname = req.file.originalname || 'search_image.jpg';
      } else if (req.body?.imageUrl) {
        const rawUrl = String(req.body.imageUrl);
        if (rawUrl.startsWith('data:image')) {
          const parts = rawUrl.split(';base64,');
          const mimeMatch = rawUrl.match(/data:(image\/[a-zA-Z+]+);/);
          if (mimeMatch) mimetype = mimeMatch[1];
          imageBuffer = Buffer.from(parts[1], 'base64');
        }
      }

      if (!imageBuffer || imageBuffer.length === 0) {
        ResponseFormatter.error(res, 'No valid image file uploaded', 400);
        return;
      }

      // Max size check: 5MB
      if (imageBuffer.length > 5 * 1024 * 1024) {
        ResponseFormatter.error(res, 'Image file exceeds maximum allowed size of 5MB', 400);
        return;
      }

      const userId = req.user?.id || null;
      const result = await VisualSearchService.processVisualSearch(
        userId,
        { buffer: imageBuffer, mimetype, originalname },
        req.body?.imageUrl
      );

      ResponseFormatter.success(res, 'Visual search completed successfully', result);
    } catch (error: any) {
      logger.error('[VISUAL_SEARCH_CONTROLLER] Error during visual search:', error);
      ResponseFormatter.error(res, error?.message || 'Visual search failed', 500);
    }
  }

  async getHistory(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        ResponseFormatter.error(res, 'Authentication required', 401);
        return;
      }
      const history = await VisualSearchService.getQueryHistory(userId);
      ResponseFormatter.success(res, 'Visual search history retrieved successfully', history);
    } catch (error: any) {
      ResponseFormatter.error(res, error?.message || 'Failed to fetch history', 500);
    }
  }

  async deleteQuery(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        ResponseFormatter.error(res, 'Authentication required', 401);
        return;
      }
      const queryId = Number(req.params.queryId);
      if (isNaN(queryId)) {
        ResponseFormatter.error(res, 'Invalid query ID', 400);
        return;
      }
      await VisualSearchService.deleteQuery(userId, queryId);
      ResponseFormatter.success(res, 'Visual search log entry deleted successfully');
    } catch (error: any) {
      ResponseFormatter.error(res, error?.message || 'Failed to delete query log', 500);
    }
  }
}

export default new VisualSearchController();
