import { Response } from 'express';
import { AuthRequest } from '../../../middleware/auth';
import { ResponseFormatter } from '../../../utils/responseFormatter';
import CategoryService from '../services/category.service';

export class CategoryController {
  async listCategories(_req: AuthRequest, res: Response): Promise<void> {
    try {
      const categories = await CategoryService.listCategories();
      ResponseFormatter.success(res, 'Categories retrieved successfully', categories);
    } catch (error) {
      throw error;
    }
  }
}

export default new CategoryController();
