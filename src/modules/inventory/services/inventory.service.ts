import { AppError } from '../../../middleware/errorHandler';
import { logger } from '../../../utils/logger';
import prisma from '../../../utils/prisma';
import { Prisma, WarehouseStatus, StockMovementType } from '@prisma/client';
import { getDefaultWarehouse } from './warehouse.service';

type Tx = Omit<
  typeof prisma,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

async function resolveWarehouseId(warehouseId?: number): Promise<number> {
  if (warehouseId) return warehouseId;
  return (await getDefaultWarehouse()).id;
}

async function getOrCreateInventory(tx: Tx, warehouseId: number, variantId: number) {
  let inv = await tx.warehouseInventory.findUnique({
    where: { warehouseId_variantId: { warehouseId, variantId } },
  });
  if (!inv) {
    inv = await tx.warehouseInventory.create({
      data: {
        warehouseId,
        variantId,
        availableStock: 0,
        reservedStock: 0,
        soldStock: 0,
        returnedStock: 0,
        damagedStock: 0,
        minimumStock: 5,
      },
    });
  }
  return inv;
}

async function logMovement(
  tx: Tx,
  inv: { id: number; warehouseId: number; variantId: number },
  type: StockMovementType,
  quantity: number,
  previousStock: number,
  newStock: number,
  reference?: string,
  note?: string,
  createdById?: string
) {
  await tx.stockMovement.create({
    data: {
      warehouseId: inv.warehouseId,
      variantId: inv.variantId,
      inventoryId: inv.id,
      type,
      quantity: Math.abs(quantity),
      previousStock,
      newStock,
      reference: reference || null,
      note: note || null,
      createdById: createdById || null,
    },
  });
}

export class InventoryService {
  async createStockMovement(data: {
    variantId: number;
    warehouseId: number;
    type: StockMovementType;
    quantityChange: number;
    reason?: string;
    referenceOrderId?: string;
  }) {
    const { variantId, warehouseId, type, quantityChange, reason, referenceOrderId } = data;

    return prisma.$transaction(async (tx) => {
      const inv = await getOrCreateInventory(tx, warehouseId, variantId);

      // Validate stock availability for SALE or adjustments
      if (quantityChange < 0 && inv.availableStock + quantityChange < 0) {
        throw new AppError('Insufficient stock', 400);
      }

      const prevStock = inv.availableStock;
      const updated = await tx.warehouseInventory.update({
        where: { id: inv.id },
        data: {
          availableStock: {
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

      await logMovement(
        tx,
        inv,
        type,
        quantityChange,
        prevStock,
        updated.availableStock,
        referenceOrderId,
        reason
      );

      // Calculate total stock of this variant across all warehouses
      const allInventoryItems = await tx.warehouseInventory.findMany({
        where: { variantId },
      });
      const totalStock = allInventoryItems.reduce((acc, item) => acc + item.availableStock, 0);

      // Update ProductVariant stock
      await tx.productVariant.update({
        where: { id: variantId },
        data: { stock: totalStock },
      });

      return {
        inventoryItem: updated,
      };
    });
  }

  async getInventoryItems(filters: {
    page: number;
    limit: number;
    warehouseId?: number;
    lowStock?: boolean;
  }) {
    const { page, limit, warehouseId, lowStock } = filters;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (warehouseId) {
      where.warehouseId = warehouseId;
    }

    if (lowStock) {
      where.availableStock = {
        lte: prisma.warehouseInventory.fields.minimumStock,
      };
    }

    const [inventoryItems, total] = await Promise.all([
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
            take: 10,
          },
        },
        orderBy: { updatedAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.warehouseInventory.count({ where }),
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

  async getInventoryByVariant(variantId: number) {
    const inventoryItems = await prisma.warehouseInventory.findMany({
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
    inventoryItemId: number;
    lowStockThreshold: number;
  }) {
    const { inventoryItemId, lowStockThreshold } = data;

    const inventoryItem = await prisma.warehouseInventory.findUnique({
      where: { id: inventoryItemId },
    });

    if (!inventoryItem) {
      throw new AppError('Inventory item not found', 404);
    }

    const updatedInventoryItem = await prisma.warehouseInventory.update({
      where: { id: inventoryItemId },
      data: { minimumStock: lowStockThreshold },
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
    inventoryItemId?: number;
    type?: StockMovementType;
  }) {
    const { page, limit, inventoryItemId, type } = filters;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (inventoryItemId) {
      where.inventoryId = inventoryItemId;
    }

    if (type) {
      where.type = type;
    }

    const [movements, total] = await Promise.all([
      prisma.stockMovement.findMany({
        where,
        include: {
          inventory: {
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
    return prisma.warehouse.findMany({
      include: {
        inventory: {
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
  }

  async getLowStockAlerts() {
    return prisma.warehouseInventory.findMany({
      where: {
        availableStock: {
          lte: prisma.warehouseInventory.fields.minimumStock,
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
        { availableStock: 'asc' },
        { updatedAt: 'desc' },
      ],
    });
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
          code: `WH-${location.toUpperCase().replace(/\s+/g, '-')}`,
          address: 'Default Address',
          city: location,
          state: 'Default State',
          country: 'India',
          pincode: '000000',
          phone: '0000000000',
          email: 'default@warehouse.com',
          status: 'ACTIVE',
        },
      });
    }

    // Create inventory item
    const inventoryItem = await prisma.warehouseInventory.create({
      data: {
        variantId: variant.id,
        warehouseId: warehouse.id,
        availableStock: stock,
        minimumStock: minStock,
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

  async updateInventoryItem(
    id: number,
    data: { name?: string; sku?: string; stock?: number; minStock?: number; location?: string }
  ) {
    const item = await prisma.warehouseInventory.findUnique({
      where: { id },
      include: { variant: { include: { product: true } } },
    });

    if (!item) {
      throw new AppError('Inventory item not found', 404);
    }

    const updateData: any = {};

    if (data.minStock !== undefined) {
      updateData.minimumStock = data.minStock;
    }

    if (data.location !== undefined) {
      let warehouse = await prisma.warehouse.findFirst({
        where: { name: data.location },
      });

      if (!warehouse) {
        warehouse = await prisma.warehouse.create({
          data: {
            name: data.location,
            code: `WH-${data.location.toUpperCase().replace(/\s+/g, '-')}`,
            address: 'Default Address',
            city: data.location,
            state: 'Default State',
            country: 'India',
            pincode: '000000',
            phone: '0000000000',
            email: 'default@warehouse.com',
            status: 'ACTIVE',
          },
        });
      }
      updateData.warehouseId = warehouse.id;
    }

    if (data.stock !== undefined) {
      updateData.availableStock = data.stock;
    }

    const updatedItem = await prisma.warehouseInventory.update({
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
    const item = await prisma.warehouseInventory.findUnique({
      where: { id },
    });

    if (!item) {
      throw new AppError('Inventory item not found', 404);
    }

    await prisma.warehouseInventory.delete({
      where: { id },
    });

    return { message: 'Inventory item deleted successfully' };
  }
}

export default new InventoryService();

// ── NEW WAREHOUSE/INVENTORY ADVANCED FLOW INTEGRATIONS ──

// Order created → reserve stock (available → reserved)
export async function reserveStock(
  items: { variantId: number; quantity: number }[],
  orderRef: string,
  warehouseId?: number
) {
  const whId = await resolveWarehouseId(warehouseId);

  return prisma.$transaction(async (tx) => {
    for (const item of items) {
      const inv = await getOrCreateInventory(tx, whId, item.variantId);
      if (inv.availableStock < item.quantity) {
        throw new Error(`Insufficient stock for variant ${item.variantId}`);
      }
      const updated = await tx.warehouseInventory.update({
        where: { id: inv.id },
        data: {
          availableStock: { decrement: item.quantity },
          reservedStock: { increment: item.quantity },
        },
      });
      await logMovement(
        tx,
        inv,
        StockMovementType.RESERVE,
        item.quantity,
        inv.availableStock,
        updated.availableStock,
        orderRef
      );

      // Recalculate total stock of this variant across all warehouses
      const allInventoryItems = await tx.warehouseInventory.findMany({
        where: { variantId: item.variantId },
      });
      const totalStock = allInventoryItems.reduce((acc, i) => acc + i.availableStock, 0);

      // Update ProductVariant stock
      await tx.productVariant.update({
        where: { id: item.variantId },
        data: { stock: totalStock },
      });
    }
  });
}

// Payment success → reserved becomes sold
export async function confirmSale(
  items: { variantId: number; quantity: number }[],
  orderRef: string,
  warehouseId?: number
) {
  const whId = await resolveWarehouseId(warehouseId);

  return prisma.$transaction(async (tx) => {
    for (const item of items) {
      const inv = await tx.warehouseInventory.findUniqueOrThrow({
        where: { warehouseId_variantId: { warehouseId: whId, variantId: item.variantId } },
      });
      if (inv.reservedStock < item.quantity) {
        throw new Error(`Reservation missing for variant ${item.variantId}`);
      }
      await tx.warehouseInventory.update({
        where: { id: inv.id },
        data: {
          reservedStock: { decrement: item.quantity },
          soldStock: { increment: item.quantity },
        },
      });
      await logMovement(
        tx,
        inv,
        StockMovementType.SALE,
        item.quantity,
        inv.availableStock,
        inv.availableStock,
        orderRef
      );
    }
  });
}

// Payment failed / order cancelled before payment → release reservation
export async function releaseReservation(
  items: { variantId: number; quantity: number }[],
  orderRef: string,
  warehouseId?: number
) {
  const whId = await resolveWarehouseId(warehouseId);

  return prisma.$transaction(async (tx) => {
    for (const item of items) {
      const inv = await tx.warehouseInventory.findUniqueOrThrow({
        where: { warehouseId_variantId: { warehouseId: whId, variantId: item.variantId } },
      });
      const qty = Math.min(inv.reservedStock, item.quantity);
      const updated = await tx.warehouseInventory.update({
        where: { id: inv.id },
        data: {
          reservedStock: { decrement: qty },
          availableStock: { increment: qty },
        },
      });
      await logMovement(
        tx,
        inv,
        StockMovementType.RELEASE,
        qty,
        inv.availableStock,
        updated.availableStock,
        orderRef
      );

      // Recalculate total stock of this variant across all warehouses
      const allInventoryItems = await tx.warehouseInventory.findMany({
        where: { variantId: item.variantId },
      });
      const totalStock = allInventoryItems.reduce((acc, i) => acc + i.availableStock, 0);

      // Update ProductVariant stock
      await tx.productVariant.update({
        where: { id: item.variantId },
        data: { stock: totalStock },
      });
    }
  });
}

// After warehouse inspection: sellable → back to available; else damaged
export async function processReturn(
  variantId: number,
  quantity: number,
  sellable: boolean,
  returnRef: string,
  adminId?: string,
  warehouseId?: number
) {
  const whId = await resolveWarehouseId(warehouseId);

  return prisma.$transaction(async (tx) => {
    const inv = await getOrCreateInventory(tx, whId, variantId);

    const data: Prisma.WarehouseInventoryUpdateInput = sellable
      ? {
          availableStock: { increment: quantity },
          returnedStock: { increment: quantity },
          soldStock: { decrement: Math.min(inv.soldStock, quantity) },
        }
      : {
          damagedStock: { increment: quantity },
          soldStock: { decrement: Math.min(inv.soldStock, quantity) },
        };

    const updated = await tx.warehouseInventory.update({ where: { id: inv.id }, data });

    await logMovement(
      tx,
      inv,
      StockMovementType.RETURN,
      quantity,
      inv.availableStock,
      updated.availableStock,
      returnRef,
      sellable ? 'Inspection passed — restocked' : 'Inspection failed — damaged',
      adminId
    );

    // Recalculate total stock of this variant across all warehouses
    const allInventoryItems = await tx.warehouseInventory.findMany({
      where: { variantId },
    });
    const totalStock = allInventoryItems.reduce((acc, i) => acc + i.availableStock, 0);

    // Update ProductVariant stock
    await tx.productVariant.update({
      where: { id: variantId },
      data: { stock: totalStock },
    });
  });
}

// Restock / purchase inward
export async function restock(
  variantId: number,
  quantity: number,
  adminId: string,
  note?: string,
  warehouseId?: number
) {
  const whId = await resolveWarehouseId(warehouseId);

  return prisma.$transaction(async (tx) => {
    const inv = await getOrCreateInventory(tx, whId, variantId);
    const updated = await tx.warehouseInventory.update({
      where: { id: inv.id },
      data: { availableStock: { increment: quantity } },
    });
    await logMovement(
      tx,
      inv,
      StockMovementType.RESTOCK,
      quantity,
      inv.availableStock,
      updated.availableStock,
      undefined,
      note,
      adminId
    );

    // Recalculate total stock of this variant across all warehouses
    const allInventoryItems = await tx.warehouseInventory.findMany({
      where: { variantId },
    });
    const totalStock = allInventoryItems.reduce((acc, i) => acc + i.availableStock, 0);

    // Update ProductVariant stock
    await tx.productVariant.update({
      where: { id: variantId },
      data: { stock: totalStock },
    });
  });
}

// Manual adjustment — delta can be negative (shrinkage) or positive (audit found)
export async function adjustStock(
  variantId: number,
  delta: number,
  reason: string,
  adminId: string,
  warehouseId?: number
) {
  const whId = await resolveWarehouseId(warehouseId);

  return prisma.$transaction(async (tx) => {
    const inv = await getOrCreateInventory(tx, whId, variantId);
    if (inv.availableStock + delta < 0) {
      throw new Error('Adjustment would make stock negative');
    }
    const updated = await tx.warehouseInventory.update({
      where: { id: inv.id },
      data: { availableStock: { increment: delta } },
    });
    await logMovement(
      tx,
      inv,
      StockMovementType.ADJUSTMENT,
      delta,
      inv.availableStock,
      updated.availableStock,
      undefined,
      reason,
      adminId
    );

    // Recalculate total stock of this variant across all warehouses
    const allInventoryItems = await tx.warehouseInventory.findMany({
      where: { variantId },
    });
    const totalStock = allInventoryItems.reduce((acc, i) => acc + i.availableStock, 0);

    // Update ProductVariant stock
    await tx.productVariant.update({
      where: { id: variantId },
      data: { stock: totalStock },
    });
  });
}

export async function listInventory(params: {
  page?: number;
  limit?: number;
  search?: string;
  warehouseId?: number;
}) {
  const page = Math.max(1, params.page ?? 1);
  const limit = Math.min(100, params.limit ?? 20);
  const whId = await resolveWarehouseId(params.warehouseId);

  const where: Prisma.WarehouseInventoryWhereInput = {
    warehouseId: whId,
    ...(params.search && {
      variant: {
        OR: [
          { sku: { contains: params.search, mode: 'insensitive' } },
          { product: { name: { contains: params.search, mode: 'insensitive' } } },
        ],
      },
    }),
  };

  const [items, total] = await Promise.all([
    prisma.warehouseInventory.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      include: { variant: { include: { product: { select: { name: true } } } } },
      orderBy: { updatedAt: 'desc' },
    }),
    prisma.warehouseInventory.count({ where }),
  ]);

  return { items, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
}

export async function stockHistory(variantId: number, page = 1, limit = 30) {
  return prisma.stockMovement.findMany({
    where: { variantId },
    orderBy: { createdAt: 'desc' },
    skip: (page - 1) * limit,
    take: limit,
  });
}

export async function lowStockReport(warehouseId?: number) {
  const whId = await resolveWarehouseId(warehouseId);

  const rows = await prisma.warehouseInventory.findMany({
    where: {
      warehouseId: whId,
      availableStock: {
        lte: prisma.warehouseInventory.fields.minimumStock,
      },
    },
    include: {
      variant: {
        include: {
          product: {
            select: { name: true },
          },
        },
      },
    },
    orderBy: { availableStock: 'asc' },
  });

  return {
    outOfStock: rows.filter((r) => r.availableStock === 0),
    lowStock: rows.filter((r) => r.availableStock > 0),
  };
}
