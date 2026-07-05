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

  async getCustomers(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { page = '1', limit = '20', search, isActive } = req.query;
      const customers = await AdminService.getCustomers({
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        search: search as string,
        isActive: isActive ? isActive === 'true' : undefined,
      });
      ResponseFormatter.success(res, `Retrieved ${customers.customers.length} customers (page ${page} of ${customers.pagination.totalPages})`, customers);
    } catch (error) {
      throw error;
    }
  }

  async getCustomerDetails(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { customerId } = req.params;
      const customer = await AdminService.getCustomerDetails(customerId);
      ResponseFormatter.success(res, `Customer details retrieved for ${customer.email}`, customer);
    } catch (error) {
      throw error;
    }
  }

  async updateCustomer(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { customerId } = req.params;
      const customer = await AdminService.updateCustomer(customerId, req.body);
      ResponseFormatter.success(res, `Customer ${customer.email} updated successfully`, customer);
    } catch (error) {
      throw error;
    }
  }

  async deleteCustomer(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { customerId } = req.params;
      const result = await AdminService.deleteCustomer(customerId);
      ResponseFormatter.success(res, `Customer ${customerId} deleted successfully`, result);
    } catch (error) {
      throw error;
    }
  }

  async getProducts(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { page = '1', limit = '20', search, status, categoryId, brandId } = req.query;
      const products = await AdminService.getProducts({
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        search: search as string,
        status: status as string,
        categoryId: categoryId as string,
        brandId: brandId as string,
      });
      ResponseFormatter.success(res, `Retrieved ${products.products.length} products (page ${page} of ${products.pagination.totalPages})`, products);
    } catch (error) {
      throw error;
    }
  }

  async createProduct(req: AuthRequest, res: Response): Promise<void> {
    try {
      const product = await AdminService.createProduct(req.body);
      ResponseFormatter.success(res, `Product ${product.name} created successfully`, product);
    } catch (error) {
      throw error;
    }
  }

  async getProductDetails(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { productId } = req.params;
      const product = await AdminService.getProductDetails(productId);
      ResponseFormatter.success(res, `Product details retrieved for ${product.name}`, product);
    } catch (error) {
      throw error;
    }
  }

  async updateProduct(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { productId } = req.params;
      const product = await AdminService.updateProduct(productId, req.body);
      ResponseFormatter.success(res, `Product ${product.name} updated successfully`, product);
    } catch (error) {
      throw error;
    }
  }

  async deleteProduct(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { productId } = req.params;
      const result = await AdminService.deleteProduct(productId);
      ResponseFormatter.success(res, `Product ${productId} deleted successfully`, result);
    } catch (error) {
      throw error;
    }
  }

  async getCategories(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { page = '1', limit = '20', search } = req.query;
      const categories = await AdminService.getCategories({
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        search: search as string,
      });
      ResponseFormatter.success(res, `Retrieved ${categories.categories.length} categories (page ${page} of ${categories.pagination.totalPages})`, categories);
    } catch (error) {
      throw error;
    }
  }

  async createCategory(req: AuthRequest, res: Response): Promise<void> {
    try {
      const category = await AdminService.createCategory(req.body);
      ResponseFormatter.success(res, `Category ${category.name} created successfully`, category);
    } catch (error) {
      throw error;
    }
  }

  async updateCategory(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { categoryId } = req.params;
      const category = await AdminService.updateCategory(categoryId, req.body);
      ResponseFormatter.success(res, `Category ${category.name} updated successfully`, category);
    } catch (error) {
      throw error;
    }
  }

  async deleteCategory(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { categoryId } = req.params;
      const result = await AdminService.deleteCategory(categoryId);
      ResponseFormatter.success(res, `Category ${categoryId} deleted successfully`, result);
    } catch (error) {
      throw error;
    }
  }

  async getBrands(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { page = '1', limit = '20', search } = req.query;
      const brands = await AdminService.getBrands({
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        search: search as string,
      });
      ResponseFormatter.success(res, `Retrieved ${brands.brands.length} brands (page ${page} of ${brands.pagination.totalPages})`, brands);
    } catch (error) {
      throw error;
    }
  }

  async createBrand(req: AuthRequest, res: Response): Promise<void> {
    try {
      const brand = await AdminService.createBrand(req.body);
      ResponseFormatter.success(res, `Brand ${brand.name} created successfully`, brand);
    } catch (error) {
      throw error;
    }
  }

  async updateBrand(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { brandId } = req.params;
      const brand = await AdminService.updateBrand(brandId, req.body);
      ResponseFormatter.success(res, `Brand ${brand.name} updated successfully`, brand);
    } catch (error) {
      throw error;
    }
  }

  async deleteBrand(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { brandId } = req.params;
      const result = await AdminService.deleteBrand(brandId);
      ResponseFormatter.success(res, `Brand ${brandId} deleted successfully`, result);
    } catch (error) {
      throw error;
    }
  }

  async getOrders(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { page = '1', limit = '20', status, startDate, endDate } = req.query;
      const orders = await AdminService.getOrders({
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        status: status as string,
        startDate: startDate as string,
        endDate: endDate as string,
      });
      ResponseFormatter.success(res, `Retrieved ${orders.orders.length} orders (page ${page} of ${orders.pagination.totalPages})`, orders);
    } catch (error) {
      throw error;
    }
  }

  async getOrderDetails(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { orderId } = req.params;
      const order = await AdminService.getOrderDetails(orderId);
      ResponseFormatter.success(res, `Order details retrieved for ${order.orderNumber}`, order);
    } catch (error) {
      throw error;
    }
  }

  async updateOrderStatus(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { orderId } = req.params;
      const order = await AdminService.updateOrderStatus(orderId, req.body);
      ResponseFormatter.success(res, `Order ${order.orderNumber} status updated to ${order.status}`, order);
    } catch (error) {
      throw error;
    }
  }

  async getOrderTimeline(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { orderId } = req.params;
      const timeline = await AdminService.getOrderTimeline(orderId);
      ResponseFormatter.success(res, `Order timeline retrieved for ${orderId}`, timeline);
    } catch (error) {
      throw error;
    }
  }

  async getInventory(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { page = '1', limit = '20', lowStock } = req.query;
      const inventory = await AdminService.getInventory({
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        lowStock: lowStock ? lowStock === 'true' : undefined,
      });
      ResponseFormatter.success(res, `Retrieved ${inventory.inventory.length} inventory items (page ${page} of ${inventory.pagination.totalPages})`, inventory);
    } catch (error) {
      throw error;
    }
  }

  async addInventory(req: AuthRequest, res: Response): Promise<void> {
    try {
      const item = await AdminService.addInventory(req.body);
      ResponseFormatter.success(res, `Inventory item added successfully`, item);
    } catch (error) {
      throw error;
    }
  }

  async updateInventory(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { inventoryId } = req.params;
      const item = await AdminService.updateInventory(inventoryId, req.body);
      ResponseFormatter.success(res, `Inventory item updated successfully`, item);
    } catch (error) {
      throw error;
    }
  }

  async getReturns(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { page = '1', limit = '20', status } = req.query;
      const returns = await AdminService.getReturns({
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        status: status as string,
      });
      ResponseFormatter.success(res, `Retrieved ${returns.returns.length} return requests (page ${page} of ${returns.pagination.totalPages})`, returns);
    } catch (error) {
      throw error;
    }
  }

  async getReturnDetails(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { returnId } = req.params;
      const returnReq = await AdminService.getReturnDetails(returnId);
      ResponseFormatter.success(res, `Return details retrieved for request ${returnId}`, returnReq);
    } catch (error) {
      throw error;
    }
  }

  async updateReturnStatus(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { returnId } = req.params;
      const returnReq = await AdminService.updateReturnStatus(returnId, req.body);
      ResponseFormatter.success(res, `Return status updated to ${returnReq.status}`, returnReq);
    } catch (error) {
      throw error;
    }
  }

  async getSalesAnalytics(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { startDate, endDate } = req.query;
      const analytics = await AdminService.getSalesAnalytics({
        startDate: startDate as string,
        endDate: endDate as string,
      });
      ResponseFormatter.success(res, 'Sales analytics retrieved successfully', analytics);
    } catch (error) {
      throw error;
    }
  }

  async getProductAnalytics(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { startDate, endDate } = req.query;
      const analytics = await AdminService.getProductAnalytics({
        startDate: startDate as string,
        endDate: endDate as string,
      });
      ResponseFormatter.success(res, 'Product analytics retrieved successfully', analytics);
    } catch (error) {
      throw error;
    }
  }

  async getUserAnalytics(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { startDate, endDate } = req.query;
      const analytics = await AdminService.getUserAnalytics({
        startDate: startDate as string,
        endDate: endDate as string,
      });
      ResponseFormatter.success(res, 'User analytics retrieved successfully', analytics);
    } catch (error) {
      throw error;
    }
  }

  async getFullAnalytics(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { date_range = '30days' } = req.query;
      const analytics = await AdminService.getFullAnalytics(date_range as string);
      ResponseFormatter.success(res, 'Full analytics retrieved successfully', analytics);
    } catch (error) {
      throw error;
    }
  }

  async getSettings(req: AuthRequest, res: Response): Promise<void> {
    try {
      const settings = await AdminService.getSettings();
      ResponseFormatter.success(res, 'Settings retrieved successfully', settings);
    } catch (error) {
      throw error;
    }
  }

  async updateSettings(req: AuthRequest, res: Response): Promise<void> {
    try {
      const settings = await AdminService.updateSettings(req.body);
      ResponseFormatter.success(res, 'Settings updated successfully', settings);
    } catch (error) {
      throw error;
    }
  }

  async uploadImage(req: AuthRequest, res: Response): Promise<void> {
    try {
      const image = await AdminService.uploadImage(req.file, req.body);
      ResponseFormatter.success(res, 'Image uploaded successfully', image);
    } catch (error) {
      throw error;
    }
  }

  async deleteImage(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { imageId } = req.params;
      const result = await AdminService.deleteImage(imageId);
      ResponseFormatter.success(res, 'Image deleted successfully', result);
    } catch (error) {
      throw error;
    }
  }

  async getCoupons(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { page = '1', limit = '20', status } = req.query;
      const coupons = await AdminService.getCoupons({
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        status: status as string,
      });
      ResponseFormatter.success(res, `Retrieved ${coupons.coupons.length} coupons (page ${page} of ${coupons.pagination.totalPages})`, coupons);
    } catch (error) {
      throw error;
    }
  }

  async createCoupon(req: AuthRequest, res: Response): Promise<void> {
    try {
      const coupon = await AdminService.createCoupon(req.body);
      ResponseFormatter.success(res, `Coupon ${coupon.code} created successfully`, coupon);
    } catch (error) {
      throw error;
    }
  }

  async updateCoupon(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { couponId } = req.params;
      const coupon = await AdminService.updateCoupon(couponId, req.body);
      ResponseFormatter.success(res, `Coupon ${coupon.code} updated successfully`, coupon);
    } catch (error) {
      throw error;
    }
  }

  async deleteCoupon(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { couponId } = req.params;
      const result = await AdminService.deleteCoupon(couponId);
      ResponseFormatter.success(res, 'Coupon deleted successfully', result);
    } catch (error) {
      throw error;
    }
  }

  async getTaxes(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { page = '1', limit = '20' } = req.query;
      const taxes = await AdminService.getTaxes({
        page: parseInt(page as string),
        limit: parseInt(limit as string),
      });
      ResponseFormatter.success(res, `Retrieved ${taxes.taxes.length} tax configurations (page ${page} of ${taxes.pagination.totalPages})`, taxes);
    } catch (error) {
      throw error;
    }
  }

  async createTax(req: AuthRequest, res: Response): Promise<void> {
    try {
      const tax = await AdminService.createTax(req.body);
      ResponseFormatter.success(res, `Tax configuration ${tax.name} created successfully`, tax);
    } catch (error) {
      throw error;
    }
  }

  async updateTax(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { taxId } = req.params;
      const tax = await AdminService.updateTax(taxId, req.body);
      ResponseFormatter.success(res, `Tax configuration ${tax.name} updated successfully`, tax);
    } catch (error) {
      throw error;
    }
  }

  async deleteTax(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { taxId } = req.params;
      const result = await AdminService.deleteTax(taxId);
      ResponseFormatter.success(res, 'Tax configuration deleted successfully', result);
    } catch (error) {
      throw error;
    }
  }

  async getShippingConfigs(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { page = '1', limit = '20' } = req.query;
      const shipping = await AdminService.getShippingConfigs({
        page: parseInt(page as string),
        limit: parseInt(limit as string),
      });
      ResponseFormatter.success(res, `Retrieved ${shipping.shippingConfigs.length} shipping configurations (page ${page} of ${shipping.pagination.totalPages})`, shipping);
    } catch (error) {
      throw error;
    }
  }

  async createShippingConfig(req: AuthRequest, res: Response): Promise<void> {
    try {
      const shipping = await AdminService.createShippingConfig(req.body);
      ResponseFormatter.success(res, `Shipping configuration ${shipping.name} created successfully`, shipping);
    } catch (error) {
      throw error;
    }
  }

  async updateShippingConfig(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { shippingId } = req.params;
      const shipping = await AdminService.updateShippingConfig(shippingId, req.body);
      ResponseFormatter.success(res, `Shipping configuration ${shipping.name} updated successfully`, shipping);
    } catch (error) {
      throw error;
    }
  }

  async deleteShippingConfig(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { shippingId } = req.params;
      const result = await AdminService.deleteShippingConfig(shippingId);
      ResponseFormatter.success(res, 'Shipping configuration deleted successfully', result);
    } catch (error) {
      throw error;
    }
  }

  async getNotifications(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { page = '1', limit = '20' } = req.query;
      const notifications = await AdminService.getNotifications({
        page: parseInt(page as string),
        limit: parseInt(limit as string),
      });
      ResponseFormatter.success(res, `Retrieved ${notifications.notifications.length} notifications (page ${page} of ${notifications.pagination.totalPages})`, notifications);
    } catch (error) {
      throw error;
    }
  }

  async sendNotification(req: AuthRequest, res: Response): Promise<void> {
    try {
      const notification = await AdminService.sendNotification(req.body);
      ResponseFormatter.success(res, 'Notification sent successfully', notification);
    } catch (error) {
      throw error;
    }
  }

  async getCollections(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { page = '1', limit = '20' } = req.query;
      const collections = await AdminService.getCollections({
        page: parseInt(page as string),
        limit: parseInt(limit as string),
      });
      ResponseFormatter.success(res, `Retrieved ${collections.collections.length} collections (page ${page} of ${collections.pagination.totalPages})`, collections);
    } catch (error) {
      throw error;
    }
  }

  async createCollection(req: AuthRequest, res: Response): Promise<void> {
    try {
      const collection = await AdminService.createCollection(req.body);
      ResponseFormatter.success(res, 'Collection created successfully', collection);
    } catch (error) {
      throw error;
    }
  }

  async updateCollection(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { collectionId } = req.params;
      const collection = await AdminService.updateCollection(collectionId, req.body);
      ResponseFormatter.success(res, 'Collection updated successfully', collection);
    } catch (error) {
      throw error;
    }
  }

  async deleteCollection(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { collectionId } = req.params;
      const result = await AdminService.deleteCollection(collectionId);
      ResponseFormatter.success(res, 'Collection deleted successfully', result);
    } catch (error) {
      throw error;
    }
  }
}

export default new AdminController();
