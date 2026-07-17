import { Gender, AgeGroup, ProductStatus, Role, WarehouseStatus } from '@prisma/client';
import bcrypt from 'bcrypt';
import prisma from '../src/utils/prisma';

async function main() {
  console.log('🌱 Start seeding mock database...');

  // 0. Create Users
  console.log('Creating users...');
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

  // 1.5. Create Default Warehouse
  console.log('Creating default warehouse...');
  await prisma.warehouse.upsert({
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

  // 4. Create Banners
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

  await prisma.banner.upsert({
    where: { id: 3 },
    update: {},
    create: {
      id: 3,
      title: 'Kurta & Kurtis Festival',
      description: 'Premium traditional ethnic wear collections',
      imageUrl: 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=1200&auto=format&fit=crop&q=80',
      position: 'HOME',
      type: 'ethnic',
      isActive: true,
      sortOrder: 3,
    },
  });

  await prisma.banner.upsert({
    where: { id: 4 },
    update: {},
    create: {
      id: 4,
      title: 'Exclusive Silk Sarees',
      description: 'Handcrafted luxury sarees from top weavers',
      imageUrl: 'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?w=1200&auto=format&fit=crop&q=80',
      position: 'HOME',
      type: 'seasonal',
      isActive: true,
      sortOrder: 4,
    },
  });

  await prisma.banner.upsert({
    where: { id: 5 },
    update: {},
    create: {
      id: 5,
      title: 'Western Streetwear',
      description: 'Upgrade your look with premium denim',
      imageUrl: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=1200&auto=format&fit=crop&q=80',
      position: 'HOME',
      type: 'exclusive',
      isActive: true,
      sortOrder: 5,
    },
  });

  console.log('✅ Seeding completed successfully!');
  console.log(`Seeded: \n- ${product1.name}\n- ${product2.name}\n- ${product3.name}\n- 5 Banners`);
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
