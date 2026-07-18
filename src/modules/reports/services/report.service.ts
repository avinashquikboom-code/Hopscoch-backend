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

    if (startDate || endDate) {
      where.createdAt = {};
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

  async getInventoryReport(filters: {
    lowStock?: boolean;
    warehouseId?: any;
    page: number;
    limit: number;
  }) {
    const { lowStock, warehouseId, page, limit } = filters;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (warehouseId) {
      where.warehouseId = warehouseId;
    }

    if (lowStock) {
      const lowStockItems = await prisma.$queryRaw<{ id: number }[]>`
        SELECT id FROM "warehouseInventory" WHERE "availableStock" <= "minimumStock"
      `;
      where.id = {
        in: lowStockItems.map((item: { id: number }) => item.id),
      };
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

  async getCustomerReport(filters: {
    startDate?: string;
    endDate?: string;
    page: number;
    limit: number;
  }) {
    const { startDate, endDate, page, limit } = filters;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (startDate || endDate) {
      where.createdAt = {};
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

    if (startDate || endDate) {
      where.createdAt = {};
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
      prisma.$queryRaw<{ count: bigint | number }[]>`
        SELECT COUNT(*)::int as count FROM "warehouseInventory" WHERE "availableStock" <= "minimumStock"
      `.then(res => Number(res[0]?.count || 0)),
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
      ordersLast6Months,
      pendingOrders,
      deliveredOrders,
      cancelledOrders,
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
      prisma.order.count({ where: { status: 'PENDING' } }),
      prisma.order.count({ where: { status: 'DELIVERED' } }),
      prisma.order.count({ where: { status: 'CANCELLED' } }),
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

    // Format topProducts mapping
    const formattedTopProducts = await Promise.all(
      topProducts.map(async (prod) => {
        const orderItems = await prisma.orderItem.findMany({
          where: { productId: prod.id },
          select: { quantity: true, priceSnapshot: true },
        });
        const revenue = orderItems.reduce((sum, oi) => sum + oi.quantity * Number(oi.priceSnapshot), 0);
        const sales = orderItems.reduce((sum, oi) => sum + oi.quantity, 0);
        return {
          name: prod.name,
          sales,
          revenue,
        };
      })
    );

    return {
      totalRevenue: revenueVal,
      totalOrders,
      totalCustomers,
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
      topProducts: formattedTopProducts,
      recentOrders,
    };
  }
}

export default new ReportService();
