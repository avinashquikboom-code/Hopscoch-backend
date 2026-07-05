import dotenv from 'dotenv';
dotenv.config({ path: './env/env.local' });

import bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('❌ DATABASE_URL missing');
  process.exit(1);
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const hash = await bcrypt.hash('123456', 10);

  const user = await prisma.user.upsert({
    where: { email: 'admin@gmail.com' },
    update: {
      passwordHash: hash,
      isActive: true,
      isEmailVerified: true,
      firstName: 'Admin',
      lastName: 'User',
    },
    create: {
      email: 'admin@gmail.com',
      passwordHash: hash,
      role: 'ADMIN',
      firstName: 'Admin',
      lastName: 'User',
      isEmailVerified: true,
      isActive: true,
    },
  });

  console.log('✅ Admin credentials updated!');
  console.log('   Email   :', user.email);
  console.log('   Password: 123456');
  console.log('   Role    :', user.role);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error('❌ Error:', e);
  process.exit(1);
});
