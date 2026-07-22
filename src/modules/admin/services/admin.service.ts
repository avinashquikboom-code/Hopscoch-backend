import { AppError } from '../../../middleware/errorHandler';
import { logger } from '../../../utils/logger';
import prisma from '../../../utils/prisma';
import bcrypt from 'bcrypt';
import { Role, ProductStatus, OrderStatus, ReturnStatus, ReviewStatus } from '@prisma/client';
import { v2 as cloudinary } from 'cloudinary';

// Configure Cloudinary using environment variables
if (process.env.CLOUDINARY_URL) {
  cloudinary.config({
    cloudinary_url: process.env.CLOUDINARY_URL,
  });
} else if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_CLOUD_NAME !== 'your-cloud-name') {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
}

export class AdminService {
  async createAdminUser(data: {
    email: string;
    firstName: string;
    lastName: string;
    password: string;
    role: 'CUSTOMER' | 'ADMIN';
  }) {
    const { email, firstName, lastName, password, role } = data;

    // Check if email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new AppError('Email already registered', 400);
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create admin user
    const adminUser = await prisma.user.create({
      data: {
        email,
        firstName,
        lastName,
        passwordHash,
        role,
        isEmailVerified: true,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });

    logger.info(`Admin user created: ${adminUser.id} with role: ${role}`);
    return adminUser;
  }

  async getAdminUsers(filters: {
    page: number;
    limit: number;
    role?: string;
  }) {
    const { page, limit, role } = filters;
    const skip = (page - 1) * limit;

    const where: any = {
      role: { in: ['ADMIN'] },
    };

    if (role) {
      where.role = role;
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          isActive: true,
          isEmailVerified: true,
          createdAt: true,
          lastLoginAt: true,
          _count: {
            select: {
              orders: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.user.count({ where }),
    ]);

    return {
      users,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async updateAdminUser(userId: any, data: {
    firstName?: string;
    lastName?: string;
    email?: string;
    role?: 'CUSTOMER' | 'ADMIN';
    isActive?: boolean;
  }) {
    const { firstName, lastName, email, role, isActive } = data;

    const existingUser = await prisma.user.findUnique({
      where: { id: Number(userId) },
    });

    if (!existingUser) {
      throw new AppError('User not found', 404);
    }

    if (email && email !== existingUser.email) {
      const emailExists = await prisma.user.findUnique({
        where: { email },
      });

      if (emailExists) {
        throw new AppError('Email already registered', 400);
      }
    }

    const updatedUser = await prisma.user.update({
      where: { id: Number(userId) },
      data: {
        firstName,
        lastName,
        email,
        role,
        isActive,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    logger.info(`Admin user updated: ${userId}`);
    return updatedUser;
  }

  async deleteAdminUser(userId: any) {
    const user = await prisma.user.findUnique({
      where: { id: Number(userId) },
    });

    if (!user) {
      throw new AppError('User not found', 404);
    }

    // Soft delete
    await prisma.user.update({
      where: { id: Number(userId) },
      data: {
        deletedAt: new Date(),
        isActive: false,
      },
    });

    logger.info(`Admin user deleted: ${userId}`);
    return { message: 'User deleted successfully' };
  }

  async getActivityLogs(filters: {
    page: number;
    limit: number;
    userId?: any;
    action?: string;
    startDate?: string;
    endDate?: string;
  }) {
    const { page, limit, userId, action, startDate, endDate } = filters;
    const skip = (page - 1) * limit;

    // Since we don't have an ActivityLog table in the schema, we'll use AnalyticsEvent as a proxy
    const where: any = {};
    if (userId) {
      where.userId = Number(userId);
    }

    if (action) {
      where.eventType = action;
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    const [events, total] = await Promise.all([
      prisma.analyticsEvent.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.analyticsEvent.count({ where }),
    ]);

    return {
      events,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getDashboardStats() {
    const [
      totalUsers,
      activeUsers,
      totalOrders,
      totalRevenue,
      pendingReturns,
      lowStockItems,
      totalProducts,
      recentOrders,
      recentActivity,
      pendingOrders,
      deliveredOrders,
      cancelledOrders,
    ] = await Promise.all([
      prisma.user.count({ where: { deletedAt: null } }),
      prisma.user.count({ where: { isActive: true, deletedAt: null } }),
      prisma.order.count(),
      prisma.order.aggregate({
        where: {
          status: { in: ['DELIVERED', 'CONFIRMED', 'PROCESSING', 'SHIPPED'] },
        },
        _sum: {
          totalAmount: true,
        },
      }),
      prisma.returnRequest.count({
        where: {
          status: { in: ['REQUESTED', 'APPROVED'] },
        },
      }),
      prisma.warehouseInventory.count({
        where: {
          availableStock: {
            lte: 5,
          },
        },
      }),
      prisma.product.count({ where: { status: 'PUBLISHED', deletedAt: null } }),
      prisma.order.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      }),
      prisma.analyticsEvent.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      }),
      prisma.order.count({ where: { status: 'PENDING' } }),
      prisma.order.count({ where: { status: 'DELIVERED' } }),
      prisma.order.count({ where: { status: 'CANCELLED' } }),
    ]);

    const revenueVal = Number(totalRevenue._sum.totalAmount || 0);

    // Calculate growth rates (comparing current month to previous month)
    const now = new Date();
    const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfPrevMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

    const [
      currentMonthRevenueAgg,
      prevMonthRevenueAgg,
      currentMonthOrders,
      prevMonthOrders,
      currentMonthCustomers,
      prevMonthCustomers,
      currentMonthProducts,
      prevMonthProducts,
      categories,
      topSellingItems,
      ordersLast6Months,
    ] = await Promise.all([
      prisma.order.aggregate({
        where: {
          status: { in: ['DELIVERED', 'CONFIRMED', 'PROCESSING', 'SHIPPED'] },
          createdAt: { gte: startOfCurrentMonth },
        },
        _sum: { totalAmount: true },
      }),
      prisma.order.aggregate({
        where: {
          status: { in: ['DELIVERED', 'CONFIRMED', 'PROCESSING', 'SHIPPED'] },
          createdAt: { gte: startOfPrevMonth, lte: endOfPrevMonth },
        },
        _sum: { totalAmount: true },
      }),
      prisma.order.count({
        where: { createdAt: { gte: startOfCurrentMonth } },
      }),
      prisma.order.count({
        where: { createdAt: { gte: startOfPrevMonth, lte: endOfPrevMonth } },
      }),
      prisma.user.count({
        where: { deletedAt: null, createdAt: { gte: startOfCurrentMonth } },
      }),
      prisma.user.count({
        where: { deletedAt: null, createdAt: { gte: startOfPrevMonth, lte: endOfPrevMonth } },
      }),
      prisma.product.count({
        where: { status: 'PUBLISHED', deletedAt: null, createdAt: { gte: startOfCurrentMonth } },
      }),
      prisma.product.count({
        where: { status: 'PUBLISHED', deletedAt: null, createdAt: { gte: startOfPrevMonth, lte: endOfPrevMonth } },
      }),
      prisma.category.findMany({
        where: { deletedAt: null },
        select: {
          name: true,
          products: {
            where: { deletedAt: null },
            select: { id: true },
          },
        },
      }),
      prisma.orderItem.groupBy({
        by: ['productId', 'productNameSnapshot'],
        _sum: {
          quantity: true,
        },
        orderBy: {
          _sum: {
            quantity: 'desc',
          },
        },
        take: 5,
      }),
      prisma.order.findMany({
        where: {
          createdAt: { gte: new Date(now.getFullYear(), now.getMonth() - 5, 1) },
        },
        select: {
          createdAt: true,
          totalAmount: true,
          status: true,
        },
      }),
    ]);

    const currentMonthRevenue = Number(currentMonthRevenueAgg._sum.totalAmount || 0);
    const prevMonthRevenue = Number(prevMonthRevenueAgg._sum.totalAmount || 0);
    const revenueGrowth = prevMonthRevenue > 0
      ? Number((((currentMonthRevenue - prevMonthRevenue) / prevMonthRevenue) * 100).toFixed(1))
      : 0;

    const ordersGrowth = prevMonthOrders > 0
      ? Number((((currentMonthOrders - prevMonthOrders) / prevMonthOrders) * 100).toFixed(1))
      : 0;

    const customersGrowth = prevMonthCustomers > 0
      ? Number((((currentMonthCustomers - prevMonthCustomers) / prevMonthCustomers) * 100).toFixed(1))
      : 0;

    const productsGrowth = prevMonthProducts > 0
      ? Number((((currentMonthProducts - prevMonthProducts) / prevMonthProducts) * 100).toFixed(1))
      : 0;

    // Monthly sales formatting for chart
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const monthlySalesMap: Record<string, { revenue: number; orders: number }> = {};
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthName = `${monthNames[d.getMonth()]} ${d.getFullYear().toString().slice(-2)}`;
      monthlySalesMap[monthName] = { revenue: 0, orders: 0 };
    }

    ordersLast6Months.forEach(order => {
      const date = new Date(order.createdAt);
      const monthName = `${monthNames[date.getMonth()]} ${date.getFullYear().toString().slice(-2)}`;
      if (monthlySalesMap[monthName]) {
        monthlySalesMap[monthName].orders++;
        if (['DELIVERED', 'CONFIRMED', 'PROCESSING', 'SHIPPED'].includes(order.status)) {
          monthlySalesMap[monthName].revenue += Number(order.totalAmount);
        }
      }
    });

    const monthlySales = Object.entries(monthlySalesMap).map(([month, data]) => ({
      month,
      revenue: Number(data.revenue.toFixed(2)),
      orders: data.orders,
    }));

    // Category breakdown
    const categoryBreakdown = categories
      .map(cat => ({
        name: cat.name,
        value: cat.products.length,
      }))
      .filter(c => c.value > 0);

    // Top products mapping
    const topProducts = await Promise.all(
      topSellingItems.map(async (item) => {
        const orderItems = await prisma.orderItem.findMany({
          where: { productId: item.productId },
          select: { quantity: true, priceSnapshot: true },
        });
        const revenue = orderItems.reduce((sum, oi) => sum + oi.quantity * Number(oi.priceSnapshot), 0);
        return {
          name: item.productNameSnapshot,
          sales: item._sum.quantity || 0,
          revenue,
        };
      })
    );

    return {
      totalRevenue: revenueVal,
      totalOrders,
      totalCustomers: totalUsers,
      totalProducts,
      pendingOrders,
      deliveredOrders,
      cancelledOrders,
      lowStockCount: lowStockItems,
      revenueGrowth,
      ordersGrowth,
      customersGrowth,
      productsGrowth,
      monthlySales,
      categoryBreakdown,
      topProducts,
      stats: {
        totalUsers,
        activeUsers,
        totalOrders,
        totalRevenue: revenueVal,
        pendingReturns,
        lowStockItems,
        totalProducts,
      },
      recentOrders,
      recentActivity,
    };
  }

  async getAdminProfile(userId: any) {
    const user = await prisma.user.findUnique({
      where: { id: Number(userId) },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        isEmailVerified: true,
        lastLoginAt: true,
        createdAt: true,
        avatarUrl: true,
        phone: true,
      },
    });

    if (!user) {
      throw new AppError('User not found', 404);
    }

    return user;
  }

  async updateAdminProfile(userId: any, data: {
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    avatarUrl?: string;
  }) {
    const { firstName, lastName, email, phone, avatarUrl } = data;

    if (email) {
      const existingUser = await prisma.user.findUnique({
        where: { email },
      });
      if (existingUser && existingUser.id !== Number(userId)) {
        throw new AppError('Email already registered by another user', 400);
      }
    }

    const updatedUser = await prisma.user.update({
      where: { id: Number(userId) },
      data: {
        firstName,
        lastName,
        email,
        phone,
        avatarUrl,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        isEmailVerified: true,
        lastLoginAt: true,
        createdAt: true,
        avatarUrl: true,
        phone: true,
      },
    });

    logger.info(`Admin profile updated: ${userId}`);
    return updatedUser;
  }

  async logoutAdmin(userId: any) {
    // Deactivate all sessions for the user
    await prisma.session.updateMany({
      where: { userId },
      data: { isActive: false },
    });

    // Revoke all refresh tokens for the user
    await prisma.refreshToken.updateMany({
      where: { userId },
      data: { revoked: true },
    });

    logger.info(`Admin logged out: ${userId}`);
    return { message: 'Logout successful' };
  }

  async getCustomers(filters: {
    page: number;
    limit: number;
    search?: string;
    isActive?: boolean;
  }) {
    const { page, limit, search, isActive } = filters;
    const skip = (page - 1) * limit;

    const where: any = {
      role: Role.CUSTOMER,
      deletedAt: null,
    };

    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    const [customers, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          phone: true,
          role: true,
          isActive: true,
          isEmailVerified: true,
          createdAt: true,
          lastLoginAt: true,
          _count: {
            select: {
              orders: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.user.count({ where }),
    ]);

    return {
      customers,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getCustomerDetails(customerId: any) {
    const id = Number(customerId);
    const customer = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        role: true,
        isActive: true,
        isEmailVerified: true,
        avatarUrl: true,
        createdAt: true,
        lastLoginAt: true,
        addresses: true,
        orders: {
          take: 10,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            orderNumber: true,
            status: true,
            totalAmount: true,
            createdAt: true,
          },
        },
      },
    });

    if (!customer || customer.role !== Role.CUSTOMER) {
      throw new AppError('Customer not found', 404);
    }

    return customer;
  }

  async updateCustomer(customerId: any, data: any) {
    const id = Number(customerId);
    const customer = await prisma.user.findUnique({
      where: { id },
    });

    if (!customer || customer.role !== Role.CUSTOMER) {
      throw new AppError('Customer not found', 404);
    }

    const updatedCustomer = await prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        isEmailVerified: true,
        updatedAt: true,
      },
    });

    logger.info(`Customer updated: ${id}`);
    return updatedCustomer;
  }

  async deleteCustomer(customerId: any) {
    const id = Number(customerId);
    const customer = await prisma.user.findUnique({
      where: { id },
    });

    if (!customer || customer.role !== Role.CUSTOMER) {
      throw new AppError('Customer not found', 404);
    }

    // Soft delete
    await prisma.user.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        isActive: false,
      },
    });

    logger.info(`Customer deleted: ${customerId}`);
    return { message: 'Customer deleted successfully' };
  }

  async getProducts(filters: {
    page: number;
    limit: number;
    search?: string;
    status?: any;
    categoryId?: any;
    brandId?: any;
  }) {
    const { page, limit, search, status, categoryId, brandId } = filters;
    const skip = (page - 1) * limit;

    const where: any = {
      deletedAt: null,
    };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (status) {
      where.status = status;
    }

    if (categoryId) {
      where.categoryId = categoryId;
    }

    if (brandId) {
      where.brandId = brandId;
    }

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        select: {
          id: true,
          name: true,
          slug: true,
          status: true,
          basePrice: true,
          taxRuleId: true,
          hsnCode: true,
          thumbnailUrl: true,
          gender: true,
          ageGroup: true,
          isFeatured: true,
          isTrending: true,
          isNewArrival: true,
          isBestSeller: true,
          avgRating: true,
          reviewCount: true,
          createdAt: true,
          updatedAt: true,
          taxRule: true,
          images: {
            select: {
              id: true,
              url: true,
              altText: true,
            },
          },
          variants: {
            select: {
              id: true,
              sku: true,
              price: true,
              stock: true,
            },
          },
          category: {
            select: {
              id: true,
              name: true,
              taxRule: true,
            },
          },
          brand: {
            select: {
              id: true,
              name: true,
            },
          },
          _count: {
            select: {
              variants: true,
              reviews: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.product.count({ where }),
    ]);

    const mappedProducts = products.map((p: any) => ({
      ...p,
      effectiveTaxRule: p.taxRule || p.category?.taxRule || null,
    }));

    return {
      products: mappedProducts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async createProduct(data: any) {
    let categoryId = data.categoryId ? Number(data.categoryId) : undefined;
    let brandId = data.brandId ? Number(data.brandId) : undefined;

    // Resolve categoryId if missing
    if (!categoryId) {
      const categoryName = data.category || data.categoryName;
      if (categoryName) {
        const cat = await prisma.category.findFirst({
          where: { name: { equals: categoryName, mode: 'insensitive' }, deletedAt: null }
        });
        if (cat) categoryId = cat.id;
      }
    }
    if (!categoryId) {
      throw new Error('Category is required and must exist in the database. Please create the category first.');
    }

    // Resolve brandId if missing
    if (!brandId) {
      const brandName = data.brand || data.brandName;
      if (brandName) {
        const b = await prisma.brand.findFirst({
          where: { name: { equals: brandName, mode: 'insensitive' }, deletedAt: null }
        });
        if (b) brandId = b.id;
      }
    }
    if (!brandId) {
      throw new Error('Brand is required and must exist in the database. Please create the brand first.');
    }

    // Resolve price
    const basePrice = data.basePrice !== undefined ? Number(data.basePrice) : (data.price !== undefined ? Number(data.price) : 0);
    
    // Resolve slug and ensure uniqueness
    let baseSlug = data.slug;
    if (!baseSlug && data.name) {
      baseSlug = data.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    }
    if (!baseSlug) baseSlug = 'product';

    let slug = baseSlug;
    const existingSlug = await prisma.product.findUnique({ where: { slug } });
    if (existingSlug) {
      slug = `${baseSlug}-${Date.now()}`;
    }

    const product = await prisma.product.create({
      data: {
        name: data.name,
        slug: slug,
        description: data.description,
        thumbnailUrl: data.thumbnailUrl || null,
        categoryId: categoryId!,
        brandId: brandId!,
        taxRuleId: data.taxRuleId ? Number(data.taxRuleId) : null,
        hsnCode: data.hsnCode || null,
        basePrice: basePrice,
        status: data.status || ProductStatus.PUBLISHED,
        gender: data.gender || 'UNISEX',
        ageGroup: data.ageGroup || 'ADULT',
        isFeatured: data.isFeatured || false,
        isTrending: data.isTrending || false,
        isNewArrival: data.isNewArrival || false,
        isBestSeller: data.isBestSeller || false,
      }
    });

    if (Array.isArray(data.imageUrls) && data.imageUrls.length > 0) {
      for (const imgUrl of data.imageUrls) {
        await prisma.productImage.create({
          data: {
            productId: product.id,
            url: imgUrl,
            altText: data.name || '',
            sortOrder: 0,
          }
        });
      }
      if (!product.thumbnailUrl) {
        await prisma.product.update({
          where: { id: product.id },
          data: { thumbnailUrl: data.imageUrls[0] },
        });
      }
    }

    // Resolve default warehouse
    const warehouse = await this.getOrCreateDefaultWarehouse();

    if (Array.isArray(data.variants) && data.variants.length > 0) {
      for (const v of data.variants) {
        const uniqueSku = await this.generateUniqueSku(product.slug, v.sku);
        const variant = await prisma.productVariant.create({
          data: {
            productId: product.id,
            sku: uniqueSku,
            price: v.price !== undefined ? Number(v.price) : product.basePrice,
            stock: v.stock !== undefined ? Number(v.stock) : 0,
            color: v.color || 'Default',
            size: v.size || 'One Size',
            material: v.material || null,
          }
        });

        await prisma.warehouseInventory.create({
          data: {
            variantId: variant.id,
            warehouseId: warehouse.id,
            availableStock: variant.stock,
            minimumStock: 5,
          }
        });
      }
      logger.info(`Product created: ${product.id} and ${data.variants.length} variant(s) created with warehouse inventory`);
    } else {
      const stockVal = data.stock !== undefined ? Number(data.stock) : 10;
      const uniqueSku = await this.generateUniqueSku(product.slug, data.sku);
      const variant = await prisma.productVariant.create({
        data: {
          productId: product.id,
          sku: uniqueSku,
          price: product.basePrice,
          stock: stockVal,
          color: 'Default',
          size: 'One Size',
        }
      });

      await prisma.warehouseInventory.create({
        data: {
          variantId: variant.id,
          warehouseId: warehouse.id,
          availableStock: variant.stock,
          minimumStock: 5,
        }
      });
      logger.info(`Product created: ${product.id} and default variant created with stock: ${stockVal} with warehouse inventory`);
    }

    const fullProduct = await prisma.product.findUnique({
      where: { id: product.id },
      include: {
        category: true,
        brand: true,
        variants: true,
      }
    });

    if (!fullProduct) {
      throw new Error('Failed to retrieve newly created product');
    }

    return fullProduct;
  }

  async updateProduct(productId: any, data: any) {
    const id = Number(productId);
    const product = await prisma.product.findUnique({
      where: { id },
      include: { variants: true }
    });

    if (!product) {
      throw new AppError('Product not found', 404);
    }

    const updateData: any = { ...data };

    // If stock is passed directly, update the first/default variant's stock and associated inventory
    if (updateData.stock !== undefined) {
      const stockVal = parseInt(updateData.stock);
      if (product.variants && product.variants.length > 0) {
        await prisma.productVariant.update({
          where: { id: product.variants[0].id },
          data: { stock: stockVal },
        });
        await prisma.warehouseInventory.updateMany({
          where: { variantId: product.variants[0].id },
          data: { availableStock: stockVal },
        });
        logger.info(`Variant stock updated for product: ${id}, new stock: ${stockVal}`);
      } else {
        await prisma.productVariant.create({
          data: {
            productId: id,
            sku: `${product.slug}-${Date.now().toString().slice(-4)}`,
            price: product.basePrice,
            stock: stockVal,
            color: 'Default',
            size: 'One Size',
          }
        });
      }
      delete updateData.stock;
    }

    // Handle variant updates & additions (color, size, material, pattern, barcode, price, stock, sku)
    if (updateData.variants && Array.isArray(updateData.variants)) {
      const warehouse = await this.getOrCreateDefaultWarehouse();
      for (const v of updateData.variants) {
        if (v.id) {
          const vUpdate: any = {};
          if (v.stock !== undefined) vUpdate.stock = parseInt(v.stock);
          if (v.price !== undefined) vUpdate.price = parseFloat(v.price);
          if (v.color !== undefined) vUpdate.color = String(v.color);
          if (v.size !== undefined) vUpdate.size = String(v.size);
          if (v.material !== undefined) vUpdate.material = String(v.material);
          if (v.pattern !== undefined) vUpdate.pattern = String(v.pattern);
          if (v.sku !== undefined) vUpdate.sku = String(v.sku);
          if (v.barcode !== undefined) vUpdate.barcode = String(v.barcode);

          if (Object.keys(vUpdate).length > 0) {
            const updatedV = await prisma.productVariant.update({
              where: { id: Number(v.id) },
              data: vUpdate,
            });

            if (v.stock !== undefined) {
              await prisma.warehouseInventory.updateMany({
                where: { variantId: Number(v.id) },
                data: { availableStock: parseInt(v.stock) },
              });
            }
            logger.info(`Variant updated: ${updatedV.id} (color: ${updatedV.color}, size: ${updatedV.size})`);
          }
        } else {
          // Add new variant to existing product
          const uniqueSku = await this.generateUniqueSku(product.slug, v.sku);
          const newVar = await prisma.productVariant.create({
            data: {
              productId: id,
              sku: uniqueSku,
              price: v.price !== undefined && v.price !== '' ? Number(v.price) : product.basePrice,
              stock: v.stock !== undefined && v.stock !== '' ? Number(v.stock) : 0,
              color: v.color || 'Default',
              size: v.size || 'One Size',
              material: v.material || null,
              pattern: v.pattern || null,
              barcode: v.barcode || null,
            }
          });

          await prisma.warehouseInventory.create({
            data: {
              variantId: newVar.id,
              warehouseId: warehouse.id,
              availableStock: newVar.stock,
              minimumStock: 5,
            }
          });
          logger.info(`New variant created for product ${id}: ${newVar.id} (color: ${newVar.color}, size: ${newVar.size})`);
        }
      }
      delete updateData.variants;
    }

    // Resolve categoryId if category name string is passed
    if (updateData.category) {
      const cat = await prisma.category.findFirst({
        where: { name: { equals: updateData.category, mode: 'insensitive' }, deletedAt: null }
      });
      if (cat) {
        updateData.categoryId = cat.id;
      }
      delete updateData.category;
    }

    // Resolve brandId if brand name string is passed
    if (updateData.brand) {
      const b = await prisma.brand.findFirst({
        where: { name: { equals: updateData.brand, mode: 'insensitive' }, deletedAt: null }
      });
      if (b) {
        updateData.brandId = b.id;
      }
      delete updateData.brand;
    }

    // Clean up fields that might not be in Prisma schema or are passed as strings
    if (updateData.categoryId !== undefined) {
      updateData.categoryId = Number(updateData.categoryId);
    }
    if (updateData.brandId !== undefined) {
      updateData.brandId = Number(updateData.brandId);
    }
    if (updateData.basePrice !== undefined) {
      updateData.basePrice = Number(updateData.basePrice);
    } else if (updateData.price !== undefined) {
      updateData.basePrice = Number(updateData.price);
    }

    const allowedFields = [
      'name', 'slug', 'description', 'status', 'categoryId', 'brandId',
      'taxRuleId', 'hsnCode', 'thumbnailUrl', 'gender', 'ageGroup', 'basePrice',
      'discountType', 'discountValue', 'discountStartsAt', 'discountEndsAt',
      'isFeatured', 'isTrending', 'isNewArrival', 'isBestSeller', 'avgRating',
      'reviewCount', 'seoTitle', 'seoDescription'
    ];

    const cleanUpdateData: any = {};
    for (const key of allowedFields) {
      if (updateData[key] !== undefined) {
        if (key === 'taxRuleId') {
          cleanUpdateData[key] = updateData[key] ? Number(updateData[key]) : null;
        } else {
          cleanUpdateData[key] = updateData[key];
        }
      }
    }

    const updatedProduct = await prisma.product.update({
      where: { id },
      data: cleanUpdateData,
      include: {
        category: {
          include: { taxRule: true },
        },
        taxRule: true,
        brand: true,
        variants: true,
      },
    });

    logger.info(`Product updated: ${id}`);
    return {
      ...updatedProduct,
      effectiveTaxRule: updatedProduct.taxRule || (updatedProduct.category as any)?.taxRule || null,
    };
  }

  async getProductDetails(productId: any) {
    const id = Number(productId);
    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        category: {
          include: { taxRule: true },
        },
        taxRule: true,
        brand: true,
        images: {
          orderBy: { sortOrder: 'asc' },
        },
        variants: {
          where: { deletedAt: null },
        },
        reviews: {
          take: 10,
          orderBy: { createdAt: 'desc' },
          include: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    });

    if (!product) {
      throw new AppError('Product not found', 404);
    }

    return product;
  }



  async deleteProduct(productId: any) {
    const id = Number(productId);
    const product = await prisma.product.findUnique({
      where: { id },
    });

    if (!product) {
      throw new AppError('Product not found', 404);
    }

    // Soft delete
    await prisma.product.update({
      where: { id },
      data: {
        deletedAt: new Date(),
      },
    });

    logger.info(`Product deleted: ${id}`);
    return { message: 'Product deleted successfully' };
  }

  async getCategories(filters: {
    page: number;
    limit: number;
    search?: string;
  }) {
    const { page, limit, search } = filters;
    const skip = (page - 1) * limit;

    const where: any = {
      deletedAt: null,
    };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [categories, total] = await Promise.all([
      prisma.category.findMany({
        where,
        select: {
          id: true,
          name: true,
          slug: true,
          description: true,
          iconUrl: true,
          bannerUrl: true,
          isFeatured: true,
          sortOrder: true,
          parentId: true,
          parent: {
            select: {
              id: true,
              name: true,
            },
          },
          _count: {
            select: {
              products: true,
              children: true,
            },
          },
        },
        orderBy: { sortOrder: 'asc' },
        skip,
        take: limit,
      }),
      prisma.category.count({ where }),
    ]);

    return {
      categories,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async createCategory(data: any) {
    const category = await prisma.category.create({
      data: {
        name: data.name,
        slug: data.slug,
        description: data.description,
        parentId: data.parentId,
        isFeatured: data.isFeatured || false,
        sortOrder: data.sortOrder || 0,
        iconUrl: data.iconUrl,
        bannerUrl: data.bannerUrl,
      },
      select: {
        id: true,
        name: true,
        slug: true,
        isFeatured: true,
        iconUrl: true,
        bannerUrl: true,
        createdAt: true,
      },
    });

    logger.info(`Category created: ${category.id}`);
    return category;
  }

  async updateCategory(categoryId: any, data: any) {
    const id = Number(categoryId);
    const category = await prisma.category.findUnique({
      where: { id },
    });

    if (!category) {
      throw new AppError('Category not found', 404);
    }

    const allowedFields = [
      'name', 'slug', 'description', 'parentId', 'isFeatured', 'sortOrder',
      'iconUrl', 'bannerUrl', 'seoTitle', 'seoDescription'
    ];

    const cleanData: any = {};
    for (const key of allowedFields) {
      if (data[key] !== undefined) {
        cleanData[key] = key === 'parentId' && data[key] !== null ? Number(data[key]) : data[key];
      }
    }

    const updatedCategory = await prisma.category.update({
      where: { id },
      data: cleanData,
      select: {
        id: true,
        name: true,
        slug: true,
        isFeatured: true,
        updatedAt: true,
      },
    });

    logger.info(`Category updated: ${id}`);
    return updatedCategory;
  }

  async deleteCategory(categoryId: any) {
    const id = Number(categoryId);
    const category = await prisma.category.findUnique({
      where: { id },
    });

    if (!category) {
      throw new AppError('Category not found', 404);
    }

    // Soft delete
    await prisma.category.update({
      where: { id },
      data: {
        deletedAt: new Date(),
      },
    });

    logger.info(`Category deleted: ${id}`);
    return { message: 'Category deleted successfully' };
  }

  async getBrands(filters: {
    page: number;
    limit: number;
    search?: string;
  }) {
    const { page, limit, search } = filters;
    const skip = (page - 1) * limit;

    const where: any = {
      deletedAt: null,
    };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [brands, total] = await Promise.all([
      prisma.brand.findMany({
        where,
        select: {
          id: true,
          name: true,
          slug: true,
          description: true,
          isFeatured: true,
          _count: {
            select: {
              products: true,
            },
          },
        },
        orderBy: { name: 'asc' },
        skip,
        take: limit,
      }),
      prisma.brand.count({ where }),
    ]);

    return {
      brands,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async createBrand(data: any) {
    const brand = await prisma.brand.create({
      data: {
        name: data.name,
        slug: data.slug,
        description: data.description,
        isFeatured: data.isFeatured || false,
        logoUrl: data.logoUrl,
        bannerUrl: data.bannerUrl,
      },
      select: {
        id: true,
        name: true,
        slug: true,
        isFeatured: true,
        logoUrl: true,
        bannerUrl: true,
        createdAt: true,
      },
    });

    logger.info(`Brand created: ${brand.id}`);
    return brand;
  }

  async updateBrand(brandId: any, data: any) {
    const id = Number(brandId);
    const brand = await prisma.brand.findUnique({
      where: { id },
    });

    if (!brand) {
      throw new AppError('Brand not found', 404);
    }

    const allowedFields = [
      'name', 'slug', 'description', 'logoUrl', 'bannerUrl', 'isFeatured'
    ];

    const cleanData: any = {};
    for (const key of allowedFields) {
      if (data[key] !== undefined) {
        cleanData[key] = data[key];
      }
    }

    const updatedBrand = await prisma.brand.update({
      where: { id },
      data: cleanData,
      select: {
        id: true,
        name: true,
        slug: true,
        isFeatured: true,
        updatedAt: true,
      },
    });

    logger.info(`Brand updated: ${id}`);
    return updatedBrand;
  }

  async deleteBrand(brandId: any) {
    const id = Number(brandId);
    const brand = await prisma.brand.findUnique({
      where: { id },
    });

    if (!brand) {
      throw new AppError('Brand not found', 404);
    }

    // Soft delete
    await prisma.brand.update({
      where: { id },
      data: {
        deletedAt: new Date(),
      },
    });

    logger.info(`Brand deleted: ${id}`);
    return { message: 'Brand deleted successfully' };
  }

  async getOrders(filters: {
    page: number;
    limit: number;
    status?: any;
    startDate?: string;
    endDate?: string;
  }) {
    const { page, limit, status, startDate, endDate } = filters;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (status) {
      where.status = status;
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        select: {
          id: true,
          orderNumber: true,
          status: true,
          totalAmount: true,
          subtotal: true,
          taxAmount: true,
          shippingAmount: true,
          discountAmount: true,
          createdAt: true,
          updatedAt: true,
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              phone: true,
            },
          },
          address: {
            select: {
              id: true,
              fullName: true,
              phone: true,
              line1: true,
              city: true,
              state: true,
              pincode: true,
              country: true,
            },
          },
          items: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  basePrice: true,
                  thumbnailUrl: true,
                },
              },
            },
          },
          _count: {
            select: {
              items: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.order.count({ where }),
    ]);

    return {
      orders,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getOrderDetails(orderId: any) {
    const id = Number(orderId);
    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            phone: true,
          },
        },
        address: true,
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                slug: true,
                images: {
                  take: 1,
                  orderBy: { sortOrder: 'asc' },
                },
              },
            },
            variant: true,
          },
        },
        payment: true,
        returnRequest: true,
        timeline: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!order) {
      throw new AppError('Order not found', 404);
    }

    return order;
  }

  async updateOrderStatus(orderId: any, data: { status: OrderStatus }) {
    const id = Number(orderId);
    const order = await prisma.order.findUnique({
      where: { id },
    });

    if (!order) {
      throw new AppError('Order not found', 404);
    }

    const updatedOrder = await prisma.order.update({
      where: { id },
      data: {
        status: data.status,
      },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        updatedAt: true,
      },
    });

    // Add timeline event
    await prisma.orderTimelineEvent.create({
      data: {
        orderId: id,
        status: data.status,
      },
    });

    logger.info(`Order status updated: ${id} to ${data.status}`);
    return updatedOrder;
  }

  async getOrderTimeline(orderId: any) {
    const id = Number(orderId);
    const timeline = await prisma.orderTimelineEvent.findMany({
      where: { orderId: id },
      orderBy: { createdAt: 'asc' },
    });
    return timeline;
  }

  async getInventory(filters: {
    page: number;
    limit: number;
    lowStock?: boolean;
  }) {
    const { page, limit, lowStock } = filters;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (lowStock) {
      const lowStockItems = await prisma.$queryRaw<{ id: number }[]>`
        SELECT id FROM "warehouseInventory" WHERE "availableStock" <= "minimumStock"
      `;
      where.id = {
        in: lowStockItems.map((item: { id: number }) => item.id),
      };
    }

    const [inventory, total] = await Promise.all([
      prisma.warehouseInventory.findMany({
        where,
        select: {
          id: true,
          availableStock: true,
          minimumStock: true,
          createdAt: true,
          updatedAt: true,
          variant: {
            select: {
              id: true,
              sku: true,
              size: true,
              color: true,
              price: true,
              product: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                }
              }
            },
          },
          warehouse: {
            select: {
              id: true,
              name: true,
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.warehouseInventory.count({ where }),
    ]);

    return {
      inventory,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getOrCreateDefaultWarehouse() {
    let warehouse = await prisma.warehouse.findFirst({ where: { isDefault: true } });
    if (!warehouse) {
      warehouse = await prisma.warehouse.findFirst({ where: { status: 'ACTIVE' } });
    }
    if (!warehouse) {
      warehouse = await prisma.warehouse.findFirst();
    }
    if (!warehouse) {
      warehouse = await prisma.warehouse.create({
        data: {
          name: 'Main Warehouse',
          code: 'AURA-WH-01',
          address: 'Central Logistics Facility',
          city: 'Mumbai',
          state: 'Maharashtra',
          country: 'India',
          pincode: '400001',
          phone: '0000000000',
          email: 'warehouse@company.com',
          status: 'ACTIVE',
          isDefault: true,
        },
      });
    }
    return warehouse;
  }

  async generateUniqueSku(productSlug: string, inputSku?: string) {
    let candidate = inputSku || `${productSlug}-${Math.floor(1000 + Math.random() * 9000)}`;
    const existing = await prisma.productVariant.findUnique({ where: { sku: candidate } });
    if (existing) {
      candidate = `${candidate}-${Date.now().toString().slice(-4)}`;
    }
    return candidate;
  }

  async getWarehouses(query: { page?: number; limit?: number; search?: string; status?: string }) {
    const page = Math.max(1, query.page || 1);
    const limit = Math.max(1, query.limit || 20);
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query.status) {
      where.status = query.status;
    }
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { code: { contains: query.search, mode: 'insensitive' } },
        { city: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [warehouses, total] = await Promise.all([
      prisma.warehouse.findMany({
        where,
        include: {
          _count: {
            select: {
              inventory: true,
            },
          },
        },
        orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
        skip,
        take: limit,
      }),
      prisma.warehouse.count({ where }),
    ]);

    return {
      warehouses,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async createWarehouse(data: {
    name: string;
    code?: string;
    address: string;
    city: string;
    state: string;
    country?: string;
    pincode: string;
    phone: string;
    email: string;
    status?: 'ACTIVE' | 'INACTIVE';
    isDefault?: boolean;
    shiprocketPickupName?: string;
  }) {
    if (!data.name || !data.address || !data.city || !data.state || !data.pincode || !data.phone || !data.email) {
      throw new AppError('Missing required warehouse fields: name, address, city, state, pincode, phone, email', 400);
    }

    const code = data.code ? data.code.trim().toUpperCase() : `AURA-WH-${Math.floor(100 + Math.random() * 900)}`;

    const existingCode = await prisma.warehouse.findUnique({ where: { code } });
    if (existingCode) {
      throw new AppError(`Warehouse code '${code}' already exists`, 400);
    }

    if (data.isDefault) {
      await prisma.warehouse.updateMany({
        where: { isDefault: true },
        data: { isDefault: false },
      });
    }

    const warehouse = await prisma.warehouse.create({
      data: {
        name: data.name,
        code,
        address: data.address,
        city: data.city,
        state: data.state,
        country: data.country || 'India',
        pincode: data.pincode,
        phone: data.phone,
        email: data.email,
        status: (data.status as any) || 'ACTIVE',
        isDefault: data.isDefault || false,
        shiprocketPickupName: data.shiprocketPickupName || null,
      },
    });

    logger.info(`Warehouse created: ${warehouse.id} (${warehouse.name})`);
    return warehouse;
  }

  async getWarehouseDetails(warehouseId: any) {
    const id = Number(warehouseId);
    const warehouse = await prisma.warehouse.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            inventory: true,
            movements: true,
          },
        },
      },
    });

    if (!warehouse) {
      throw new AppError(`Warehouse with ID ${warehouseId} not found`, 404);
    }

    return warehouse;
  }

  async updateWarehouse(warehouseId: any, data: Partial<{
    name: string;
    code: string;
    address: string;
    city: string;
    state: string;
    country: string;
    pincode: string;
    phone: string;
    email: string;
    status: 'ACTIVE' | 'INACTIVE';
    isDefault: boolean;
    shiprocketPickupName: string;
  }>) {
    const id = Number(warehouseId);
    const existing = await prisma.warehouse.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError(`Warehouse with ID ${warehouseId} not found`, 404);
    }

    if (data.code && data.code.trim().toUpperCase() !== existing.code) {
      const formattedCode = data.code.trim().toUpperCase();
      const codeCheck = await prisma.warehouse.findUnique({ where: { code: formattedCode } });
      if (codeCheck) {
        throw new AppError(`Warehouse code '${formattedCode}' already exists`, 400);
      }
    }

    if (data.isDefault && !existing.isDefault) {
      await prisma.warehouse.updateMany({
        where: { isDefault: true },
        data: { isDefault: false },
      });
    }

    const updated = await prisma.warehouse.update({
      where: { id },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.code && { code: data.code.trim().toUpperCase() }),
        ...(data.address && { address: data.address }),
        ...(data.city && { city: data.city }),
        ...(data.state && { state: data.state }),
        ...(data.country && { country: data.country }),
        ...(data.pincode && { pincode: data.pincode }),
        ...(data.phone && { phone: data.phone }),
        ...(data.email && { email: data.email }),
        ...(data.status && { status: data.status as any }),
        ...(data.isDefault !== undefined && { isDefault: data.isDefault }),
        ...(data.shiprocketPickupName !== undefined && { shiprocketPickupName: data.shiprocketPickupName }),
      },
    });

    logger.info(`Warehouse updated: ${updated.id}`);
    return updated;
  }

  async deleteWarehouse(warehouseId: any) {
    const id = Number(warehouseId);
    const existing = await prisma.warehouse.findUnique({
      where: { id },
      include: {
        _count: {
          select: { inventory: true },
        },
      },
    });

    if (!existing) {
      throw new AppError(`Warehouse with ID ${warehouseId} not found`, 404);
    }

    if (existing.isDefault) {
      throw new AppError('Cannot delete the default warehouse. Mark another warehouse as default first.', 400);
    }

    if (existing._count.inventory > 0) {
      await prisma.warehouse.update({
        where: { id },
        data: { status: 'INACTIVE' },
      });
      return { message: 'Warehouse has associated inventory items. Status changed to INACTIVE.' };
    }

    await prisma.warehouse.delete({ where: { id } });
    logger.info(`Warehouse deleted: ${id}`);
    return { message: 'Warehouse deleted successfully' };
  }

  async addInventory(data: {
    variantId: any;
    quantity: number;
    lowStockThreshold?: number;
    warehouseId?: any;
  }) {
    const variantId = Number(data.variantId);
    let warehouse: any;

    if (data.warehouseId) {
      const targetId = Number(data.warehouseId);
      warehouse = await prisma.warehouse.findUnique({ where: { id: targetId } });
      if (!warehouse) {
        throw new AppError(`Warehouse with ID ${data.warehouseId} not found`, 404);
      }
    } else {
      warehouse = await this.getOrCreateDefaultWarehouse();
    }

    const warehouseId = warehouse.id;

    const item = await prisma.warehouseInventory.upsert({
      where: {
        warehouseId_variantId: {
          variantId,
          warehouseId,
        }
      },
      update: {
        availableStock: {
          increment: data.quantity,
        }
      },
      create: {
        variantId,
        warehouseId,
        availableStock: data.quantity,
        minimumStock: data.lowStockThreshold || 5,
      },
      select: {
        id: true,
        availableStock: true,
        minimumStock: true,
        createdAt: true,
      }
    });

    logger.info(`Inventory added: ${item.id}`);
    return item;
  }

  async updateInventory(inventoryId: any, data: {
    quantity?: number;
    lowStockThreshold?: number;
  }) {
    const id = Number(inventoryId);
    const item = await prisma.warehouseInventory.findUnique({
      where: { id },
    });

    if (!item) {
      throw new AppError('Inventory item not found', 404);
    }

    const updatedItem = await prisma.warehouseInventory.update({
      where: { id },
      data: {
        ...(data.quantity !== undefined && { availableStock: data.quantity }),
        ...(data.lowStockThreshold !== undefined && { minimumStock: data.lowStockThreshold }),
      },
      select: {
        id: true,
        availableStock: true,
        minimumStock: true,
        updatedAt: true,
      }
    });

    logger.info(`Inventory updated: ${id}`);
    return updatedItem;
  }

  async getReturns(filters: {
    page: number;
    limit: number;
    status?: any;
  }) {
    const { page, limit, status } = filters;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (status) {
      where.status = status;
    }

    const [returns, total] = await Promise.all([
      prisma.returnRequest.findMany({
        where,
        select: {
          id: true,
          status: true,
          reason: true,
          createdAt: true,
          updatedAt: true,
          order: {
            select: {
              id: true,
              orderNumber: true,
              totalAmount: true,
              user: {
                select: {
                  id: true,
                  email: true,
                  firstName: true,
                  lastName: true,
                }
              }
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.returnRequest.count({ where }),
    ]);

    const mappedReturns = returns.map(r => ({
      id: r.id,
      status: r.status,
      reason: r.reason,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      order: {
        id: r.order.id,
        orderNumber: r.order.orderNumber,
        totalAmount: r.order.totalAmount,
      },
      user: r.order.user,
    }));

    return {
      returns: mappedReturns,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getReturnDetails(returnId: any) {
    const id = Number(returnId);
    const returnReq = await prisma.returnRequest.findUnique({
      where: { id },
      include: {
        order: {
          include: {
            items: {
              include: {
                product: {
                  select: {
                    id: true,
                    name: true,
                    slug: true,
                  }
                },
                variant: true,
              }
            },
            address: true,
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                phone: true,
              }
            }
          },
        },
      },
    });

    if (!returnReq) {
      throw new AppError('Return request not found', 404);
    }

    return {
      id: returnReq.id,
      status: returnReq.status,
      reason: returnReq.reason,
      isReplacement: returnReq.isReplacement,
      createdAt: returnReq.createdAt,
      updatedAt: returnReq.updatedAt,
      order: returnReq.order,
      user: returnReq.order.user,
    };
  }

  async updateReturnStatus(returnId: any, data: any) {
    const id = Number(returnId);
    const returnReq = await prisma.returnRequest.findUnique({
      where: { id },
    });

    if (!returnReq) {
      throw new AppError('Return request not found', 404);
    }

    const updatedReturn = await prisma.returnRequest.update({
      where: { id },
      data: {
        status: data.status,
      },
      select: {
        id: true,
        status: true,
        updatedAt: true,
      },
    });

    logger.info(`Return status updated: ${id} to ${data.status}`);
    return updatedReturn;
  }

  async getFullAnalytics(dateRange: string = '30days') {
    const now = new Date();
    let startDate = new Date();
    if (dateRange === '7days') startDate.setDate(now.getDate() - 7);
    else if (dateRange === '30days') startDate.setDate(now.getDate() - 30);
    else if (dateRange === '90days') startDate.setDate(now.getDate() - 90);
    else if (dateRange === '1year') startDate.setFullYear(now.getFullYear() - 1);
    else startDate.setDate(now.getDate() - 30);

    const dateWhere = { createdAt: { gte: startDate, lte: now } };

    // Build last 6 months for trend chart
    const months: { label: string; start: Date; end: Date }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const start = new Date(d.getFullYear(), d.getMonth(), 1);
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);
      months.push({ label: start.toLocaleString('default', { month: 'short' }), start, end });
    }

    const [
      // Dashboard totals
      totalRevenue,
      totalOrders,
      avgOrderValue,
      conversionData,
      // Order status breakdown
      pendingOrders,
      confirmedOrders,
      processingOrders,
      shippedOrders,
      deliveredOrders,
      cancelledOrders,
      // Payment breakdown
      paidPayments,
      failedPayments,
      refundedPayments,
      totalPaymentRevenue,
      // Returns
      totalReturns,
      pendingReturns,
      approvedReturns,
      rejectedReturns,
      // Inventory
      totalSkus,
      lowStockCount,
      outOfStockCount,
      // Users
      totalUsers,
      activeUsers,
      newUsers,
      // Products
      totalProducts,
      lowStockProducts,
      // Top products
      topProductItems,
    ] = await Promise.all([
      // Revenue
      prisma.order.aggregate({ where: { status: { in: ['DELIVERED', 'CONFIRMED', 'PROCESSING', 'SHIPPED'] }, ...dateWhere }, _sum: { totalAmount: true } }),
      prisma.order.count({ where: dateWhere }),
      prisma.order.aggregate({ where: dateWhere, _avg: { totalAmount: true } }),
      prisma.user.count({ where: { role: 'CUSTOMER', deletedAt: null } }),
      // Order statuses
      prisma.order.count({ where: { status: 'PENDING', ...dateWhere } }),
      prisma.order.count({ where: { status: 'CONFIRMED', ...dateWhere } }),
      prisma.order.count({ where: { status: 'PROCESSING', ...dateWhere } }),
      prisma.order.count({ where: { status: 'SHIPPED', ...dateWhere } }),
      prisma.order.count({ where: { status: 'DELIVERED', ...dateWhere } }),
      prisma.order.count({ where: { status: 'CANCELLED', ...dateWhere } }),
      // Payments
      prisma.payment.count({ where: { status: 'PAID', ...dateWhere } }),
      prisma.payment.count({ where: { status: 'FAILED', ...dateWhere } }),
      prisma.payment.count({ where: { status: 'REFUNDED', ...dateWhere } }),
      prisma.payment.aggregate({ where: { status: 'PAID', ...dateWhere }, _sum: { amount: true } }),
      // Returns
      prisma.returnRequest.count({ where: dateWhere }),
      prisma.returnRequest.count({ where: { status: 'REQUESTED', ...dateWhere } }),
      prisma.returnRequest.count({ where: { status: 'APPROVED', ...dateWhere } }),
      prisma.returnRequest.count({ where: { status: 'REJECTED', ...dateWhere } }),
      // Inventory
      prisma.warehouseInventory.count(),
      prisma.warehouseInventory.count({ where: { availableStock: { lte: 5, gt: 0 } } }),
      prisma.warehouseInventory.count({ where: { availableStock: 0 } }),
      // Users
      prisma.user.count({ where: { role: 'CUSTOMER', deletedAt: null } }),
      prisma.user.count({ where: { role: 'CUSTOMER', isActive: true, deletedAt: null } }),
      prisma.user.count({ where: { role: 'CUSTOMER', deletedAt: null, ...dateWhere } }),
      // Products
      prisma.product.count({ where: { status: 'PUBLISHED', deletedAt: null } }),
      prisma.warehouseInventory.findMany({ where: { availableStock: { lte: 5 } }, take: 5, include: { variant: { include: { product: { select: { name: true } } } } } }),
      // Top products
      prisma.orderItem.groupBy({ by: ['productId'], where: { order: dateWhere }, _sum: { quantity: true }, orderBy: { _sum: { quantity: 'desc' } }, take: 5 }),
    ]);

    // Monthly revenue + order trend
    const monthlyTrend = await Promise.all(
      months.map(async (m) => {
        const [rev, orders, returns] = await Promise.all([
          prisma.order.aggregate({ where: { status: { in: ['DELIVERED', 'CONFIRMED', 'PROCESSING', 'SHIPPED'] }, createdAt: { gte: m.start, lte: m.end } }, _sum: { totalAmount: true } }),
          prisma.order.count({ where: { createdAt: { gte: m.start, lte: m.end } } }),
          prisma.returnRequest.count({ where: { createdAt: { gte: m.start, lte: m.end } } }),
        ]);
        return { month: m.label, revenue: Number(rev._sum.totalAmount ?? 0), orders, returns };
      })
    );

    // Top products with names
    const topProductIds = topProductItems.map((p: any) => p.productId);
    const topProductNames = topProductIds.length > 0
      ? await prisma.product.findMany({ where: { id: { in: topProductIds } }, select: { id: true, name: true } })
      : [];
    const topProducts = topProductItems.map((p: any) => ({
      name: topProductNames.find((n) => n.id === p.productId)?.name ?? `Product ${p.productId}`,
      sales: p._sum.quantity ?? 0,
    }));

    return {
      summary: {
        totalRevenue: Number(totalRevenue._sum.totalAmount ?? 0),
        totalOrders,
        avgOrderValue: Number(avgOrderValue._avg.totalAmount ?? 0),
        conversionRate: totalOrders > 0 && conversionData > 0 ? ((totalOrders / conversionData) * 100) : 0,
      },
      monthlyTrend,
      orders: { pending: pendingOrders, confirmed: confirmedOrders, processing: processingOrders, shipped: shippedOrders, delivered: deliveredOrders, cancelled: cancelledOrders, total: totalOrders },
      payments: { paid: paidPayments, failed: failedPayments, refunded: refundedPayments, totalRevenue: Number(totalPaymentRevenue._sum.amount ?? 0) },
      returns: { total: totalReturns, pending: pendingReturns, approved: approvedReturns, rejected: rejectedReturns },
      inventory: { total: totalSkus, lowStock: lowStockCount, outOfStock: outOfStockCount, lowStockProducts: lowStockProducts.map((item: any) => item.variant?.product?.name ?? 'Unknown') },
      users: { total: totalUsers, active: activeUsers, new: newUsers, inactive: totalUsers - activeUsers },
      products: { total: totalProducts, topProducts },
    };
  }

  async getSalesAnalytics(filters: {
    startDate?: string;
    endDate?: string;
  }) {
    const { startDate, endDate } = filters;

    const where: any = {};

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    const [totalRevenue, totalOrders, averageOrderValue] = await Promise.all([
      prisma.order.aggregate({
        where: {
          ...where,
          status: { in: ['DELIVERED', 'CONFIRMED', 'PROCESSING', 'SHIPPED'] },
        },
        _sum: { totalAmount: true },
      }),
      prisma.order.count({ where }),
      prisma.order.aggregate({
        where,
        _avg: { totalAmount: true },
      }),
    ]);

    return {
      totalRevenue: totalRevenue._sum.totalAmount || 0,
      totalOrders,
      averageOrderValue: averageOrderValue._avg.totalAmount || 0,
    };
  }

  async getProductAnalytics(filters: {
    startDate?: string;
    endDate?: string;
  }) {
    const { startDate, endDate } = filters;

    const where: any = {};

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    const [totalProducts, topProducts, lowStockProducts] = await Promise.all([
      prisma.product.count({
        where: { status: 'PUBLISHED', deletedAt: null },
      }),
      prisma.orderItem.groupBy({
        by: ['productId'],
        _sum: { quantity: true },
        orderBy: { _sum: { quantity: 'desc' } },
        take: 10,
      }),
      prisma.warehouseInventory.count({
        where: {
          availableStock: {
            lte: 5,
          },
        },
      }),
    ]);

    return {
      totalProducts,
      topSellingProducts: topProducts,
      lowStockProducts,
    };
  }

  async getUserAnalytics(filters: {
    startDate?: string;
    endDate?: string;
  }) {
    const { startDate, endDate } = filters;

    const where: any = {};

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    const [totalUsers, newUsers, activeUsers] = await Promise.all([
      prisma.user.count({ where: { deletedAt: null } }),
      prisma.user.count({
        where: { ...where, deletedAt: null },
      }),
      prisma.user.count({
        where: { isActive: true, deletedAt: null },
      }),
    ]);

    return {
      totalUsers,
      newUsers,
      activeUsers,
    };
  }

  async getSessions(userId: number) {
    const sessions = await prisma.session.findMany({
      where: { userId, isActive: true },
      orderBy: { lastActivityAt: 'desc' },
    });

    return sessions.map((s, index: number) => ({
      id: String(s.id),
      device: s.deviceName || s.deviceType || 'Unknown device',
      browser: s.browser || 'Unknown browser',
      os: s.os || s.platform || 'Unknown OS',
      ip: s.ipAddress || '—',
      location: '—',
      lastActive: s.lastActivityAt.toISOString(),
      current: index === 0,
    }));
  }

  async getSettings() {
    const settings = await prisma.systemSettings.findFirst();
    if (!settings) {
      return {
        siteName: 'FCISeller',
        siteDescription: 'Luxury Fashion E-commerce',
        contactEmail: 'contact@fciseller.com',
        contactPhone: '+1-800-123-4567',
        currency: 'USD',
      };
    }
    return settings;
  }

  async updateSettings(data: any) {
    const settings = await prisma.systemSettings.upsert({
      where: { id: 'default' },
      update: data,
      create: {
        id: 'default',
        ...data,
      },
    });

    logger.info('Settings updated');
    return settings;
  }

  async uploadImage(file: any, data: any) {
    if (!file) {
      throw new AppError('No file provided', 400);
    }

    let url: string;
    const isCloudinaryConfigured = 
      Boolean(process.env.CLOUDINARY_URL) ||
      (Boolean(process.env.CLOUDINARY_CLOUD_NAME) && process.env.CLOUDINARY_CLOUD_NAME !== 'your-cloud-name');

    if (isCloudinaryConfigured) {
      try {
        const result = await cloudinary.uploader.upload(file.path, {
          folder: 'hopscotch',
          resource_type: 'image',
        });
        url = result.secure_url;
      } catch (err) {
        logger.error(`Cloudinary upload failed, falling back to local: ${err}`);
        const apiBase = process.env.API_URL || 'http://localhost:5001';
        url = `${apiBase}/uploads/${file.filename}`;
      }
    } else {
      const apiBase = process.env.API_URL || 'http://localhost:5001';
      url = `${apiBase}/uploads/${file.filename}`;
    }

    // Save image record to database
    const productId = Number(data.productId);
    let image = null;
    if (!isNaN(productId) && productId > 0) {
      image = await prisma.productImage.create({
        data: {
          productId,
          url,
          altText: data.altText || '',
          sortOrder: 0,
        },
        select: {
          id: true,
          url: true,
          altText: true,
        },
      });

      // Update product's thumbnailUrl if it's empty
      const product = await prisma.product.findUnique({ where: { id: productId } });
      if (product && !product.thumbnailUrl) {
        await prisma.product.update({
          where: { id: productId },
          data: { thumbnailUrl: url },
        });
      }
    }

    logger.info(`Image uploaded: ${image?.id || 'standalone'} with URL: ${url}`);
    return image || { url };
  }

  async deleteImage(imageId: any) {
    const id = Number(imageId);
    const image = await prisma.productImage.findUnique({
      where: { id },
    });

    if (!image) {
      throw new AppError('Image not found', 404);
    }

    // Delete from database
    await prisma.productImage.delete({
      where: { id },
    });

    logger.info(`Image deleted: ${id}`);
    return { message: 'Image deleted successfully' };
  }

  async getCoupons(filters: {
    page: number;
    limit: number;
    status?: any;
  }) {
    const { page, limit, status } = filters;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (status) {
      where.isActive = status === 'ACTIVE';
    }

    const [coupons, total] = await Promise.all([
      prisma.coupon.findMany({
        where,
        select: {
          id: true,
          code: true,
          type: true,
          value: true,
          maxDiscount: true,
          minOrderValue: true,
          startsAt: true,
          expiresAt: true,
          usageLimit: true,
          isActive: true,
          createdAt: true,
          _count: {
            select: {
              usages: true,
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.coupon.count({ where }),
    ]);

    const mappedCoupons = coupons.map(c => ({
      id: c.id,
      code: c.code,
      discountType: c.type,
      discountValue: c.value,
      maxDiscount: c.maxDiscount,
      minPurchase: c.minOrderValue,
      startDate: c.startsAt,
      endDate: c.expiresAt,
      usageLimit: c.usageLimit,
      usedCount: c._count.usages,
      status: c.isActive ? 'ACTIVE' : 'INACTIVE',
      createdAt: c.createdAt,
    }));

    return {
      coupons: mappedCoupons,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async createCoupon(data: any) {
    const couponType = data.type || data.discountType;
    const couponValue = data.value !== undefined ? Number(data.value) : (data.discountValue !== undefined ? Number(data.discountValue) : 0);
    const minOrder = data.minOrderValue !== undefined ? Number(data.minOrderValue) : (data.minPurchase !== undefined ? Number(data.minPurchase) : null);
    const maxDisc = data.maxDiscount !== undefined ? (data.maxDiscount !== null ? Number(data.maxDiscount) : null) : null;
    const startsAt = data.startsAt ? new Date(data.startsAt) : (data.startDate ? new Date(data.startDate) : new Date());
    const expiresAt = data.expiresAt ? new Date(data.expiresAt) : (data.endDate ? new Date(data.endDate) : new Date(Date.now() + 365*24*60*60*1000));

    const coupon = await prisma.coupon.create({
      data: {
        code: data.code,
        type: couponType,
        value: couponValue,
        maxDiscount: maxDisc,
        minOrderValue: minOrder,
        startsAt: startsAt,
        expiresAt: expiresAt,
        usageLimit: data.usageLimit ? Number(data.usageLimit) : null,
        isActive: data.isActive !== undefined ? Boolean(data.isActive) : true,
      },
      select: {
        id: true,
        code: true,
        type: true,
        value: true,
        isActive: true,
        createdAt: true,
      },
    });

    logger.info(`Coupon created: ${coupon.code}`);
    return {
      id: coupon.id,
      code: coupon.code,
      discountType: coupon.type,
      discountValue: coupon.value,
      status: coupon.isActive ? 'ACTIVE' : 'INACTIVE',
      createdAt: coupon.createdAt,
    };
  }

  async updateCoupon(couponId: any, data: any) {
    const id = Number(couponId);
    if (isNaN(id) || id > 2147483647) {
      return { id, code: data.code, discountType: data.type, discountValue: data.value, status: data.isActive ? 'ACTIVE' : 'INACTIVE', updatedAt: new Date() };
    }

    const coupon = await prisma.coupon.findUnique({
      where: { id },
    });

    if (!coupon) {
      throw new AppError('Coupon not found', 404);
    }

    const updatedCoupon = await prisma.coupon.update({
      where: { id },
      data: {
        ...(data.code !== undefined && { code: data.code }),
        ...((data.discountType !== undefined || data.type !== undefined) && { type: data.type || data.discountType }),
        ...((data.discountValue !== undefined || data.value !== undefined) && { value: Number(data.value ?? data.discountValue) }),
        ...(data.maxDiscount !== undefined && { maxDiscount: data.maxDiscount !== null ? Number(data.maxDiscount) : null }),
        ...((data.minPurchase !== undefined || data.minOrderValue !== undefined) && { minOrderValue: Number(data.minOrderValue ?? data.minPurchase) }),
        ...((data.startDate !== undefined || data.startsAt !== undefined) && { startsAt: new Date(data.startsAt ?? data.startDate) }),
        ...((data.endDate !== undefined || data.expiresAt !== undefined) && { expiresAt: new Date(data.expiresAt ?? data.endDate) }),
        ...(data.usageLimit !== undefined && { usageLimit: data.usageLimit !== null ? Number(data.usageLimit) : null }),
        ...(data.status !== undefined && { isActive: data.status === 'ACTIVE' }),
        ...(data.isActive !== undefined && { isActive: Boolean(data.isActive) }),
      },
      select: {
        id: true,
        code: true,
        type: true,
        value: true,
        isActive: true,
        updatedAt: true,
      },
    });

    logger.info(`Coupon updated: ${id}`);
    return {
      id: updatedCoupon.id,
      code: updatedCoupon.code,
      discountType: updatedCoupon.type,
      discountValue: updatedCoupon.value,
      status: updatedCoupon.isActive ? 'ACTIVE' : 'INACTIVE',
      updatedAt: updatedCoupon.updatedAt,
    };
  }

  async deleteCoupon(couponId: any) {
    const id = Number(couponId);
    if (isNaN(id) || id > 2147483647) {
      return { message: 'Coupon deleted successfully' };
    }

    const coupon = await prisma.coupon.findUnique({
      where: { id },
    });

    if (!coupon) {
      throw new AppError('Coupon not found', 404);
    }

    await prisma.coupon.delete({
      where: { id },
    });

    logger.info(`Coupon deleted: ${couponId}`);
    return { message: 'Coupon deleted successfully' };
  }

  async getTaxes(filters: {
    page: number;
    limit: number;
  }) {
    const { page, limit } = filters;
    const skip = (page - 1) * limit;

    const [taxes, total] = await Promise.all([
      prisma.tax.findMany({
        select: {
          id: true,
          name: true,
          rate: true,
          type: true,
          taxType: true,
          hsnCode: true,
          country: true,
          state: true,
          zipCode: true,
          isActive: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.tax.count(),
    ]);

    return {
      taxes,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async createTax(data: any) {
    const tax = await prisma.tax.create({
      data: {
        name: data.name,
        rate: data.rate,
        type: data.type,
        taxType: data.taxType,
        hsnCode: data.hsnCode,
        country: data.country,
        state: data.state,
        zipCode: data.zipCode,
        isActive: data.isActive !== undefined ? data.isActive : true,
      },
      select: {
        id: true,
        name: true,
        rate: true,
        type: true,
        taxType: true,
        hsnCode: true,
        country: true,
        state: true,
        zipCode: true,
        isActive: true,
        createdAt: true,
      },
    });

    logger.info(`Tax created: ${tax.name}`);
    return tax;
  }

  async updateTax(taxId: any, data: any) {
    const id = Number(taxId);
    const tax = await prisma.tax.findUnique({
      where: { id },
    });

    if (!tax) {
      throw new AppError('Tax not found', 404);
    }

    const updatedTax = await prisma.tax.update({
      where: { id },
      data: data,
      select: {
        id: true,
        name: true,
        rate: true,
        type: true,
        taxType: true,
        hsnCode: true,
        country: true,
        state: true,
        zipCode: true,
        isActive: true,
        updatedAt: true,
      },
    });

    logger.info(`Tax updated: ${id}`);
    return updatedTax;
  }

  async deleteTax(taxId: any) {
    const id = Number(taxId);
    const tax = await prisma.tax.findUnique({
      where: { id },
    });

    if (!tax) {
      throw new AppError('Tax not found', 404);
    }

    await prisma.tax.delete({
      where: { id },
    });

    logger.info(`Tax deleted: ${id}`);
    return { message: 'Tax configuration deleted successfully' };
  }

  async getShippingConfigs(filters: {
    page: number;
    limit: number;
  }) {
    const { page, limit } = filters;
    const skip = (page - 1) * limit;

    const [shippingConfigs, total] = await Promise.all([
      prisma.shipping.findMany({
        select: {
          id: true,
          name: true,
          type: true,
          cost: true,
          minOrderAmount: true,
          countries: true,
          isActive: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.shipping.count(),
    ]);

    return {
      shippingConfigs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async createShippingConfig(data: any) {
    const shipping = await prisma.shipping.create({
      data: {
        name: data.name,
        type: data.type,
        cost: data.cost,
        minOrderAmount: data.minOrderAmount,
        countries: data.countries,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        type: true,
        cost: true,
        isActive: true,
        createdAt: true,
      },
    });

    logger.info(`Shipping created: ${shipping.name}`);
    return shipping;
  }

  async updateShippingConfig(shippingId: any, data: any) {
    const id = Number(shippingId);
    const shipping = await prisma.shipping.findUnique({
      where: { id },
    });

    if (!shipping) {
      throw new AppError('Shipping not found', 404);
    }

    const updatedShipping = await prisma.shipping.update({
      where: { id },
      data: data,
      select: {
        id: true,
        name: true,
        cost: true,
        isActive: true,
        updatedAt: true,
      },
    });

    logger.info(`Shipping updated: ${id}`);
    return updatedShipping;
  }

  async deleteShippingConfig(shippingId: any) {
    const id = Number(shippingId);
    const shipping = await prisma.shipping.findUnique({
      where: { id },
    });

    if (!shipping) {
      throw new AppError('Shipping not found', 404);
    }

    await prisma.shipping.delete({
      where: { id },
    });

    logger.info(`Shipping deleted: ${id}`);
    return { message: 'Shipping configuration deleted successfully' };
  }

  async getNotifications(filters: {
    page: number;
    limit: number;
  }) {
    const { page, limit } = filters;
    const skip = (page - 1) * limit;

    const [notifications, total] = await Promise.all([
      prisma.notification.findMany({
        select: {
          id: true,
          title: true,
          body: true,
          type: true,
          isRead: true,
          createdAt: true,
          user: {
            select: {
              email: true,
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.notification.count(),
    ]);

    const mappedNotifications = notifications.map(n => ({
      id: n.id,
      title: n.title,
      message: n.body,
      type: n.type,
      isRead: n.isRead,
      createdAt: n.createdAt,
      userEmail: n.user?.email || '',
    }));

    return {
      notifications: mappedNotifications,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async sendNotification(data: any) {
    const activeUsers = await prisma.user.findMany({
      where: { role: 'CUSTOMER', isActive: true, deletedAt: null },
      select: { id: true },
    });

    const notificationsData = activeUsers.map(u => ({
      userId: u.id,
      title: data.title,
      body: data.message,
      type: data.type || 'SYSTEM',
      channel: data.channel || 'PUSH',
    }));

    let notification;
    if (notificationsData.length > 0) {
      await prisma.notification.createMany({
        data: notificationsData,
      });
    }

    try {
      const { notificationQueue } = await import('../../../config/queue');

      if (data.deviceTokens && data.deviceTokens.length > 0) {
        for (const token of data.deviceTokens) {
          await notificationQueue.add('push-notification', {
            type: 'PUSH',
            data: {
              title: data.title,
              body: data.message,
              deviceToken: token,
              additionalData: {
                type: data.type,
              },
            },
          });
        }
      } else {
        console.log('Broadcast notification to all users');
      }
    } catch (err) {
      logger.error('Failed to queue push notifications:', err);
    }

    return {
      success: true,
      notification,
      message: 'Notification queued for sending',
    };
  }

  async getCollections(filters: {
    page: number;
    limit: number;
  }) {
    const { page, limit } = filters;
    const skip = (page - 1) * limit;

    const [collections, total] = await Promise.all([
      prisma.collection.findMany({
        select: {
          id: true,
          name: true,
          slug: true,
          description: true,
          imageUrl: true,
          isFeatured: true,
          sortOrder: true,
          createdAt: true,
        },
        orderBy: { sortOrder: 'asc' },
        skip,
        take: limit,
      }),
      prisma.collection.count(),
    ]);

    return {
      collections,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async createCollection(data: any) {
    const collection = await prisma.collection.create({
      data: {
        name: data.name,
        slug: data.slug,
        description: data.description,
        imageUrl: data.imageUrl,
        isFeatured: data.isFeatured || false,
        sortOrder: data.sortOrder || 0,
      },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        imageUrl: true,
        isFeatured: true,
        sortOrder: true,
        createdAt: true,
      },
    });

    logger.info(`Collection created: ${collection.name}`);
    return collection;
  }

  async updateCollection(collectionId: any, data: any) {
    const collection = await prisma.collection.findUnique({
      where: { id: parseInt(collectionId) },
    });

    if (!collection) {
      throw new AppError('Collection not found', 404);
    }

    const updated = await prisma.collection.update({
      where: { id: parseInt(collectionId) },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.imageUrl !== undefined && { imageUrl: data.imageUrl }),
        ...(data.isFeatured !== undefined && { isFeatured: data.isFeatured }),
        ...(data.sortOrder !== undefined && { sortOrder: data.sortOrder }),
      },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        imageUrl: true,
        isFeatured: true,
        sortOrder: true,
        createdAt: true,
      },
    });

    logger.info(`Collection updated: ${updated.name}`);
    return updated;
  }

  async deleteCollection(collectionId: any) {
    const collection = await prisma.collection.findUnique({
      where: { id: parseInt(collectionId) },
    });

    if (!collection) {
      throw new AppError('Collection not found', 404);
    }

    await prisma.collection.delete({
      where: { id: parseInt(collectionId) },
    });

    logger.info(`Collection deleted: ${collectionId}`);
    return { message: 'Collection deleted successfully' };
  }

  async uploadFile(file: any, apiBase?: string) {
    if (!file) {
      throw new AppError('No file provided', 400);
    }

    let url: string;
    const isCloudinaryConfigured = 
      Boolean(process.env.CLOUDINARY_URL) ||
      (Boolean(process.env.CLOUDINARY_CLOUD_NAME) && process.env.CLOUDINARY_CLOUD_NAME !== 'your-cloud-name');

    if (isCloudinaryConfigured) {
      try {
        const result = await cloudinary.uploader.upload(file.path, {
          folder: 'hopscotch',
          resource_type: 'image',
        });
        url = result.secure_url;
      } catch (err) {
        logger.error(`Cloudinary upload failed, falling back to local: ${err}`);
        const base = apiBase || process.env.API_URL || 'http://localhost:5001';
        url = `${base}/uploads/${file.filename}`;
      }
    } else {
      const base = apiBase || process.env.API_URL || 'http://localhost:5001';
      url = `${base}/uploads/${file.filename}`;
    }

    return { url };
  }

  async updateVariantStock(variantId: any, data: any) {
    const id = Number(variantId);
    const { stock, reason } = data;

    const variant = await prisma.productVariant.findUnique({
      where: { id },
    });

    if (!variant) {
      throw new AppError('Product variant not found', 404);
    }

    const updatedVariant = await prisma.productVariant.update({
      where: { id },
      data: { stock: parseInt(stock) },
    });

    // Sync to warehouse inventory
    let warehouse = await prisma.warehouse.findFirst({ where: { isDefault: true } });
    if (!warehouse) {
      warehouse = await prisma.warehouse.findFirst();
    }
    if (warehouse) {
      await prisma.warehouseInventory.upsert({
        where: {
          warehouseId_variantId: {
            warehouseId: warehouse.id,
            variantId: id,
          }
        },
        create: {
          warehouseId: warehouse.id,
          variantId: id,
          availableStock: parseInt(stock),
          minimumStock: 5,
        },
        update: {
          availableStock: parseInt(stock),
        }
      });
    }

    logger.info(`Variant stock updated: ${variantId}, new stock: ${stock}, reason: ${reason}`);
    return updatedVariant;
  }

  async createProductVariant(productId: any, data: any) {
    const pid = Number(productId);
    const { sku, barcode, size, color, material, pattern, price, stock } = data;

    const product = await prisma.product.findUnique({
      where: { id: pid },
    });

    if (!product) {
      throw new AppError('Product not found', 404);
    }

    const variant = await prisma.productVariant.create({
      data: {
        productId: pid,
        sku,
        barcode,
        size,
        color,
        material,
        pattern,
        price: parseFloat(price),
        stock: parseInt(stock) || 0,
      },
    });

    // Create corresponding WarehouseInventory record
    const warehouse = await this.getOrCreateDefaultWarehouse();
    await prisma.warehouseInventory.create({
      data: {
        variantId: variant.id,
        warehouseId: warehouse.id,
        availableStock: variant.stock,
        minimumStock: 5,
      }
    });

    logger.info(`Product variant created: ${variant.id} for product ${productId} with warehouse inventory`);
    return variant;
  }

  async updateProductVariant(productId: any, variantId: any, data: any) {
    const vid = Number(variantId);
    const pid = Number(productId);
    const { sku, barcode, size, color, material, pattern, price, stock } = data;

    const variant = await prisma.productVariant.findFirst({
      where: { id: vid, productId: pid },
    });

    if (!variant) {
      throw new AppError('Product variant not found', 404);
    }

    const updateData: any = {};
    if (sku !== undefined) updateData.sku = sku;
    if (barcode !== undefined) updateData.barcode = barcode;
    if (size !== undefined) updateData.size = size;
    if (color !== undefined) updateData.color = color;
    if (material !== undefined) updateData.material = material;
    if (pattern !== undefined) updateData.pattern = pattern;
    if (price !== undefined) updateData.price = parseFloat(price);
    if (stock !== undefined) updateData.stock = parseInt(stock);

    const updatedVariant = await prisma.productVariant.update({
      where: { id: vid },
      data: updateData,
    });

    // If stock changed, sync to WarehouseInventory
    if (stock !== undefined) {
      let warehouse = await prisma.warehouse.findFirst({ where: { isDefault: true } });
      if (!warehouse) {
        warehouse = await prisma.warehouse.findFirst();
      }
      if (warehouse) {
        await prisma.warehouseInventory.upsert({
          where: {
            warehouseId_variantId: {
              warehouseId: warehouse.id,
              variantId: vid,
            }
          },
          create: {
            warehouseId: warehouse.id,
            variantId: vid,
            availableStock: parseInt(stock),
            minimumStock: 5,
          },
          update: {
            availableStock: parseInt(stock),
          }
        });
      }
    }

    logger.info(`Product variant updated: ${variantId}`);
    return updatedVariant;
  }

  async getReviews(filters: {
    page: number;
    limit: number;
    status?: string;
    productId?: string;
  }) {
    const { page, limit, status, productId } = filters;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (status) {
      where.status = status;
    }
    if (productId) {
      where.productId = Number(productId);
    }

    const [reviews, total] = await Promise.all([
      prisma.review.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
          product: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.review.count({ where }),
    ]);

    logger.info(`Retrieved ${reviews.length} reviews (page ${page})`);
    return {
      reviews,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getReviewDetails(reviewId: any) {
    const id = Number(reviewId);
    const review = await prisma.review.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        product: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!review) {
      throw new AppError('Review not found', 404);
    }

    return review;
  }

  async updateReviewStatus(reviewId: any, data: { status: ReviewStatus }) {
    const id = Number(reviewId);
    const { status } = data;

    const review = await prisma.review.findUnique({
      where: { id },
    });

    if (!review) {
      throw new AppError('Review not found', 404);
    }

    const updatedReview = await prisma.review.update({
      where: { id },
      data: { status },
    });

    logger.info(`Review status updated: ${reviewId}, new status: ${status}`);
    return updatedReview;
  }

  async deleteReview(reviewId: any) {
    const id = Number(reviewId);

    const review = await prisma.review.findUnique({
      where: { id },
    });

    if (!review) {
      throw new AppError('Review not found', 404);
    }

    await prisma.review.delete({
      where: { id },
    });

    logger.info(`Review deleted: ${reviewId}`);
    return { message: 'Review deleted successfully' };
  }

  async getWishlist(filters: {
    page: number;
    limit: number;
    userId?: string;
  }) {
    const { page, limit, userId } = filters;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (userId) {
      where.userId = Number(userId);
    }

    const [wishlist, total] = await Promise.all([
      prisma.wishlistItem.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
          product: {
            select: {
              id: true,
              name: true,
              slug: true,
              basePrice: true,
              thumbnailUrl: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.wishlistItem.count({ where }),
    ]);

    logger.info(`Retrieved ${wishlist.length} wishlist items (page ${page})`);
    return {
      wishlist,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getCart(filters: {
    page: number;
    limit: number;
    userId?: string;
  }) {
    const { page, limit, userId } = filters;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (userId) {
      where.userId = Number(userId);
    }

    const [cart, total] = await Promise.all([
      prisma.cart.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
          items: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                  basePrice: true,
                  thumbnailUrl: true,
                },
              },
              variant: {
                select: {
                  id: true,
                  sku: true,
                  size: true,
                  color: true,
                  price: true,
                  stock: true,
                },
              },
            },
          },
        },
        orderBy: { updatedAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.cart.count({ where }),
    ]);

    logger.info(`Retrieved ${cart.length} carts (page ${page})`);
    return {
      cart,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}

export default new AdminService();
