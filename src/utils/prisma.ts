import dotenv from 'dotenv';
import fs from 'fs';
// Load environment variables early from env directory
if (fs.existsSync('./env/env.local')) {
  dotenv.config({ path: './env/env.local' });
} else {
  dotenv.config({ path: './env/.env' });
}

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('❌ DATABASE_URL environment variable is missing.');
  process.exit(1);
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({
  adapter,
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

// Handle Prisma connection errors
prisma.$connect()
  .then(async () => {
    console.log('✅ Database connected successfully');
    
    // Auto-reset sequences on startup to prevent duplicate key errors in production
    const tables = [
      'categories',
      'brands',
      'products',
      'product_variants',
      'banners',
      'coupons',
      'users',
      'collections'
    ];
    for (const table of tables) {
      try {
        const result = await prisma.$queryRawUnsafe<any[]>(
          `SELECT COALESCE(MAX(id), 0) + 1 as next_val FROM "${table}"`
        );
        const nextVal = result[0]?.next_val || 1;
        await prisma.$queryRawUnsafe(
          `SELECT setval(pg_get_serial_sequence('"${table}"', 'id'), ${nextVal}, false)`
        );
      } catch (err: any) {
        // Log locally, suppress noisy output in production if not needed
        console.warn(`Could not reset sequence for table ${table}:`, err.message);
      }
    }
  })
  .catch((error) => {
    console.error('❌ Database connection error:', error);
    process.exit(1);
  });

// Graceful shutdown
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});

export default prisma;
