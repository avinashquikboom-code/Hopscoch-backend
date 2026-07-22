import dotenv from 'dotenv';
import fs from 'fs';
if (fs.existsSync('./env/env.local')) {
  dotenv.config({ path: './env/env.local' });
} else if (fs.existsSync('./env/.env')) {
  dotenv.config({ path: './env/.env' });
} else {
  dotenv.config();
}
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: env('DATABASE_URL'),
  },
  migrations: {
    path: 'prisma/migrations',
  },
});
