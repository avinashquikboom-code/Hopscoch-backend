import { Response } from 'express';
import { ZodError } from 'zod';
import { AuthRequest } from '../../../middleware/auth';
import { ResponseFormatter } from '../../../utils/responseFormatter';
import CartService from '../services/cart.service';
import { addToCartSchema, updateCartItemSchema } from '../validators/cart.validator';

export class CartController {
  async getCart(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        ResponseFormatter.error(res, 'Authentication required', 401);
        return;
      }
      const cart = await CartService.getCart(req.user.id);
      ResponseFormatter.success(res, 'Cart retrieved successfully', cart);
    } catch (error) {
      throw error;
    }
  }

  async addToCart(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        ResponseFormatter.error(res, 'Authentication required', 401);
        return;
      }
      const validatedData = addToCartSchema.parse(req.body);
      const result = await CartService.addToCart(req.user.id, validatedData);
      ResponseFormatter.success(res, 'Product added to cart successfully', result);
    } catch (error) {
      if (error instanceof ZodError) {
        ResponseFormatter.error(res, 'Validation failed', 400, 'VALIDATION_ERROR', error.errors);
      } else {
        throw error;
      }
    }
  }

  async updateCartItem(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        ResponseFormatter.error(res, 'Authentication required', 401);
        return;
      }
      const { cartItemId } = req.params;
      const validatedData = updateCartItemSchema.parse(req.body);
      const result = await CartService.updateCartItem(req.user.id, cartItemId, validatedData);
      ResponseFormatter.success(res, 'Cart item updated successfully', result);
    } catch (error) {
      if (error instanceof ZodError) {
        ResponseFormatter.error(res, 'Validation failed', 400, 'VALIDATION_ERROR', error.errors);
      } else {
        throw error;
      }
    }
  }

  async removeFromCart(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        ResponseFormatter.error(res, 'Authentication required', 401);
        return;
      }
      const { cartItemId } = req.params;
      await CartService.removeFromCart(req.user.id, cartItemId);
      ResponseFormatter.success(res, 'Cart item removed successfully');
    } catch (error) {
      throw error;
    }
  }

  async clearCart(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        ResponseFormatter.error(res, 'Authentication required', 401);
        return;
      }
      await CartService.clearCart(req.user.id);
      ResponseFormatter.success(res, 'Cart cleared successfully');
    } catch (error) {
      throw error;
    }
  }
}

export default new CartController();
