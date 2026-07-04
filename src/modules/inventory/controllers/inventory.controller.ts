import { Response } from 'express';
import { ZodError } from 'zod';
import { AuthRequest } from '../../../middleware/auth';
import { ResponseFormatter } from '../../../utils/responseFormatter';
import InventoryService from '../services/inventory.service';
import { createStockMovementSchema, updateInventoryThresholdSchema, inventoryQuerySchema } from '../validators/inventory.validator';

export class InventoryController {
  async createStockMovement(req: AuthRequest, res: Response): Promise<void> {
    try {
      const validatedData = createStockMovementSchema.parse(req.body);
      const result = await InventoryService.createStockMovement(validatedData);
      ResponseFormatter.success(res, 'Stock movement created successfully', result);
    } catch (error) {
      if (error instanceof ZodError) {
        ResponseFormatter.error(res, 'Validation failed', 400, 'VALIDATION_ERROR', error.errors);
      } else {
        throw error;
      }
    }
  }

  async getInventoryItems(req: AuthRequest, res: Response): Promise<void> {
    try {
      const validatedQuery = inventoryQuerySchema.parse(req.query);
      const inventory = await InventoryService.getInventoryItems({
        page: parseInt(validatedQuery.page),
        limit: parseInt(validatedQuery.limit),
        warehouseId: validatedQuery.warehouseId,
        lowStock: validatedQuery.lowStock,
      });
      ResponseFormatter.success(res, 'Inventory retrieved successfully', inventory);
    } catch (error) {
      if (error instanceof ZodError) {
        ResponseFormatter.error(res, 'Validation failed', 400, 'VALIDATION_ERROR', error.errors);
      } else {
        throw error;
      }
    }
  }

  async getInventoryByVariant(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { variantId } = req.params;
      const inventory = await InventoryService.getInventoryByVariant(variantId);
      ResponseFormatter.success(res, 'Inventory retrieved successfully', inventory);
    } catch (error) {
      throw error;
    }
  }

  async updateInventoryThreshold(req: AuthRequest, res: Response): Promise<void> {
    try {
      const validatedData = updateInventoryThresholdSchema.parse(req.body);
      const inventoryItem = await InventoryService.updateInventoryThreshold(validatedData);
      ResponseFormatter.success(res, 'Inventory threshold updated successfully', inventoryItem);
    } catch (error) {
      if (error instanceof ZodError) {
        ResponseFormatter.error(res, 'Validation failed', 400, 'VALIDATION_ERROR', error.errors);
      } else {
        throw error;
      }
    }
  }

  async getStockMovements(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { page = '1', limit = '20', inventoryItemId, type } = req.query;
      const movements = await InventoryService.getStockMovements({
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        inventoryItemId: inventoryItemId as string,
        type: type as string,
      });
      ResponseFormatter.success(res, 'Stock movements retrieved successfully', movements);
    } catch (error) {
      throw error;
    }
  }

  async getWarehouses(req: AuthRequest, res: Response): Promise<void> {
    try {
      const warehouses = await InventoryService.getWarehouses();
      ResponseFormatter.success(res, 'Warehouses retrieved successfully', warehouses);
    } catch (error) {
      throw error;
    }
  }

  async getLowStockAlerts(req: AuthRequest, res: Response): Promise<void> {
    try {
      const lowStockItems = await InventoryService.getLowStockAlerts();
      ResponseFormatter.success(res, 'Low stock alerts retrieved successfully', lowStockItems);
    } catch (error) {
      throw error;
    }
  }
}

export default new InventoryController();
