import { Response } from 'express';
import { ZodError } from 'zod';
import { AuthRequest } from '../../../middleware/auth';
import { ResponseFormatter } from '../../../utils/responseFormatter';
import { AppError } from '../../../middleware/errorHandler';
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
      ResponseFormatter.success(res, `Admin user ${adminUser.email} created successfully with ${validatedData.role} role`, adminUser);
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
      ResponseFormatter.success(res, `Retrieved ${users.users.length} admin users (page ${page} of ${users.pagination.totalPages})`, users);
    } catch (error) {
      throw error;
    }
  }

  async updateAdminUser(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { userId } = req.params;
      const validatedData = updateAdminUserSchema.parse(req.body);
      const user = await AdminService.updateAdminUser(userId, validatedData);
      ResponseFormatter.success(res, `Admin user ${user.email} updated successfully`, user);
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
      ResponseFormatter.success(res, `Admin user ${userId} deleted successfully`, result);
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
      ResponseFormatter.success(res, `Retrieved ${logs.events.length} activity logs (page ${validatedQuery.page} of ${logs.pagination.totalPages})`, logs);
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
      ResponseFormatter.success(res, `Dashboard stats retrieved: ${stats.stats.totalUsers} users, ${stats.stats.totalOrders} orders, ${stats.stats.totalRevenue} revenue`, stats);
    } catch (error) {
      throw error;
    }
  }

  async getAdminProfile(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError('User not authenticated', 401);
      }
      const profile = await AdminService.getAdminProfile(req.user.id);
      ResponseFormatter.success(res, `Admin profile retrieved for ${profile.email}`, profile);
    } catch (error) {
      throw error;
    }
  }

  async updateAdminProfile(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError('User not authenticated', 401);
      }
      const { firstName, lastName, email, phone, avatarUrl } = req.body;
      const profile = await AdminService.updateAdminProfile(req.user.id, {
        firstName,
        lastName,
        email,
        phone,
        avatarUrl,
      });
      ResponseFormatter.success(res, `Admin profile updated for ${profile.email}`, profile);
    } catch (error) {
      throw error;
    }
  }

  async logoutAdmin(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError('User not authenticated', 401);
      }
      const result = await AdminService.logoutAdmin(req.user.id);
      ResponseFormatter.success(res, `Admin user ${req.user.email} logged out successfully from all devices`, result);
    } catch (error) {
      throw error;
    }
  }
}

export default new AdminController();
