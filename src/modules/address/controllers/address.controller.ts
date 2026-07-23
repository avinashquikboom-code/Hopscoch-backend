import { Response } from 'express';
import { AuthRequest } from '../../../middleware/auth';
import addressService from '../services/address.service';

export class AddressController {
  async getAddresses(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const addresses = await addressService.getUserAddresses(userId);
      return res.json({
        success: true,
        message: 'Addresses retrieved successfully',
        data: addresses,
      });
    } catch (error: any) {
      return res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'Failed to fetch addresses',
      });
    }
  }

  async createAddress(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const address = await addressService.createAddress(userId, req.body);
      return res.status(201).json({
        success: true,
        message: 'Address created successfully',
        data: address,
      });
    } catch (error: any) {
      return res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'Failed to create address',
      });
    }
  }

  async updateAddress(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const addressId = parseInt(req.params.id, 10);
      const address = await addressService.updateAddress(userId, addressId, req.body);
      return res.json({
        success: true,
        message: 'Address updated successfully',
        data: address,
      });
    } catch (error: any) {
      return res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'Failed to update address',
      });
    }
  }

  async deleteAddress(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const addressId = parseInt(req.params.id, 10);
      const result = await addressService.deleteAddress(userId, addressId);
      return res.json({
        success: true,
        message: result.message,
      });
    } catch (error: any) {
      return res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'Failed to delete address',
      });
    }
  }

  async setDefaultAddress(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const addressId = parseInt(req.params.id, 10);
      const address = await addressService.setDefaultAddress(userId, addressId);
      return res.json({
        success: true,
        message: 'Default address set successfully',
        data: address,
      });
    } catch (error: any) {
      return res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'Failed to set default address',
      });
    }
  }
}

export default new AddressController();
