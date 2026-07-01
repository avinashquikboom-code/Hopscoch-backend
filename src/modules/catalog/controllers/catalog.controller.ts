import { Response } from 'express';
import { ZodError } from 'zod';
import { AuthRequest } from '../../../middleware/auth';
import { ResponseFormatter } from '../../../utils/responseFormatter';
import CatalogService from '../services/catalog.service';
import { listProductsSchema } from '../validators/catalog.validator';

export class CatalogController {
  async listProducts(req: AuthRequest, res: Response): Promise<void> {
    try {
      const filters = listProductsSchema.parse(req.query);
      const result = await CatalogService.listProducts(filters);
      ResponseFormatter.success(res, 'Products retrieved successfully', result);
    } catch (error) {
      if (error instanceof ZodError) {
        ResponseFormatter.error(res, 'Validation failed', 400, 'VALIDATION_ERROR', error.errors);
      } else {
        throw error;
      }
    }
  }

  async getProductById(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { productId } = req.params;
      const product = await CatalogService.getProductById(productId);
      ResponseFormatter.success(res, 'Product retrieved successfully', product);
    } catch (error) {
      throw error;
    }
  }

  async getProductImages(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { productId } = req.params;
      const images = await CatalogService.getProductImages(productId);
      ResponseFormatter.success(res, 'Product images retrieved successfully', images);
    } catch (error) {
      throw error;
    }
  }

  async getProductVariants(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { productId } = req.params;
      const variants = await CatalogService.getProductVariants(productId);
      ResponseFormatter.success(res, 'Product variants retrieved successfully', variants);
    } catch (error) {
      throw error;
    }
  }

  async getRelatedProducts(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { productId } = req.params;
      const products = await CatalogService.getRelatedProducts(productId);
      ResponseFormatter.success(res, 'Related products retrieved successfully', products);
    } catch (error) {
      throw error;
    }
  }
}

export default new CatalogController();
