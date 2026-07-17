import { AppError } from '../../../middleware/errorHandler';
import { logger } from '../../../utils/logger';
import prisma from '../../../utils/prisma';

export class ReportService {
  async getSalesReport(filters: {
    startDate?: string;
    endDate?: string;
    page: number;
    limit: number;
  }) {
    const { startDate, endDate, page, limit } = filters;
    const skip = (page - 1) * limit;

    const where: any = {};
  }
    if (startDate || endDate) {
      where.createdAt = {};
  }
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    const [orders, total, metrics] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          items: {
            include: {
              product: true,
            },
          },
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
      prisma.order.count({ where }),
      prisma.order.aggregate({
        where,
        _count: true,
        _sum: {
          totalAmount: true,
          subtotal: true,
          taxAmount: true,
          shippingAmount: true,
          discountAmount: true,
        },
        _avg: {
          totalAmount: true,
        },
      }),
    ]);

    return {
      orders,
      metrics: {
        totalOrders: metrics._count,
        totalRevenue: metrics._sum.totalAmount || 0,
        totalSubtotal: metrics._sum.subtotal || 0,
        totalTax: metrics._sum.taxAmount || 0,
        totalShipping: metrics._sum.shippingAmount || 0,
        totalDiscount: metrics._sum.discountAmount || 0,
        averageOrderValue: metrics._avg.totalAmount || 0,
      },
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
  }

  async getInventoryReport(filters: {
    lowStock?: boolean;
    warehouseId?: any;
    page: number;
    limit: number;
  }) {
    const { lowStock, warehouseId, page, limit } = filters;
    const skip = (page - 1) * limit;

    const where: any = {};
  }
    if (warehouseId) {
      where.warehouseId = warehouseId;
    }

    if (lowStock) {
      where.availableStock = {
        lte: prisma.warehouseInventory.fields.minimumStock,
      };
  }
    }

    const [inventoryItems, total, metrics] = await Promise.all([
      prisma.warehouseInventory.findMany({
        where,
        include: {
          variant: {
            include: {
              product: {
                include: {
                  images: {
                    where: { sortOrder: 0 },
                    take: 1,
                  },
                  category: true,
                  brand: true,
                },
              },
            },
          },
          warehouse: true,
          movements: {
            orderBy: { createdAt: 'desc' },
            take: 5,
          },
        },
        orderBy: { availableStock: 'asc' },
        skip,
        take: limit,
      }),
      prisma.warehouseInventory.count({ where }),
      prisma.warehouseInventory.aggregate({
        where,
        _count: true,
        _sum: {
          availableStock: true,
        },
      }),
    ]);

    return {
      inventoryItems,
      metrics: {
        totalItems: metrics._count,
        totalStock: metrics._sum.availableStock || 0,
        lowStockCount: lowStock ? metrics._count : 0,
      },
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
  }

  async getCustomerReport(filters: {
    startDate?: string;
    endDate?: string;
    page: number;
    limit: number;
  }) {
    const { startDate, endDate, page, limit } = filters;
    const skip = (page - 1) * limit;

    const where: any = {};
  }
    if (startDate || endDate) {
      where.createdAt = {};
  }
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    const [customers, total, metrics] = await Promise.all([
      prisma.user.findMany({
        where,
        include: {
          orders: {
            include: {
              items: true,
            },
          },
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
      prisma.user.aggregate({
        where,
        _count: true,
      }),
    ]);

    const totalSpentByCustomer = customers.map((customer: any) => ({
      ...customer,
      totalSpent: customer.orders.reduce((sum: number, order: any) => sum + Number(order.totalAmount), 0),
      averageOrderValue: customer.orders.length > 0 
        ? customer.orders.reduce((sum: number, order: any) => sum + Number(order.totalAmount), 0) / customer.orders.length 
        : 0,
    }));

    return {
      customers: totalSpentByCustomer,
      metrics: {
        totalCustomers: metrics._count,
        newCustomers: metrics._count,
      },
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
  }

  async getOrderReport(filters: {
    startDate?: string;
    endDate?: string;
    status?: string;
    page: number;
    limit: number;
  }) {
    const { startDate, endDate, status, page, limit } = filters;
    const skip = (page - 1) * limit;

    const where: any = {};
  }
    if (startDate || endDate) {
      where.createdAt = {};
  }
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    if (status) {
      where.status = status;
    }

    const [orders, total, statusMetrics] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          items: {
            include: {
              product: true,
            },
          },
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
          address: true,
          payment: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.order.count({ where }),
      prisma.order.groupBy({
        by: ['status'],
        where,
        _count: true,
        _sum: {
          totalAmount: true,
        },
      }),
    ]);

    const statusBreakdown = statusMetrics.reduce((acc: any, item: any) => {
      acc[item.status] = {
        count: item._count,
        totalAmount: item._sum.totalAmount || 0,
      };
  }
      return acc;
    }, {});

    return {
      orders,
      statusBreakdown,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
  }

  async getDashboardMetrics() {
    const [
      totalRevenue,
      totalOrders,
      totalCustomers,
      totalProducts,
      lowStockItems,
      pendingReturns,
      recentOrders,
      topSellingProducts,
    ] = await Promise.all([
      prisma.order.aggregate({
        where: {
          status: { in: ['DELIVERED', 'CONFIRMED', 'PROCESSING', 'SHIPPED'] },
        },
        _sum: {
          totalAmount: true,
        },
      }),
      prisma.order.count(),
      prisma.user.count(),
      prisma.product.count(),
      prisma.warehouseInventory.count({
        where: {
          availableStock: {
            lte: prisma.warehouseInventory.fields.minimumStock,
          },
        },
      }),
      prisma.returnRequest.count({
        where: {
          status: { in: ['REQUESTED', 'APPROVED'] },
        },
      }),
      prisma.order.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: {
          items: {
            include: {
              product: true,
            },
          },
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
      prisma.orderItem.groupBy({
        by: ['productId'],
        _sum: {
          quantity: true,
        },
        orderBy: {
          _sum: {
            quantity: 'desc',
          },
        },
        take: 10,
      }),
    ]);

    const topProductIds = topSellingProducts.map((item: any) => item.productId);
    const topProducts = await prisma.product.findMany({
      where: {
        id: { in: topProductIds },
      },
      include: {
        images: {
          where: { sortOrder: 0 },
          take: 1,
        },
        category: true,
        brand: true,
      },
    });

    return {
      totalRevenue: totalRevenue._sum.totalAmount || 0,
      totalOrders,
      totalCustomers,
      totalProducts,
      pendingOrders: 0,
      deliveredOrders: 0,
      cancelledOrders: 0,
      lowStockCount: lowStockItems,
      revenueGrowth: 0,
      ordersGrowth: 0,
      customersGrowth: 0,
      productsGrowth: 0,
      monthlySales: [],
      categoryBreakdown: [],
      topProducts: topProducts,
      recentOrders,
    };
  }

export default new ReportService();
