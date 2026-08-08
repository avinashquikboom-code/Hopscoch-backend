/**
 * Migrate legacy localhost / relative upload URLs to production S3/API URLs.
 *
 * Usage: npx ts-node scripts/migrate-legacy-image-urls.ts
 */
import dotenv from 'dotenv';
import prisma from '../src/utils/prisma';
import { normalizeAssetUrl } from '../src/utils/asset-url';

dotenv.config();

const URL_FIELDS: Array<{ model: string; fields: string[] }> = [
  { model: 'product', fields: ['thumbnailUrl'] },
  { model: 'productImage', fields: ['url'] },
  { model: 'productVideo', fields: ['url', 'thumbnailUrl'] },
  { model: 'category', fields: ['iconUrl', 'bannerUrl'] },
  { model: 'brand', fields: ['logoUrl', 'bannerUrl'] },
  { model: 'collection', fields: ['imageUrl'] },
  { model: 'user', fields: ['avatarUrl'] },
];

function needsMigration(url: string | null | undefined): boolean {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (!trimmed) return false;
  if (/https?:\/\/(localhost|127\.0\.0\.1|10\.0\.2\.2)(:\d+)?/i.test(trimmed)) {
    return true;
  }
  if (trimmed.startsWith('/uploads/') || trimmed.startsWith('/api/uploads/')) {
    return true;
  }
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
    return true;
  }
  return false;
}

async function migrateTable(modelName: string, fields: string[]) {
  const delegate = (prisma as any)[modelName];
  if (!delegate) {
    console.warn(`Skipping unknown model: ${modelName}`);
    return 0;
  }

  let updated = 0;
  const rows = await delegate.findMany();
  for (const row of rows) {
    const data: Record<string, string> = {};
    for (const field of fields) {
      const current = row[field];
      if (!needsMigration(current)) continue;
      const normalized = normalizeAssetUrl(current);
      if (normalized && normalized !== current) {
        data[field] = normalized;
      }
    }
    if (Object.keys(data).length > 0) {
      await delegate.update({ where: { id: row.id }, data });
      updated += 1;
      console.log(`Updated ${modelName} id=${row.id}: ${JSON.stringify(data)}`);
    }
  }
  return updated;
}

async function main() {
  let total = 0;
  for (const { model, fields } of URL_FIELDS) {
    const count = await migrateTable(model, fields);
    total += count;
    console.log(`${model}: ${count} row(s) updated`);
  }
  console.log(`Done. Total rows updated: ${total}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
