import dotenv from 'dotenv';
import fs from 'fs';

if (fs.existsSync('./env/env.local')) {
  dotenv.config({ path: './env/env.local' });
} else {
  dotenv.config({ path: './env/.env' });
}

import prisma from '../utils/prisma';

async function checkContentPosts() {
  console.log('=== Checking DB Tables ===');
  const tables: any = await prisma.$queryRaw`SELECT table_name FROM information_schema.tables WHERE table_schema='public'`;
  console.log('Tables in DB:', tables.map((t: any) => t.table_name));
}

checkContentPosts().catch((err) => {
  console.error('Error querying DB:', err);
  process.exit(1);
});
