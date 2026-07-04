import { Response } from 'express';
import { ZodError } from 'zod';
import { AuthRequest } from '../../../middleware/auth';
import { ResponseFormatter } from '../../../utils/responseFormatter';
import AdminService from '../services/admin.service';
import {
  createAdminUserSchema,
  updateAdminUserSchema,
  activityLogQuerySchema,
} from '../validators/admin.validator';

export class AdminController {
  async createAdminUser(req: AuthRequest, res: Response): Promise<void> {
    try {
      const validatedData = createAdminUserSchema.parse(req.body);
      const adminUser = await AdminService.createAdminUser(validatedData);
      ResponseFormatter.success(res, 'Admin user created successfully', adminUser);
    } catch (error) {
      if (error instanceof ZodError) {
        ResponseFormatter.error(res, 'Validation failed', 400, 'VALIDATION_ERROR', error.errors);
      } else {
        throw error;
      }
    }
  }

  async getAdminUsers(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { page = '1', limit = '20', role } = req.query;
      const users = await AdminService.getAdminUsers({
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        role: role as string,
      });
      ResponseFormatter.success(res, 'Admin users retrieved successfully', users);
    } catch (error) {
      throw error;
    }
  }

  async updateAdminUser(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { userId } = req.params;
      const validatedData = updateAdminUserSchema.parse(req.body);
      const user = await AdminService.updateAdminUser(userId, validatedData);
      ResponseFormatter.success(res, 'Admin user updated successfully', user);
    } catch (error) {
      if (error instanceof ZodError) {
        ResponseFormatter.error(res, 'Validation failed', 400, 'VALIDATION_ERROR', error.errors);
      } else {
        throw error;
      }
    }
  }

  async deleteAdminUser(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { userId } = req.params;
      const result = await AdminService.deleteAdminUser(userId);
      ResponseFormatter.success(res, 'Admin user deleted successfully', result);
    } catch (error) {
      throw error;
    }
  }

  async getActivityLogs(req: AuthRequest, res: Response): Promise<void> {
    try {
      const validatedQuery = activityLogQuerySchema.parse(req.query);
      const logs = await AdminService.getActivityLogs({
        page: parseInt(validatedQuery.page),
        limit: parseInt(validatedQuery.limit),
        userId: validatedQuery.userId,
        action: validatedQuery.action,
        startDate: validatedQuery.startDate,
        endDate: validatedQuery.endDate,
      });
      ResponseFormatter.success(res, 'Activity logs retrieved successfully', logs);
    } catch (error) {
      if (error instanceof ZodError) {
        ResponseFormatter.error(res, 'Validation failed', 400, 'VALIDATION_ERROR', error.errors);
      } else {
        throw error;
      }
    }
  }

  async getDashboardStats(req: AuthRequest, res: Response): Promise<void> {
    try {
      const stats = await AdminService.getDashboardStats();
      ResponseFormatter.success(res, 'Dashboard stats retrieved successfully', stats);
    } catch (error) {
      throw error;
    }
  }
}

export default new AdminController();
