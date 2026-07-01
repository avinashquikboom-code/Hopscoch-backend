import { Response } from 'express';
import { AuthRequest } from '../../../middleware/auth';
import { ResponseFormatter } from '../../../utils/responseFormatter';
import BrandService from '../services/brand.service';

export class BrandController {
  async listBrands(_req: AuthRequest, res: Response): Promise<void> {
    try {
      const brands = await BrandService.listBrands();
      ResponseFormatter.success(res, 'Brands retrieved successfully', brands);
    } catch (error) {
      throw error;
    }
  }

  async getBrandById(_req: AuthRequest, res: Response): Promise<void> {
    try {
      const { brandId } = _req.params;
      const brand = await BrandService.getBrandById(brandId);
      ResponseFormatter.success(res, 'Brand retrieved successfully', brand);
    } catch (error) {
      throw error;
    }
  }
}

export default new BrandController();
