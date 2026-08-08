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
      const related = await CatalogService.getRelatedProducts(productId);
      ResponseFormatter.success(res, 'Related products retrieved successfully', related);
    } catch (error) {
      throw error;
    }
  }

  async getFeaturedProducts(req: AuthRequest, res: Response): Promise<void> {
    try {
      const limit = req.query.limit ? Number(req.query.limit) : 20;
      const result = await CatalogService.listProducts({ isFeatured: true, limit });
      ResponseFormatter.success(res, 'Featured products retrieved successfully', result.products);
    } catch (error) {
      throw error;
    }
  }

  async getTrendingProducts(req: AuthRequest, res: Response): Promise<void> {
    try {
      const limit = req.query.limit ? Number(req.query.limit) : 20;
      const result = await CatalogService.listProducts({ isTrending: true, limit });
      ResponseFormatter.success(res, 'Trending products retrieved successfully', result.products);
    } catch (error) {
      throw error;
    }
  }

  async getNewArrivals(req: AuthRequest, res: Response): Promise<void> {
    try {
      const limit = req.query.limit ? Number(req.query.limit) : 20;
      const result = await CatalogService.listProducts({ isNewArrival: true, sort: 'newest', limit });
      ResponseFormatter.success(res, 'New arrivals retrieved successfully', result.products);
    } catch (error) {
      throw error;
    }
  }

  async searchProducts(req: AuthRequest, res: Response): Promise<void> {
    try {
      const q = (req.query.q || req.query.query || req.query.search || '').toString();
      const limit = req.query.limit ? Number(req.query.limit) : 50;
      const page = req.query.page ? Number(req.query.page) : 1;
      const result = await CatalogService.listProducts({ search: q, limit, page });
      ResponseFormatter.success(res, 'Search results retrieved successfully', result);
    } catch (error) {
      throw error;
    }
  }

  async getProductsByCategory(req: AuthRequest, res: Response): Promise<void> {
    try {
      const categoryId = req.params.categoryId || req.params.id;
      const limit = req.query.limit ? Number(req.query.limit) : 100;
      const page = req.query.page ? Number(req.query.page) : 1;
      const result = await CatalogService.listProducts({ categoryId, limit, page });
      ResponseFormatter.success(res, 'Category products retrieved successfully', result);
    } catch (error) {
      throw error;
    }
  }
}

export default new CatalogController();
