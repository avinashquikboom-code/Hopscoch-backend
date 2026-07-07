import { AppError } from '../../../middleware/errorHandler';
import { logger } from '../../../utils/logger';
import prisma from '../../../utils/prisma';

export class InventoryService {
  async createStockMovement(data: {
    variantId: any;
    warehouseId: any;
    type: 'RESTOCK' | 'SALE' | 'RETURN' | 'ADJUSTMENT' | 'DAMAGE';
    quantityChange: number;
    reason?: string;
    referenceOrderId?: any;
  }) {
    const { variantId, warehouseId, type, quantityChange, reason, referenceOrderId } = data;

    // Find or create inventory item
    let inventoryItem = await prisma.inventoryItem.findUnique({
      where: {
        variantId_warehouseId: {
          variantId,
          warehouseId,
        },
      },
    });

    if (!inventoryItem) {
      // Create inventory item if it doesn't exist
      inventoryItem = await prisma.inventoryItem.create({
        data: {
          variantId,
          warehouseId,
          quantity: 0,
          lowStockThreshold: 5,
        },
      });
    }

    // Validate stock availability for SALE or DAMAGE
    if ((type === 'SALE' || type === 'DAMAGE') && inventoryItem.quantity + quantityChange < 0) {
      throw new AppError('Insufficient stock', 400);
    }

    // Create stock movement
    const movement = await prisma.stockMovement.create({
      data: {
        inventoryItemId: inventoryItem.id,
        type,
        quantityChange,
        reason,
        referenceOrderId,
      },
    });

    // Update inventory quantity
    const updatedInventoryItem = await prisma.inventoryItem.update({
      where: { id: inventoryItem.id },
      data: {
        quantity: {
          increment: quantityChange,
        },
      },
      include: {
        variant: {
          include: {
            product: {
              include: {
                images: {
                  where: { sortOrder: 0 },
                  take: 1,
                },
              },
            },
          },
        },
        warehouse: true,
      },
    });

    logger.info(`Stock movement created: ${movement.id} for variant: ${variantId}`);
    return {
      movement,
      inventoryItem: updatedInventoryItem,
    };
  }

  async getInventoryItems(filters: {
    page: number;
    limit: number;
    warehouseId?: any;
    lowStock?: boolean;
  }) {
    const { page, limit, warehouseId, lowStock } = filters;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (warehouseId) {
      where.warehouseId = Number(warehouseId);
    }

    if (lowStock) {
      where.quantity = {
        lte: prisma.inventoryItem.fields.lowStockThreshold,
      };
    }

    const [inventoryItems, total] = await Promise.all([
      prisma.inventoryItem.findMany({
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
            take: 10,
          },
        },
        orderBy: { updatedAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.inventoryItem.count({ where }),
    ]);

    return {
      inventoryItems,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getInventoryByVariant(variantId: any) {
    const inventoryItems = await prisma.inventoryItem.findMany({
      where: { variantId },
      include: {
        variant: {
          include: {
            product: {
              include: {
                images: true,
                category: true,
                brand: true,
              },
            },
          },
        },
        warehouse: true,
        movements: {
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
      },
    });

    if (inventoryItems.length === 0) {
      throw new AppError('Inventory not found for this variant', 404);
    }

    return inventoryItems;
  }

  async updateInventoryThreshold(data: {
    inventoryItemId: any;
    lowStockThreshold: number;
  }) {
    const { inventoryItemId, lowStockThreshold } = data;

    const inventoryItem = await prisma.inventoryItem.findUnique({
      where: { id: Number(inventoryItemId) },
    });

    if (!inventoryItem) {
      throw new AppError('Inventory item not found', 404);
    }

    const updatedInventoryItem = await prisma.inventoryItem.update({
      where: { id: Number(inventoryItemId) },
      data: { lowStockThreshold },
      include: {
        variant: {
          include: {
            product: true,
          },
        },
        warehouse: true,
      },
    });

    logger.info(`Inventory threshold updated: ${inventoryItemId} to ${lowStockThreshold}`);
    return updatedInventoryItem;
  }

  async getStockMovements(filters: {
    page: number;
    limit: number;
    inventoryItemId?: any;
    type?: string;
  }) {
    const { page, limit, inventoryItemId, type } = filters;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (inventoryItemId) {
      where.inventoryItemId = Number(inventoryItemId);
    }

    if (type) {
      where.type = type;
    }

    const [movements, total] = await Promise.all([
      prisma.stockMovement.findMany({
        where,
        include: {
          inventoryItem: {
            include: {
              variant: {
                include: {
                  product: true,
                },
              },
              warehouse: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.stockMovement.count({ where }),
    ]);

    return {
      movements,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getWarehouses() {
    const warehouses = await prisma.warehouse.findMany({
      include: {
        inventoryItems: {
          include: {
            variant: {
              include: {
                product: true,
              },
            },
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    return warehouses;
  }

  async getLowStockAlerts() {
    const lowStockItems = await prisma.inventoryItem.findMany({
      where: {
        quantity: {
          lte: prisma.inventoryItem.fields.lowStockThreshold,
        },
      },
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
              },
            },
          },
        },
        warehouse: true,
      },
      orderBy: [
        { quantity: 'asc' },
        { updatedAt: 'desc' },
      ],
    });

    return lowStockItems;
  }

  async createInventoryItem(data: {
    sku: string;
    name: string;
    category: string;
    stock: number;
    minStock: number;
    location: string;
    description?: string;
  }) {
    const { sku, name, category, stock, minStock, location, description } = data;

    // Find or create category
    let categoryRecord = await prisma.category.findFirst({
      where: { name: category },
    });

    if (!categoryRecord) {
      categoryRecord = await prisma.category.create({
        data: {
          name: category,
          slug: category.toLowerCase().replace(/\s+/g, '-'),
          sortOrder: 1,
          description: description || '',
        },
      });
    }

    // Create a default product
    const product = await prisma.product.create({
      data: {
        name,
        slug: name.toLowerCase().replace(/\s+/g, '-'),
        description: description || '',
        categoryId: categoryRecord.id,
        status: 'DRAFT',
        basePrice: 0,
        brandId: 1, // Default brand ID
      },
    });

    // Create a default variant
    const variant = await prisma.productVariant.create({
      data: {
        productId: product.id,
        sku,
        price: 0,
        size: 'Default',
        color: 'Default',
      },
    });

    // Find or create warehouse
    let warehouse = await prisma.warehouse.findFirst({
      where: { name: location },
    });

    if (!warehouse) {
      warehouse = await prisma.warehouse.create({
        data: {
          name: location,
          city: location,
          state: 'Default',
          pincode: '000000',
          isActive: true,
        },
      });
    }

    // Create inventory item
    const inventoryItem = await prisma.inventoryItem.create({
      data: {
        variantId: variant.id,
        warehouseId: warehouse.id,
        quantity: stock,
        lowStockThreshold: minStock,
      },
      include: {
        variant: {
          include: {
            product: {
              include: {
                category: true,
              },
            },
          },
        },
        warehouse: true,
      },
    });

    logger.info(`Inventory item created: ${inventoryItem.id} with SKU: ${sku}`);
    return inventoryItem;
  }
}

export default new InventoryService();
