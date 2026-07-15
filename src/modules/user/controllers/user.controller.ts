import { Response } from 'express';
import { ZodError } from 'zod';
import { AuthRequest } from '../../../middleware/auth';
import { ResponseFormatter } from '../../../utils/responseFormatter';
import UserService from '../services/user.service';
import { updateUserProfileSchema } from '../validators/user.validator';

export class UserController {
  async getUserProfile(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { userId } = req.params;
      const user = await UserService.getUserProfile(userId);
      ResponseFormatter.success(res, 'User profile retrieved successfully', user);
    } catch (error) {
      throw error;
    }
  }

  async updateCurrentUser(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        ResponseFormatter.error(res, 'Authentication required', 401);
        return;
      }
      
      if (req.file) {
        req.body.avatarUrl = `/uploads/${req.file.filename}`;
      }
      
      const validatedData = updateUserProfileSchema.parse(req.body);
      const user = await UserService.updateCurrentUser(req.user.id, validatedData);
      ResponseFormatter.success(res, 'Profile updated successfully', user);
    } catch (error) {
      if (error instanceof ZodError) {
        ResponseFormatter.error(res, 'Validation failed', 400, 'VALIDATION_ERROR', error.errors);
      } else {
        throw error;
      }
    }
  }

  async deleteCurrentUser(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        ResponseFormatter.error(res, 'Authentication required', 401);
        return;
      }
      await UserService.deleteCurrentUser(req.user.id);
      ResponseFormatter.success(res, 'Account deleted successfully');
    } catch (error) {
      throw error;
    }
  }
}

export default new UserController();
