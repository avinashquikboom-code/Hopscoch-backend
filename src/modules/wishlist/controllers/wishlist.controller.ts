import { Response } from 'express';
import { AuthRequest } from '../../../middleware/auth';
import { ResponseFormatter } from '../../../utils/responseFormatter';
import WishlistService from '../services/wishlist.service';

export class WishlistController {
  async getWishlist(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        ResponseFormatter.error(res, 'Authentication required', 401);
        return;
      }
      const wishlist = await WishlistService.getWishlist(req.user.id);
      ResponseFormatter.success(res, 'Wishlist retrieved successfully', wishlist);
    } catch (error) {
      throw error;
    }
  }

  async addToWishlist(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        ResponseFormatter.error(res, 'Authentication required', 401);
        return;
      }
      const { productId } = req.params;
      const { variantId } = req.body;
      const result = await WishlistService.addToWishlist(req.user.id, productId, variantId);
      ResponseFormatter.success(res, 'Product added to wishlist successfully', result);
    } catch (error) {
      throw error;
    }
  }

  async removeFromWishlist(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        ResponseFormatter.error(res, 'Authentication required', 401);
        return;
      }
      const { productId } = req.params;
      await WishlistService.removeFromWishlist(req.user.id, productId);
      ResponseFormatter.success(res, 'Product removed from wishlist successfully');
    } catch (error) {
      throw error;
    }
  }

  async getWishlistStatus(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        ResponseFormatter.error(res, 'Authentication required', 401);
        return;
      }
      const { productId } = req.params;
      const status = await WishlistService.getWishlistStatus(req.user.id, productId);
      ResponseFormatter.success(res, 'Wishlist status retrieved successfully', status);
    } catch (error) {
      throw error;
    }
  }
}

export default new WishlistController();
