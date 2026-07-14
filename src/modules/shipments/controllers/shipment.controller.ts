import { Response } from 'express';
import { ZodError } from 'zod';
import { AuthRequest } from '../../../middleware/auth';
import { ResponseFormatter } from '../../../utils/responseFormatter';
import ShipmentService from '../services/shipment.service';
import { shipmentQuerySchema, updateTrackingSchema } from '../validators/shipment.validator';
import { logger } from '../../../utils/logger';

export class ShipmentController {
  async createShipment(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user || req.user.role !== 'ADMIN') {
        ResponseFormatter.error(res, 'Access denied', 403);
        return;
      }
      const { orderId } = req.body;
      if (!orderId) {
        ResponseFormatter.error(res, 'Order ID is required', 400);
        return;
      }
      const shipment = await ShipmentService.createShipment(Number(orderId));
      ResponseFormatter.success(res, 'Shipment created successfully', shipment);
    } catch (error: any) {
      ResponseFormatter.error(res, error.message || 'Failed to create shipment', 500);
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
        ResponseFormatter.error(res, (error as Error).message || 'Failed to update tracking', 500);
      }
    }
  }

  async generateAWB(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user || req.user.role !== 'ADMIN') {
        ResponseFormatter.error(res, 'Access denied', 403);
        return;
      }
      const { orderId } = req.body;
      const shipment = await ShipmentService.generateAWB(Number(orderId));
      ResponseFormatter.success(res, 'AWB assigned successfully', shipment);
    } catch (error: any) {
      ResponseFormatter.error(res, error.message || 'Failed to assign AWB', 500);
    }
  }

  async generateLabel(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user || req.user.role !== 'ADMIN') {
        ResponseFormatter.error(res, 'Access denied', 403);
        return;
      }
      const { orderId } = req.body;
      const shipment = await ShipmentService.generateLabel(Number(orderId));
      ResponseFormatter.success(res, 'Label generated successfully', shipment);
    } catch (error: any) {
      ResponseFormatter.error(res, error.message || 'Failed to generate label', 500);
    }
  }

  async generateInvoice(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user || req.user.role !== 'ADMIN') {
        ResponseFormatter.error(res, 'Access denied', 403);
        return;
      }
      const { orderId } = req.body;
      const shipment = await ShipmentService.generateInvoice(Number(orderId));
      ResponseFormatter.success(res, 'Invoice generated successfully', shipment);
    } catch (error: any) {
      ResponseFormatter.error(res, error.message || 'Failed to generate invoice', 500);
    }
  }

  async schedulePickup(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user || req.user.role !== 'ADMIN') {
        ResponseFormatter.error(res, 'Access denied', 403);
        return;
      }
      const { orderId } = req.body;
      const shipment = await ShipmentService.schedulePickup(Number(orderId));
      ResponseFormatter.success(res, 'Pickup scheduled successfully', shipment);
    } catch (error: any) {
      ResponseFormatter.error(res, error.message || 'Failed to schedule pickup', 500);
    }
  }

  async cancelShipment(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user || req.user.role !== 'ADMIN') {
        ResponseFormatter.error(res, 'Access denied', 403);
        return;
      }
      const { orderId } = req.body;
      const shipment = await ShipmentService.cancelShipment(Number(orderId));
      ResponseFormatter.success(res, 'Shipment cancelled successfully', shipment);
    } catch (error: any) {
      ResponseFormatter.error(res, error.message || 'Failed to cancel shipment', 500);
    }
  }

  async trackShipment(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { orderId } = req.params;
      const tracking = await ShipmentService.trackShipment(Number(orderId));
      ResponseFormatter.success(res, 'Shipment tracking data retrieved', tracking);
    } catch (error: any) {
      ResponseFormatter.error(res, error.message || 'Failed to track shipment', 500);
    }
  }

  async createReturnRequest(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        ResponseFormatter.error(res, 'Authentication required', 401);
        return;
      }
      const { orderId, reason, isReplacement } = req.body;
      const result = await ShipmentService.createReturnRequest(Number(orderId), reason, isReplacement);
      ResponseFormatter.success(res, 'Return/Replacement request created successfully', result);
    } catch (error: any) {
      ResponseFormatter.error(res, error.message || 'Failed to create return request', 500);
    }
  }

  async getShippingDashboard(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user || req.user.role !== 'ADMIN') {
        ResponseFormatter.error(res, 'Access denied', 403);
        return;
      }
      const stats = await ShipmentService.getShippingDashboard();
      ResponseFormatter.success(res, 'Shipping stats retrieved', stats);
    } catch (error: any) {
      ResponseFormatter.error(res, error.message || 'Failed to get dashboard stats', 500);
    }
  }

  async handleWebhook(req: AuthRequest, res: Response): Promise<void> {
    try {
      await ShipmentService.handleShiprocketWebhook(req.body);
      res.status(200).json({ success: true });
    } catch (error) {
      logger.error(`Shiprocket webhook error: ${error}`);
      res.status(500).json({ success: false });
    }
  }

  async getShipmentByOrderId(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { orderId } = req.params;
      const shipment = await ShipmentService.getShipmentByOrderId(orderId);
      ResponseFormatter.success(res, 'Shipment retrieved successfully', shipment);
    } catch (error: any) {
      ResponseFormatter.error(res, error.message || 'Failed to get shipment', 500);
    }
  }

  async getAllShipmentsForAdmin(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user || req.user.role !== 'ADMIN') {
        ResponseFormatter.error(res, 'Access denied', 403);
        return;
      }
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
        ResponseFormatter.error(res, (error as Error).message || 'Failed to retrieve shipments', 500);
      }
    }
  }

  async checkDeliveryZone(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { pincode } = req.params;
      const zone = await ShipmentService.checkDeliveryZone(pincode);
      ResponseFormatter.success(res, 'Delivery zone retrieved successfully', zone);
    } catch (error: any) {
      ResponseFormatter.error(res, error.message || 'Failed to check delivery zone', 500);
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
    } catch (error: any) {
      ResponseFormatter.error(res, error.message || 'Failed to get delivery zones', 500);
    }
  }
}

export default new ShipmentController();
