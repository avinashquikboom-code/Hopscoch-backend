import { Gender, AgeGroup, ProductStatus, Role, WarehouseStatus, OrderStatus } from '@prisma/client';
import bcrypt from 'bcrypt';
import prisma from '../src/utils/prisma';

async function main() {
  console.log('🌱 Start seeding mock database...');

  // Clean up existing records to ensure clean idempotent run
  console.log('Cleaning up existing database records...');
  await prisma.payment.deleteMany();
  await prisma.orderTimelineEvent.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.warehouseInventory.deleteMany();
  await prisma.productVariant.deleteMany();
  await prisma.address.deleteMany();
  await prisma.user.deleteMany({ where: { role: { not: Role.ADMIN } } });

  // 0. Create Admin User
  console.log('Creating admin user...');
  const hashedPassword = await bcrypt.hash('123456', 10);
  
  await prisma.user.upsert({
    where: { email: 'admin@gmail.com' },
    update: {},
    create: {
      email: 'admin@gmail.com',
      passwordHash: hashedPassword,
      role: Role.ADMIN,
      firstName: 'Admin',
      lastName: 'User',
      isEmailVerified: true,
      isActive: true,
    },
  });

  // 1. Create Brands
  console.log('Creating brands...');
  const brand1 = await prisma.brand.upsert({
    where: { name: 'Zara' },
    update: {},
    create: {
      name: 'Zara',
      slug: 'zara',
      description: 'High-street fashion brand from Spain',
      isFeatured: true,
    },
  });

  const brand2 = await prisma.brand.upsert({
    where: { name: 'FabIndia' },
    update: {},
    create: {
      name: 'FabIndia',
      slug: 'fabindia',
      description: 'Ethnic Indian handloom garments',
      isFeatured: true,
    },
  });

  const brand3 = await prisma.brand.upsert({
    where: { name: 'Denim Co' },
    update: {},
    create: {
      name: 'Denim Co',
      slug: 'denim-co',
      description: 'Quality denim for all seasons',
      isFeatured: false,
    },
  });

  // 2. Create Categories
  console.log('Creating categories...');
  const catApparel = await prisma.category.upsert({
    where: { slug: 'apparel' },
    update: {},
    create: {
      name: 'Apparel',
      slug: 'apparel',
      description: 'Clothing and garments',
      isFeatured: true,
    },
  });

  const catKurta = await prisma.category.upsert({
    where: { slug: 'kurta' },
    update: {},
    create: {
      name: 'Kurta',
      slug: 'kurta',
      description: 'Indian traditional tunics',
      parentId: catApparel.id,
      isFeatured: true,
    },
  });

  // 2.5. Create Default Warehouse
  console.log('Creating default warehouse...');
  const defaultWarehouse = await prisma.warehouse.upsert({
    where: { code: 'AURA-MUM-01' },
    update: {},
    create: {
      name: 'FCI SELLER Main Warehouse',
      code: 'AURA-MUM-01',
      address: 'Sector 8, Kopar Khairane',
      city: 'Navi Mumbai',
      state: 'Maharashtra',
      pincode: '400709',
      phone: '9876543210',
      email: 'warehouse@fciseller.com',
      isDefault: true,
      shiprocketPickupName: 'Primary',
      status: WarehouseStatus.ACTIVE,
    },
  });

  // 3. Create Products
  console.log('Creating products...');
  
  // Product 1: Classic Leather Jacket
  const product1 = await prisma.product.upsert({
    where: { slug: 'classic-leather-jacket' },
    update: {},
    create: {
      name: 'Classic Leather Jacket',
      slug: 'classic-leather-jacket',
      description: 'A stylish and durable classic leather jacket, perfect for winter and casual outings.',
      status: ProductStatus.PUBLISHED,
      categoryId: catApparel.id,
      brandId: brand1.id,
      basePrice: 89.99,
      gender: Gender.UNISEX,
      ageGroup: AgeGroup.ADULT,
      isFeatured: true,
      avgRating: 4.5,
      reviewCount: 12,
      images: {
        create: [
          {
            url: 'assets/images/products/leather_jacket.jpg',
            altText: 'Classic Leather Jacket Front View',
            sortOrder: 0,
          },
        ],
      },
    },
  });

  // Product 2: Denim Trucker Jacket
  const product2 = await prisma.product.upsert({
    where: { slug: 'denim-trucker-jacket' },
    update: {},
    create: {
      name: 'Denim Trucker Jacket',
      slug: 'denim-trucker-jacket',
      description: 'Perfect casual denim jacket for everyday wear. Heavyweight denim with copper buttons.',
      status: ProductStatus.PUBLISHED,
      categoryId: catApparel.id,
      brandId: brand3.id,
      basePrice: 59.99,
      gender: Gender.MALE,
      ageGroup: AgeGroup.ADULT,
      isFeatured: true,
      avgRating: 4.2,
      reviewCount: 8,
      images: {
        create: [
          {
            url: 'assets/images/products/denim_jacket.jpg',
            altText: 'Denim Trucker Jacket Front View',
            sortOrder: 0,
          },
        ],
      },
    },
  });

  // Product 3: Floral Print Kurta
  const product3 = await prisma.product.upsert({
    where: { slug: 'floral-print-kurta' },
    update: {},
    create: {
      name: 'Floral Print Kurta',
      slug: 'floral-print-kurta',
      description: 'Cotton printed ethnic traditional kurta. Breathable fabric suitable for summer festivals.',
      status: ProductStatus.PUBLISHED,
      categoryId: catKurta.id,
      brandId: brand2.id,
      basePrice: 49.99,
      gender: Gender.FEMALE,
      ageGroup: AgeGroup.ADULT,
      isFeatured: true,
      avgRating: 4.7,
      reviewCount: 22,
      images: {
        create: [
          {
            url: 'assets/images/products/floral_kurta.jpg',
            altText: 'Floral Print Kurta Front View',
            sortOrder: 0,
          },
        ],
      },
    },
  });

  // 4. Create Customers
  console.log('Creating customer users...');
  const customersData = [
    { email: 'john@gmail.com', firstName: 'John', lastName: 'Doe' },
    { email: 'jane@gmail.com', firstName: 'Jane', lastName: 'Smith' },
    { email: 'amit@gmail.com', firstName: 'Amit', lastName: 'Sharma' },
    { email: 'priya@gmail.com', firstName: 'Priya', lastName: 'Patel' },
  ];
  
  const customers = [];
  for (const c of customersData) {
    const user = await prisma.user.upsert({
      where: { email: c.email },
      update: {},
      create: {
        email: c.email,
        passwordHash: hashedPassword,
        role: Role.CUSTOMER,
        firstName: c.firstName,
        lastName: c.lastName,
        isEmailVerified: true,
        isActive: true,
      },
    });
    
    // Create address
    await prisma.address.create({
      data: {
        userId: user.id,
        fullName: `${c.firstName} ${c.lastName}`,
        phone: '9876543210',
        line1: '123 Fashion Street',
        city: 'Mumbai',
        state: 'Maharashtra',
        country: 'India',
        pincode: '400001',
        isDefault: true,
      },
    });
    
    customers.push(user);
  }

  // 5. Create Product Variants and warehouse inventories
  console.log('Creating variants and inventories...');
  const variants = [];
  
  // Product 1 variants
  const p1_variants = [
    { sku: 'CLJ-BLK-S', size: 'S', color: 'Black', price: 89.99, stock: 12 },
    { sku: 'CLJ-BLK-M', size: 'M', color: 'Black', price: 89.99, stock: 3 }, // low stock
    { sku: 'CLJ-BLK-L', size: 'L', color: 'Black', price: 89.99, stock: 0 }, // out of stock
  ];
  for (const v of p1_variants) {
    const variant = await prisma.productVariant.upsert({
      where: { sku: v.sku },
      update: { stock: v.stock },
      create: {
        productId: product1.id,
        sku: v.sku,
        size: v.size,
        color: v.color,
        price: v.price,
        stock: v.stock,
      },
    });
    
    await prisma.warehouseInventory.upsert({
      where: { warehouseId_variantId: { warehouseId: defaultWarehouse.id, variantId: variant.id } },
      update: { availableStock: v.stock },
      create: {
        warehouseId: defaultWarehouse.id,
        variantId: variant.id,
        availableStock: v.stock,
        soldStock: 5,
        minimumStock: 5,
      },
    });
    variants.push(variant);
  }

  // Product 2 variants
  const p2_variants = [
    { sku: 'DTJ-BLU-M', size: 'M', color: 'Blue', price: 59.99, stock: 20 },
    { sku: 'DTJ-BLU-L', size: 'L', color: 'Blue', price: 59.99, stock: 15 },
  ];
  for (const v of p2_variants) {
    const variant = await prisma.productVariant.upsert({
      where: { sku: v.sku },
      update: { stock: v.stock },
      create: {
        productId: product2.id,
        sku: v.sku,
        size: v.size,
        color: v.color,
        price: v.price,
        stock: v.stock,
      },
    });
    await prisma.warehouseInventory.upsert({
      where: { warehouseId_variantId: { warehouseId: defaultWarehouse.id, variantId: variant.id } },
      update: { availableStock: v.stock },
      create: {
        warehouseId: defaultWarehouse.id,
        variantId: variant.id,
        availableStock: v.stock,
        soldStock: 8,
        minimumStock: 5,
      },
    });
    variants.push(variant);
  }

  // Product 3 variants
  const p3_variants = [
    { sku: 'FPK-RED-S', size: 'S', color: 'Red', price: 49.99, stock: 8 },
    { sku: 'FPK-RED-M', size: 'M', color: 'Red', price: 49.99, stock: 25 },
  ];
  for (const v of p3_variants) {
    const variant = await prisma.productVariant.upsert({
      where: { sku: v.sku },
      update: { stock: v.stock },
      create: {
        productId: product3.id,
        sku: v.sku,
        size: v.size,
        color: v.color,
        price: v.price,
        stock: v.stock,
      },
    });
    await prisma.warehouseInventory.upsert({
      where: { warehouseId_variantId: { warehouseId: defaultWarehouse.id, variantId: variant.id } },
      update: { availableStock: v.stock },
      create: {
        warehouseId: defaultWarehouse.id,
        variantId: variant.id,
        availableStock: v.stock,
        soldStock: 12,
        minimumStock: 5,
      },
    });
    variants.push(variant);
  }

  // 6. Create Historical Orders
  console.log('Creating historical orders...');
  const getPastDate = (daysAgo: number): Date => {
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);
    return date;
  };
  
  const orderList = [
    { daysAgo: 2, status: OrderStatus.DELIVERED, customerIndex: 0, variantIndexes: [0, 3], quantities: [1, 2] },
    { daysAgo: 5, status: OrderStatus.CONFIRMED, customerIndex: 1, variantIndexes: [1], quantities: [1] },
    { daysAgo: 8, status: OrderStatus.PROCESSING, customerIndex: 2, variantIndexes: [4, 5], quantities: [1, 1] },
    { daysAgo: 12, status: OrderStatus.SHIPPED, customerIndex: 3, variantIndexes: [2], quantities: [2] },
    { daysAgo: 15, status: OrderStatus.PENDING, customerIndex: 0, variantIndexes: [3], quantities: [1] },
    { daysAgo: 20, status: OrderStatus.CANCELLED, customerIndex: 1, variantIndexes: [0], quantities: [1] },
    // Previous month (June)
    { daysAgo: 32, status: OrderStatus.DELIVERED, customerIndex: 2, variantIndexes: [1, 5], quantities: [2, 1] },
    { daysAgo: 35, status: OrderStatus.DELIVERED, customerIndex: 3, variantIndexes: [3], quantities: [1] },
    { daysAgo: 40, status: OrderStatus.DELIVERED, customerIndex: 0, variantIndexes: [4], quantities: [3] },
    { daysAgo: 45, status: OrderStatus.CANCELLED, customerIndex: 1, variantIndexes: [2], quantities: [1] },
    // May
    { daysAgo: 65, status: OrderStatus.DELIVERED, customerIndex: 2, variantIndexes: [0, 4], quantities: [1, 1] },
    { daysAgo: 70, status: OrderStatus.DELIVERED, customerIndex: 3, variantIndexes: [1], quantities: [1] },
    { daysAgo: 75, status: OrderStatus.DELIVERED, customerIndex: 0, variantIndexes: [3, 5], quantities: [1, 2] },
    // April
    { daysAgo: 95, status: OrderStatus.DELIVERED, customerIndex: 1, variantIndexes: [2, 3], quantities: [1, 1] },
    { daysAgo: 100, status: OrderStatus.DELIVERED, customerIndex: 2, variantIndexes: [0], quantities: [2] },
  ];
  
  let orderCounter = 1000;
  for (const o of orderList) {
    orderCounter++;
    const customer = customers[o.customerIndex];
    const orderDate = getPastDate(o.daysAgo);
    
    const address = await prisma.address.findFirst({
      where: { userId: customer.id }
    });
    
    if (!address) continue;
    
    let subtotal = 0;
    const itemsToCreate = [];
    
    for (let j = 0; j < o.variantIndexes.length; j++) {
      const variant = variants[o.variantIndexes[j]];
      const qty = o.quantities[j];
      const price = Number(variant.price);
      subtotal += price * qty;
      
      const prod = await prisma.product.findUnique({
        where: { id: variant.productId }
      });
      
      itemsToCreate.push({
        productId: variant.productId,
        variantId: variant.id,
        productNameSnapshot: prod?.name || 'Product',
        variantSnapshot: {
          size: variant.size,
          color: variant.color,
          sku: variant.sku,
        },
        priceSnapshot: variant.price,
        quantity: qty,
      });
    }
    
    const taxAmount = subtotal * 0.18; 
    const shippingAmount = subtotal > 100 ? 0 : 15;
    const totalAmount = subtotal + taxAmount + shippingAmount;
    
    const order = await prisma.order.create({
      data: {
        orderNumber: `ORD-${orderDate.getFullYear()}-${orderCounter}`,
        userId: customer.id,
        addressId: address.id,
        status: o.status,
        subtotal: subtotal.toFixed(2),
        taxAmount: taxAmount.toFixed(2),
        shippingAmount: shippingAmount.toFixed(2),
        totalAmount: totalAmount.toFixed(2),
        createdAt: orderDate,
        updatedAt: orderDate,
      }
    });
    
    for (const item of itemsToCreate) {
      await prisma.orderItem.create({
        data: {
          orderId: order.id,
          ...item
        }
      });
    }
    
    await prisma.payment.create({
      data: {
        orderId: order.id,
        method: 'CARD',
        status: ([OrderStatus.DELIVERED, OrderStatus.CONFIRMED, OrderStatus.PROCESSING, OrderStatus.SHIPPED] as OrderStatus[]).includes(o.status) ? 'PAID' : o.status === OrderStatus.CANCELLED ? 'FAILED' : 'PENDING',
        amount: totalAmount.toFixed(2),
        createdAt: orderDate,
        updatedAt: orderDate,
      }
    });
    
    await prisma.orderTimelineEvent.create({
      data: {
        orderId: order.id,
        status: o.status,
        note: `Order status set to ${o.status}`,
        createdAt: orderDate,
      }
    });
  }

  // 7. Create Banners
  console.log('Creating banners...');
  await prisma.banner.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      title: 'Summer Fashion Sale',
      description: 'Up to 50% off on all luxury apparel',
      imageUrl: 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=1200&auto=format&fit=crop&q=80',
      position: 'HOME',
      type: 'home',
      isActive: true,
      sortOrder: 1,
    },
  });

  await prisma.banner.upsert({
    where: { id: 2 },
    update: {},
    create: {
      id: 2,
      title: 'New Bestsellers',
      description: 'Explore trending designer jackets',
      imageUrl: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?w=1200&auto=format&fit=crop&q=80',
      position: 'HOME',
      type: 'home',
      isActive: true,
      sortOrder: 2,
    },
  });

  console.log('✅ Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
