import { Response } from 'express';
import { ZodError } from 'zod';
import { AuthRequest } from '../../../middleware/auth';
import { ResponseFormatter } from '../../../utils/responseFormatter';
import ReportService from '../services/report.service';
import {
  salesReportQuerySchema,
  inventoryReportQuerySchema,
  customerReportQuerySchema,
  orderReportQuerySchema,
} from '../validators/report.validator';

export class ReportController {
  async getSalesReport(req: AuthRequest, res: Response): Promise<void> {
    try {
      const validatedQuery = salesReportQuerySchema.parse(req.query);
      const report = await ReportService.getSalesReport({
        startDate: validatedQuery.startDate,
        endDate: validatedQuery.endDate,
        page: parseInt(validatedQuery.page),
        limit: parseInt(validatedQuery.limit),
      });
      ResponseFormatter.success(res, 'Sales report retrieved successfully', report);
    } catch (error) {
      if (error instanceof ZodError) {
        ResponseFormatter.error(res, 'Validation failed', 400, 'VALIDATION_ERROR', error.errors);
      } else {
        throw error;
      }
    }
  }

  async getInventoryReport(req: AuthRequest, res: Response): Promise<void> {
    try {
      const validatedQuery = inventoryReportQuerySchema.parse(req.query);
      const report = await ReportService.getInventoryReport({
        lowStock: validatedQuery.lowStock,
        warehouseId: validatedQuery.warehouseId,
        page: parseInt(validatedQuery.page),
        limit: parseInt(validatedQuery.limit),
      });
      ResponseFormatter.success(res, 'Inventory report retrieved successfully', report);
    } catch (error) {
      if (error instanceof ZodError) {
        ResponseFormatter.error(res, 'Validation failed', 400, 'VALIDATION_ERROR', error.errors);
      } else {
        throw error;
      }
    }
  }

  async getCustomerReport(req: AuthRequest, res: Response): Promise<void> {
    try {
      const validatedQuery = customerReportQuerySchema.parse(req.query);
      const report = await ReportService.getCustomerReport({
        startDate: validatedQuery.startDate,
        endDate: validatedQuery.endDate,
        page: parseInt(validatedQuery.page),
        limit: parseInt(validatedQuery.limit),
      });
      ResponseFormatter.success(res, 'Customer report retrieved successfully', report);
    } catch (error) {
      if (error instanceof ZodError) {
        ResponseFormatter.error(res, 'Validation failed', 400, 'VALIDATION_ERROR', error.errors);
      } else {
        throw error;
      }
    }
  }

  async getOrderReport(req: AuthRequest, res: Response): Promise<void> {
    try {
      const validatedQuery = orderReportQuerySchema.parse(req.query);
      const report = await ReportService.getOrderReport({
        startDate: validatedQuery.startDate,
        endDate: validatedQuery.endDate,
        status: validatedQuery.status,
        page: parseInt(validatedQuery.page),
        limit: parseInt(validatedQuery.limit),
      });
      ResponseFormatter.success(res, 'Order report retrieved successfully', report);
    } catch (error) {
      if (error instanceof ZodError) {
        ResponseFormatter.error(res, 'Validation failed', 400, 'VALIDATION_ERROR', error.errors);
      } else {
        throw error;
      }
    }
  }

  async getDashboardMetrics(req: AuthRequest, res: Response): Promise<void> {
    try {
      const metrics = await ReportService.getDashboardMetrics();
      ResponseFormatter.success(res, 'Dashboard metrics retrieved successfully', metrics);
    } catch (error) {
      throw error;
    }
  }
}

export default new ReportController();
