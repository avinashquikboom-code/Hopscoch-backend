import { Response } from 'express';
import { ZodError } from 'zod';
import { AuthRequest } from '../../../middleware/auth';
import { ResponseFormatter } from '../../../utils/responseFormatter';
import ShipmentService from '../services/shipment.service';
import { createShipmentSchema, updateTrackingSchema, shipmentQuerySchema } from '../validators/shipment.validator';

export class ShipmentController {
  async createShipment(req: AuthRequest, res: Response): Promise<void> {
    try {
      const validatedData = createShipmentSchema.parse(req.body);
      const shipment = await ShipmentService.createShipment(validatedData);
      ResponseFormatter.success(res, 'Shipment created successfully', shipment);
    } catch (error) {
      if (error instanceof ZodError) {
        ResponseFormatter.error(res, 'Validation failed', 400, 'VALIDATION_ERROR', error.errors);
      } else {
        throw error;
      }
    }
  }

  async updateTracking(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { orderId } = req.params;
      const validatedData = updateTrackingSchema.parse(req.body);
      const shipment = await ShipmentService.updateTracking(orderId, validatedData);
      ResponseFormatter.success(res, 'Tracking updated successfully', shipment);
    } catch (error) {
      if (error instanceof ZodError) {
        ResponseFormatter.error(res, 'Validation failed', 400, 'VALIDATION_ERROR', error.errors);
      } else {
        throw error;
      }
    }
  }

  async getShipmentByOrderId(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { orderId } = req.params;
      const shipment = await ShipmentService.getShipmentByOrderId(orderId);
      ResponseFormatter.success(res, 'Shipment retrieved successfully', shipment);
    } catch (error) {
      throw error;
    }
  }

  async getAllShipmentsForAdmin(req: AuthRequest, res: Response): Promise<void> {
    try {
      const validatedQuery = shipmentQuerySchema.parse(req.query);
      const shipments = await ShipmentService.getAllShipmentsForAdmin({
        page: parseInt(validatedQuery.page),
        limit: parseInt(validatedQuery.limit),
        status: validatedQuery.status,
        courier: validatedQuery.courier,
      });
      ResponseFormatter.success(res, 'All shipments retrieved successfully', shipments);
    } catch (error) {
      if (error instanceof ZodError) {
        ResponseFormatter.error(res, 'Validation failed', 400, 'VALIDATION_ERROR', error.errors);
      } else {
        throw error;
      }
    }
  }

  async checkDeliveryZone(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { pincode } = req.params;
      const zone = await ShipmentService.checkDeliveryZone(pincode);
      ResponseFormatter.success(res, 'Delivery zone retrieved successfully', zone);
    } catch (error) {
      throw error;
    }
  }

  async getAllDeliveryZones(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { page = '1', limit = '20' } = req.query;
      const zones = await ShipmentService.getAllDeliveryZones({
        page: parseInt(page as string),
        limit: parseInt(limit as string),
      });
      ResponseFormatter.success(res, 'Delivery zones retrieved successfully', zones);
    } catch (error) {
      throw error;
    }
  }
}

export default new ShipmentController();
