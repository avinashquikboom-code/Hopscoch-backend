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
      
      // Get the backend base URL from environment or use default
      const baseUrl = process.env.API_URL || `http://${req.get('host')}`;
      
      // Convert relative avatar URLs to full URLs
      const usersWithFullUrls = users.users.map((user: any) => ({
        ...user,
        avatarUrl: user.avatarUrl ? user.avatarUrl.startsWith('http') ? user.avatarUrl : `${baseUrl}${user.avatarUrl}` : null,
      }));
      
      ResponseFormatter.success(res, `Retrieved ${usersWithFullUrls.length} admin users (page ${page} of ${users.pagination.totalPages})`, {
        ...users,
        users: usersWithFullUrls,
      });
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
      
      // Get the backend base URL from environment or use default
      const baseUrl = process.env.API_URL || `http://${req.get('host')}`;
      
      // Convert relative image URLs to full URLs
      const productsWithFullUrls = products.products.map((product: any) => ({
        ...product,
        thumbnailUrl: product.thumbnailUrl ? product.thumbnailUrl.startsWith('http') ? product.thumbnailUrl : `${baseUrl}${product.thumbnailUrl}` : null,
        images: product.images ? product.images.map((img: any) => ({
          ...img,
          url: img.url.startsWith('http') ? img.url : `${baseUrl}${img.url}`,
        })) : [],
        videos: product.videos ? product.videos.map((vid: any) => ({
          ...vid,
          url: vid.url.startsWith('http') ? vid.url : `${baseUrl}${vid.url}`,
          thumbnailUrl: vid.thumbnailUrl ? (vid.thumbnailUrl.startsWith('http') ? vid.thumbnailUrl : `${baseUrl}${vid.thumbnailUrl}`) : null,
        })) : [],
      }));
      
      ResponseFormatter.success(res, `Retrieved ${productsWithFullUrls.length} products (page ${page} of ${products.pagination.totalPages})`, {
        ...products,
        products: productsWithFullUrls,
      });
    } catch (error) {
      throw error;
    }
  }

  async createProduct(req: AuthRequest, res: Response): Promise<void> {
    try {
      // Handle file uploads
      const body = req.body;
      
      // Get the backend base URL from environment or use default
      const baseUrl = process.env.API_URL || `http://${req.get('host')}`;
      
      // Check for single file uploads (thumbnail)
      if (req.file) {
        const file = req.file as any;
        const fileUrl = `${baseUrl}/uploads/${file.filename}`;
        if (file.fieldname === 'thumbnail') {
          body.thumbnailUrl = fileUrl;
        } else if (file.fieldname === 'video') {
          body.videoUrl = fileUrl;
        }
      }
      
      // Check for multiple file uploads (images)
      if (req.files) {
        const files = req.files as any;
        if (files.images && files.images.length > 0) {
          body.imageUrls = files.images.map((img: any) => `${baseUrl}/uploads/${img.filename}`);
        }
        if (files.thumbnail && files.thumbnail[0]) {
          body.thumbnailUrl = `${baseUrl}/uploads/${files.thumbnail[0].filename}`;
        }
        if (files.video && files.video[0]) {
          body.videoUrl = `${baseUrl}/uploads/${files.video[0].filename}`;
        }
      }
      
      const product = await AdminService.createProduct(body);
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
      
      // Handle file uploads
      const body = req.body;
      
      // Get the backend base URL from environment or use default
      const baseUrl = process.env.API_URL || `http://${req.get('host')}`;
      
      // Check for single file uploads (thumbnail)
      if (req.file) {
        const file = req.file as any;
        const fileUrl = `${baseUrl}/uploads/${file.filename}`;
        if (file.fieldname === 'thumbnail') {
          body.thumbnailUrl = fileUrl;
        } else if (file.fieldname === 'video') {
          body.videoUrl = fileUrl;
        }
      }
      
      // Check for multiple file uploads (images)
      if (req.files) {
        const files = req.files as any;
        if (files.images && files.images.length > 0) {
          body.imageUrls = files.images.map((img: any) => `${baseUrl}/uploads/${img.filename}`);
        }
        if (files.thumbnail && files.thumbnail[0]) {
          body.thumbnailUrl = `${baseUrl}/uploads/${files.thumbnail[0].filename}`;
        }
        if (files.video && files.video[0]) {
          body.videoUrl = `${baseUrl}/uploads/${files.video[0].filename}`;
        }
      }
      
      const product = await AdminService.updateProduct(productId, body);
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
      
      // Get the backend base URL from environment or use default
      const baseUrl = process.env.API_URL || `http://${req.get('host')}`;
      
      // Convert relative image URLs to full URLs
      const categoriesWithFullUrls = categories.categories.map((category: any) => ({
        ...category,
        iconUrl: category.iconUrl ? category.iconUrl.startsWith('http') ? category.iconUrl : `${baseUrl}${category.iconUrl}` : null,
        bannerUrl: category.bannerUrl ? category.bannerUrl.startsWith('http') ? category.bannerUrl : `${baseUrl}${category.bannerUrl}` : null,
      }));
      
      ResponseFormatter.success(res, `Retrieved ${categoriesWithFullUrls.length} categories (page ${page} of ${categories.pagination.totalPages})`, {
        ...categories,
        categories: categoriesWithFullUrls,
      });
    } catch (error) {
      throw error;
    }
  }

  async createCategory(req: AuthRequest, res: Response): Promise<void> {
    try {
      // Handle file uploads
      const body = req.body;
      
      // Handle parentId for subcategory creation
      if (req.params.parentId) {
        body.parentId = Number(req.params.parentId);
      }
      
      // Get the backend base URL from environment or use default
      const baseUrl = process.env.API_URL || `http://${req.get('host')}`;
      
      // Check for single file uploads (icon or banner)
      if (req.file) {
        const file = req.file as any;
        const fileUrl = `${baseUrl}/uploads/${file.filename}`;
        if (file.fieldname === 'icon') {
          body.iconUrl = fileUrl;
        } else if (file.fieldname === 'banner') {
          body.bannerUrl = fileUrl;
        }
      }
      
      // Check for multiple file uploads
      if (req.files) {
        const files = req.files as any;
        if (files.icon && files.icon[0]) {
          body.iconUrl = `${baseUrl}/uploads/${files.icon[0].filename}`;
        }
        if (files.banner && files.banner[0]) {
          body.bannerUrl = `${baseUrl}/uploads/${files.banner[0].filename}`;
        }
      }
      
      const category = await AdminService.createCategory(body);
      ResponseFormatter.success(res, `Category ${category.name} created successfully`, category);
    } catch (error) {
      throw error;
    }
  }

  async updateCategory(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { categoryId } = req.params;
      
      // Handle file uploads
      const body = req.body;
      
      // Get the backend base URL from environment or use default
      const baseUrl = process.env.API_URL || `http://${req.get('host')}`;
      
      // Check for single file uploads (icon or banner)
      if (req.file) {
        const file = req.file as any;
        const fileUrl = `${baseUrl}/uploads/${file.filename}`;
        if (file.fieldname === 'icon') {
          body.iconUrl = fileUrl;
        } else if (file.fieldname === 'banner') {
          body.bannerUrl = fileUrl;
        }
      }
      
      // Check for multiple file uploads
      if (req.files) {
        const files = req.files as any;
        if (files.icon && files.icon[0]) {
          body.iconUrl = `${baseUrl}/uploads/${files.icon[0].filename}`;
        }
        if (files.banner && files.banner[0]) {
          body.bannerUrl = `${baseUrl}/uploads/${files.banner[0].filename}`;
        }
      }
      
      const category = await AdminService.updateCategory(categoryId, body);
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
      
      // Get the backend base URL from environment or use default
      const baseUrl = process.env.API_URL || `http://${req.get('host')}`;
      
      // Convert relative image URLs to full URLs
      const brandsWithFullUrls = brands.brands.map((brand: any) => ({
        ...brand,
        logoUrl: brand.logoUrl ? brand.logoUrl.startsWith('http') ? brand.logoUrl : `${baseUrl}${brand.logoUrl}` : null,
        bannerUrl: brand.bannerUrl ? brand.bannerUrl.startsWith('http') ? brand.bannerUrl : `${baseUrl}${brand.bannerUrl}` : null,
      }));
      
      ResponseFormatter.success(res, `Retrieved ${brandsWithFullUrls.length} brands (page ${page} of ${brands.pagination.totalPages})`, {
        ...brands,
        brands: brandsWithFullUrls,
      });
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
      
      // Get the backend base URL from environment or use default
      const baseUrl = process.env.API_URL || `http://${req.get('host')}`;
      
      // Convert relative invoice URLs to full URLs
      const ordersWithFullUrls = orders.orders.map((order: any) => ({
        ...order,
        invoiceUrl: order.invoiceUrl ? order.invoiceUrl.startsWith('http') ? order.invoiceUrl : `${baseUrl}${order.invoiceUrl}` : null,
      }));
      
      ResponseFormatter.success(res, `Retrieved ${ordersWithFullUrls.length} orders (page ${page} of ${orders.pagination.totalPages})`, {
        ...orders,
        orders: ordersWithFullUrls,
      });
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

  async uploadFile(req: AuthRequest, res: Response): Promise<void> {
    try {
      const result = await AdminService.uploadFile(req.file);
      ResponseFormatter.success(res, 'File uploaded successfully', result);
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
      
      // Get the backend base URL from environment or use default
      const baseUrl = process.env.API_URL || `http://${req.get('host')}`;
      
      // Convert relative image URLs to full URLs
      const collectionsWithFullUrls = collections.collections.map((collection: any) => ({
        ...collection,
        imageUrl: collection.imageUrl ? collection.imageUrl.startsWith('http') ? collection.imageUrl : `${baseUrl}${collection.imageUrl}` : null,
      }));
      
      ResponseFormatter.success(res, `Retrieved ${collectionsWithFullUrls.length} collections (page ${page} of ${collections.pagination.totalPages})`, {
        ...collections,
        collections: collectionsWithFullUrls,
      });
    } catch (error) {
      throw error;
    }
  }

  async updateVariantStock(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { variantId } = req.params;
      const { stock, reason } = req.body;
      
      const variant = await AdminService.updateVariantStock(variantId, { stock, reason });
      ResponseFormatter.success(res, `Variant stock updated successfully`, variant);
    } catch (error) {
      throw error;
    }
  }

  async createProductVariant(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { productId } = req.params;
      const variant = await AdminService.createProductVariant(productId, req.body);
      ResponseFormatter.success(res, `Product variant created successfully`, variant);
    } catch (error) {
      throw error;
    }
  }

  async updateProductVariant(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { productId, variantId } = req.params;
      const variant = await AdminService.updateProductVariant(productId, variantId, req.body);
      ResponseFormatter.success(res, `Product variant updated successfully`, variant);
    } catch (error) {
      throw error;
    }
  }

  async getReviews(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { page = '1', limit = '20', status, productId } = req.query;
      const reviews = await AdminService.getReviews({
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        status: status as string,
        productId: productId as string,
      });
      ResponseFormatter.success(res, `Retrieved ${reviews.reviews.length} reviews (page ${page} of ${reviews.pagination.totalPages})`, reviews);
    } catch (error) {
      throw error;
    }
  }

  async getReviewDetails(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { reviewId } = req.params;
      const review = await AdminService.getReviewDetails(reviewId);
      ResponseFormatter.success(res, `Review details retrieved successfully`, review);
    } catch (error) {
      throw error;
    }
  }

  async updateReviewStatus(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { reviewId } = req.params;
      const review = await AdminService.updateReviewStatus(reviewId, req.body);
      ResponseFormatter.success(res, `Review status updated successfully`, review);
    } catch (error) {
      throw error;
    }
  }

  async deleteReview(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { reviewId } = req.params;
      const result = await AdminService.deleteReview(reviewId);
      ResponseFormatter.success(res, `Review deleted successfully`, result);
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

  async getWishlist(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { page = '1', limit = '20', userId } = req.query;
      const wishlist = await AdminService.getWishlist({
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        userId: userId as string,
      });
      ResponseFormatter.success(res, `Retrieved ${wishlist.wishlist.length} wishlist items (page ${page} of ${wishlist.pagination.totalPages})`, wishlist);
    } catch (error) {
      throw error;
    }
  }

  async getCart(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { page = '1', limit = '20', userId } = req.query;
      const cart = await AdminService.getCart({
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        userId: userId as string,
      });
      ResponseFormatter.success(res, `Retrieved ${cart.cart.length} cart items (page ${page} of ${cart.pagination.totalPages})`, cart);
    } catch (error) {
      throw error;
    }
  }
}

export default new AdminController();
