import { AppError } from '../../../middleware/errorHandler';
import { logger } from '../../../utils/logger';
import prisma from '../../../utils/prisma';
import bcrypt from 'bcrypt';

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

  async updateAdminUser(userId: string, data: {
    firstName?: string;
    lastName?: string;
    email?: string;
    role?: 'CUSTOMER' | 'ADMIN';
    isActive?: boolean;
  }) {
    const { firstName, lastName, email, role, isActive } = data;

    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
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
      where: { id: userId },
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

  async deleteAdminUser(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new AppError('User not found', 404);
    }

    // Soft delete
    await prisma.user.update({
      where: { id: userId },
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
    userId?: string;
    action?: string;
    startDate?: string;
    endDate?: string;
  }) {
    const { page, limit, userId, action, startDate, endDate } = filters;
    const skip = (page - 1) * limit;

    // Since we don't have an ActivityLog table in the schema, we'll use AnalyticsEvent as a proxy
    const where: any = {};
    if (userId) {
      where.userId = userId;
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
      recentActivity,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { isActive: true } }),
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
      prisma.inventoryItem.count({
        where: {
          quantity: {
            lte: prisma.inventoryItem.fields.lowStockThreshold,
          },
        },
      }),
      prisma.analyticsEvent.findMany({
        take: 20,
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
    ]);

    return {
      stats: {
        totalUsers,
        activeUsers,
        totalOrders,
        totalRevenue: totalRevenue._sum.totalAmount || 0,
        pendingReturns,
        lowStockItems,
      },
      recentActivity,
    };
  }
}

export default new AdminService();
