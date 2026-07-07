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

    // Calculate total stock of this variant across all warehouses
    const allInventoryItems = await prisma.inventoryItem.findMany({
      where: { variantId },
    });
    const totalStock = allInventoryItems.reduce((acc, item) => acc + item.quantity, 0);

    // Update ProductVariant stock
    await prisma.productVariant.update({
      where: { id: variantId },
      data: { stock: totalStock },
    });

    logger.info(`Stock movement created: ${movement.id} for variant: ${variantId}, total stock set to: ${totalStock}`);
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

    // Find or create default brand
    let brand = await prisma.brand.findFirst();
    if (!brand) {
      brand = await prisma.brand.create({
        data: {
          name: 'Default Brand',
          slug: 'default-brand',
          description: 'Default brand for inventory items',
        },
      });
    }

    // Ensure unique product slug
    const baseSlug = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    let slug = baseSlug || 'default-product';
    let count = 1;
    while (await prisma.product.findUnique({ where: { slug } })) {
      slug = `${baseSlug}-${count}`;
      count++;
    }

    // Create a default product
    const product = await prisma.product.create({
      data: {
        name,
        slug,
        description: description || '',
        categoryId: categoryRecord.id,
        status: 'DRAFT',
        basePrice: 0,
        brandId: brand.id,
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

    // Update ProductVariant stock
    await prisma.productVariant.update({
      where: { id: variant.id },
      data: { stock: stock },
    });

    logger.info(`Inventory item created: ${inventoryItem.id} with SKU: ${sku}`);
    return inventoryItem;
  }

  async updateInventoryItem(id: number, data: { name?: string; sku?: string; stock?: number; minStock?: number; location?: string }) {
    const item = await prisma.inventoryItem.findUnique({
      where: { id },
      include: { variant: { include: { product: true } } }
    });

    if (!item) {
      throw new AppError('Inventory item not found', 404);
    }

    const updateData: any = {};

    if (data.minStock !== undefined) {
      updateData.lowStockThreshold = data.minStock;
    }

    if (data.location !== undefined) {
      let warehouse = await prisma.warehouse.findFirst({
        where: { name: data.location },
      });

      if (!warehouse) {
        warehouse = await prisma.warehouse.create({
          data: {
            name: data.location,
            city: data.location,
            state: 'Default',
            pincode: '000000',
            isActive: true,
          },
        });
      }
      updateData.warehouseId = warehouse.id;
    }

    if (data.stock !== undefined) {
      updateData.quantity = data.stock;
    }

    const updatedItem = await prisma.inventoryItem.update({
      where: { id },
      data: updateData,
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

    // Also update the variant's stock / SKU if changed
    const variantUpdateData: any = {};
    if (data.stock !== undefined) {
      variantUpdateData.stock = data.stock;
    }
    if (data.sku !== undefined) {
      variantUpdateData.sku = data.sku;
    }

    if (Object.keys(variantUpdateData).length > 0) {
      await prisma.productVariant.update({
        where: { id: item.variantId },
        data: variantUpdateData,
      });
    }

    // Also update the product's name if changed
    if (data.name !== undefined) {
      await prisma.product.update({
        where: { id: item.variant.productId },
        data: { name: data.name },
      });
    }

    return updatedItem;
  }

  async deleteInventoryItem(id: number) {
    const item = await prisma.inventoryItem.findUnique({
      where: { id },
    });

    if (!item) {
      throw new AppError('Inventory item not found', 404);
    }

    await prisma.inventoryItem.delete({
      where: { id },
    });

    return { message: 'Inventory item deleted successfully' };
  }
}

export default new InventoryService();
