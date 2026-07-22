import prisma from '../utils/prisma';

const DEFAULT_COLORS = [
  { name: 'Red', hexCode: '#EF4444' },
  { name: 'Blue', hexCode: '#3B82F6' },
  { name: 'Green', hexCode: '#10B981' },
  { name: 'Black', hexCode: '#000000' },
  { name: 'White', hexCode: '#FFFFFF' },
  { name: 'Yellow', hexCode: '#F59E0B' },
  { name: 'Pink', hexCode: '#EC4899' },
  { name: 'Navy', hexCode: '#1E3A8A' },
  { name: 'Grey', hexCode: '#6B7280' },
  { name: 'Purple', hexCode: '#8B5CF6' },
  { name: 'Orange', hexCode: '#F97316' },
  { name: 'Beige', hexCode: '#F5F5DC' },
  { name: 'Brown', hexCode: '#78350F' },
  { name: 'Maroon', hexCode: '#800000' },
  { name: 'Gold', hexCode: '#FFD700' },
  { name: 'Silver', hexCode: '#C0C0C0' },
  { name: 'Multicolor', hexCode: '#6366F1' },
];

const DEFAULT_SIZES = [
  { name: 'XS', code: 'XS', sortOrder: 1 },
  { name: 'S', code: 'S', sortOrder: 2 },
  { name: 'M', code: 'M', sortOrder: 3 },
  { name: 'L', code: 'L', sortOrder: 4 },
  { name: 'XL', code: 'XL', sortOrder: 5 },
  { name: '2XL', code: '2XL', sortOrder: 6 },
  { name: '3XL', code: '3XL', sortOrder: 7 },
  { name: 'Free Size', code: 'FS', sortOrder: 8 },
  { name: '28', code: '28', sortOrder: 9 },
  { name: '30', code: '30', sortOrder: 10 },
  { name: '32', code: '32', sortOrder: 11 },
  { name: '34', code: '34', sortOrder: 12 },
  { name: '36', code: '36', sortOrder: 13 },
  { name: '38', code: '38', sortOrder: 14 },
  { name: '40', code: '40', sortOrder: 15 },
  { name: 'One Size', code: 'OS', sortOrder: 16 },
];

async function seedColorsAndSizes() {
  console.log('🎨 Seeding default master colors...');
  for (const color of DEFAULT_COLORS) {
    await prisma.color.upsert({
      where: { name: color.name },
      update: {},
      create: color,
    });
  }
  console.log('✅ Master colors seeded successfully.');

  console.log('📏 Seeding default master sizes...');
  for (const size of DEFAULT_SIZES) {
    await prisma.size.upsert({
      where: { name: size.name },
      update: {},
      create: size,
    });
  }
  console.log('✅ Master sizes seeded successfully.');
}

seedColorsAndSizes()
  .then(() => {
    console.log('🎉 Colors & sizes seeding completed without altering existing data!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ Error seeding colors and sizes:', err);
    process.exit(1);
  });
