import { AppError } from '../../../middleware/errorHandler';
import { logger } from '../../../utils/logger';
import prisma from '../../../utils/prisma';
import bcrypt from 'bcrypt';
import { Role, ProductStatus, OrderStatus, ReturnStatus, ReviewStatus } from '@prisma/client';
import { v2 as cloudinary } from 'cloudinary';

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

    const revenueVal = totalRevenue._sum.totalAmount || 0;

    return {
      totalRevenue: revenueVal,
      totalOrders,
      totalCustomers: totalUsers,
      totalProducts,
      pendingOrders,
      deliveredOrders,
      cancelledOrders,
      lowStockCount: lowStockItems,
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
          category: {
            select: {
              id: true,
              name: true,
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

    return {
      products,
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
    // Resolve slug
    let slug = data.slug;
    if (!slug && data.name) {
      slug = data.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') + '-' + Date.now();
    } else if (slug) {
      slug = slug.toLowerCase().replace(/\s+/g, '-');
    } else {
      slug = 'product-' + Date.now();
    }

    const product = await prisma.product.create({
      data: {
        name: data.name,
        slug: slug,
        description: data.description,
        categoryId: categoryId!,
        brandId: brandId!,
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

    const stockVal = data.stock !== undefined ? Number(data.stock) : 10;
    await prisma.productVariant.create({
      data: {
        productId: product.id,
        sku: data.sku || `${product.slug}-${Date.now().toString().slice(-4)}`,
        price: product.basePrice,
        stock: stockVal,
        color: 'Default',
        size: 'One Size',
      }
    });

    logger.info(`Product created: ${product.id} and default variant created with stock: ${stockVal}`);

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

    // Handle variant stock updates
    if (updateData.variants && Array.isArray(updateData.variants)) {
      for (const variant of updateData.variants) {
        if (variant.id && variant.stock !== undefined) {
          await prisma.productVariant.update({
            where: { id: Number(variant.id) },
            data: { stock: parseInt(variant.stock) },
          });
          logger.info(`Variant stock updated: ${variant.id}, new stock: ${variant.stock}`);
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
      delete updateData.price;
    }

    const updatedProduct = await prisma.product.update({
      where: { id },
      data: updateData,
      include: {
        category: true,
        brand: true,
        variants: true,
      },
    });

    logger.info(`Product updated: ${id}`);
    return updatedProduct;
  }

  async getProductDetails(productId: any) {
    const id = Number(productId);
    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        category: true,
        brand: true,
        images: {
          orderBy: { sortOrder: 'asc' },
        },
        variants: true,
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

    const updatedCategory = await prisma.category.update({
      where: { id },
      data,
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

    const updatedBrand = await prisma.brand.update({
      where: { id },
      data,
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
            },
          },
          address: {
            select: {
              id: true,
              city: true,
              state: true,
              country: true,
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
      where.availableStock = {
        lte: prisma.warehouseInventory.fields.minimumStock,
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

  async addInventory(data: {
    variantId: any;
    quantity: number;
    lowStockThreshold?: number;
    warehouseId?: any;
  }) {
    const variantId = Number(data.variantId);
    const warehouseId = data.warehouseId ? Number(data.warehouseId) : ((await prisma.warehouse.findFirst({ where: { isDefault: true } }))?.id || 1);

    let warehouse = await prisma.warehouse.findUnique({ where: { id: warehouseId } });
    if (!warehouse) {
      warehouse = await prisma.warehouse.create({
        data: {
          name: 'Default Warehouse',
          code: 'AURA-DEF-01',
          address: 'Default Address',
          city: 'N/A',
          state: 'N/A',
          country: 'India',
          pincode: '000000',
          phone: '0000000000',
          email: 'default@warehouse.com',
          status: 'ACTIVE',
        }
      });
    }

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

  async getSettings() {
    const settings = await prisma.systemSettings.findFirst();
    if (!settings) {
      return {
        siteName: 'Hopscotch',
        siteDescription: 'Luxury Fashion E-commerce',
        contactEmail: 'contact@hopscotch.com',
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
      process.env.CLOUDINARY_CLOUD_NAME && 
      process.env.CLOUDINARY_CLOUD_NAME !== 'your-cloud-name';

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
    const image = await prisma.productImage.create({
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

    logger.info(`Image uploaded: ${image.id} with URL: ${url}`);
    return image;
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
    const coupon = await prisma.coupon.create({
      data: {
        code: data.code,
        type: data.discountType,
        value: data.discountValue,
        maxDiscount: data.maxDiscount,
        minOrderValue: data.minPurchase,
        startsAt: data.startDate ? new Date(data.startDate) : new Date(),
        expiresAt: data.endDate ? new Date(data.endDate) : new Date(Date.now() + 365*24*60*60*1000),
        usageLimit: data.usageLimit,
        isActive: true,
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
        ...(data.discountType !== undefined && { type: data.discountType }),
        ...(data.discountValue !== undefined && { value: data.discountValue }),
        ...(data.maxDiscount !== undefined && { maxDiscount: data.maxDiscount }),
        ...(data.minPurchase !== undefined && { minOrderValue: data.minPurchase }),
        ...(data.startDate !== undefined && { startsAt: new Date(data.startDate) }),
        ...(data.endDate !== undefined && { expiresAt: new Date(data.endDate) }),
        ...(data.usageLimit !== undefined && { usageLimit: data.usageLimit }),
        ...(data.status !== undefined && { isActive: data.status === 'ACTIVE' }),
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
    const coupon = await prisma.coupon.findUnique({
      where: { id: couponId },
    });

    if (!coupon) {
      throw new AppError('Coupon not found', 404);
    }

    await prisma.coupon.delete({
      where: { id: couponId },
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
        country: data.country,
        state: data.state,
        zipCode: data.zipCode,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        rate: true,
        type: true,
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

  async uploadFile(file: any) {
    if (!file) {
      throw new AppError('No file provided', 400);
    }

    let url: string;
    const isCloudinaryConfigured = 
      process.env.CLOUDINARY_CLOUD_NAME && 
      process.env.CLOUDINARY_CLOUD_NAME !== 'your-cloud-name';

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

    logger.info(`Product variant created: ${variant.id} for product ${productId}`);
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
