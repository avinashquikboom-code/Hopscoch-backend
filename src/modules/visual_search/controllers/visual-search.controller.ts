import { Response } from 'express';
import { ZodError } from 'zod';
import { AuthRequest } from '../../../middleware/auth';
import { ResponseFormatter } from '../../../utils/responseFormatter';
import VisualSearchService from '../services/visual-search.service';
import { uploadImageSchema } from '../validators/visual-search.validator';

export class VisualSearchController {
  async search(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        ResponseFormatter.error(res, 'Authentication required', 401);
        return;
      }
      const validatedData = uploadImageSchema.parse(req.body);
      const result = await VisualSearchService.search(req.user.id, validatedData);
      ResponseFormatter.success(res, 'Visual search completed successfully', result);
    } catch (error) {
      if (error instanceof ZodError) {
        ResponseFormatter.error(res, 'Validation failed', 400, 'VALIDATION_ERROR', error.errors);
      } else {
        throw error;
      }
    }
  }

  async getQuery(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { queryId } = req.params;
      const result = await VisualSearchService.getQuery(queryId);
      ResponseFormatter.success(res, 'Visual search query retrieved successfully', result);
    } catch (error) {
      throw error;
    }
  }

  async getHistory(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        ResponseFormatter.error(res, 'Authentication required', 401);
        return;
      }
      const history = await VisualSearchService.getHistory(req.user.id);
      ResponseFormatter.success(res, 'Visual search history retrieved successfully', history);
    } catch (error) {
      throw error;
    }
  }

  async deleteQuery(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        ResponseFormatter.error(res, 'Authentication required', 401);
        return;
      }
      const { queryId } = req.params;
      await VisualSearchService.deleteQuery(req.user.id, queryId);
      ResponseFormatter.success(res, 'Visual search query deleted successfully');
    } catch (error) {
      throw error;
    }
  }
}

export default new VisualSearchController();
