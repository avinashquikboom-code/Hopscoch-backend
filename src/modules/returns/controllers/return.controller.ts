import { Response } from 'express';
import { ZodError } from 'zod';
import { AuthRequest } from '../../../middleware/auth';
import { ResponseFormatter } from '../../../utils/responseFormatter';
import ReturnService from '../services/return.service';
import { createReturnRequestSchema, updateReturnStatusSchema, returnQuerySchema } from '../validators/return.validator';

export class ReturnController {
  async createReturnRequest(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        ResponseFormatter.error(res, 'Authentication required', 401);
        return;
      }
      const validatedData = createReturnRequestSchema.parse(req.body);
      const returnRequest = await ReturnService.createReturnRequest(req.user.id, validatedData);
      ResponseFormatter.success(res, 'Return request created successfully', returnRequest);
    } catch (error) {
      if (error instanceof ZodError) {
        ResponseFormatter.error(res, 'Validation failed', 400, 'VALIDATION_ERROR', error.errors);
      } else {
        throw error;
      }
    }
  }

  async getReturns(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        ResponseFormatter.error(res, 'Authentication required', 401);
        return;
      }
      const validatedQuery = returnQuerySchema.parse(req.query);
      const returns = await ReturnService.getReturns(req.user.id, {
        page: parseInt(validatedQuery.page),
        limit: parseInt(validatedQuery.limit),
        status: validatedQuery.status,
      });
      ResponseFormatter.success(res, 'Returns retrieved successfully', returns);
    } catch (error) {
      if (error instanceof ZodError) {
        ResponseFormatter.error(res, 'Validation failed', 400, 'VALIDATION_ERROR', error.errors);
      } else {
        throw error;
      }
    }
  }

  async getReturnById(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        ResponseFormatter.error(res, 'Authentication required', 401);
        return;
      }
      const { returnId } = req.params;
      const returnRequest = await ReturnService.getReturnById(req.user.id, returnId);
      ResponseFormatter.success(res, 'Return retrieved successfully', returnRequest);
    } catch (error) {
      throw error;
    }
  }

  async updateReturnStatus(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { returnId } = req.params;
      const validatedData = updateReturnStatusSchema.parse(req.body);
      const returnRequest = await ReturnService.updateReturnStatus(returnId, validatedData);
      ResponseFormatter.success(res, 'Return status updated successfully', returnRequest);
    } catch (error) {
      if (error instanceof ZodError) {
        ResponseFormatter.error(res, 'Validation failed', 400, 'VALIDATION_ERROR', error.errors);
      } else {
        throw error;
      }
    }
  }

  async getAllReturnsForAdmin(req: AuthRequest, res: Response): Promise<void> {
    try {
      const validatedQuery = returnQuerySchema.parse(req.query);
      const returns = await ReturnService.getAllReturnsForAdmin({
        page: parseInt(validatedQuery.page),
        limit: parseInt(validatedQuery.limit),
        status: validatedQuery.status,
      });
      ResponseFormatter.success(res, 'All returns retrieved successfully', returns);
    } catch (error) {
      if (error instanceof ZodError) {
        ResponseFormatter.error(res, 'Validation failed', 400, 'VALIDATION_ERROR', error.errors);
      } else {
        throw error;
      }
    }
  }
}

export default new ReturnController();
