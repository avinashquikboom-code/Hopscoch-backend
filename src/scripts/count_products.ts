import prisma from '../utils/prisma';

async function main() {
  const totalCount = await prisma.product.count();
  const publishedCount = await prisma.product.count({
    where: { status: 'PUBLISHED' },
  });
  const draftCount = await prisma.product.count({
    where: { status: 'DRAFT' },
  });
  const archivedCount = await prisma.product.count({
    where: { status: 'ARCHIVED' },
  });
  const nonDeletedCount = await prisma.product.count({
    where: { deletedAt: null },
  });
  const deletedCount = await prisma.product.count({
    where: { deletedAt: { not: null } },
  });
  const nonDeletedPublishedCount = await prisma.product.count({
    where: { deletedAt: null, status: 'PUBLISHED' },
  });
  const nonDeletedDraftCount = await prisma.product.count({
    where: { deletedAt: null, status: 'DRAFT' },
  });
  const nonDeletedArchivedCount = await prisma.product.count({
    where: { deletedAt: null, status: 'ARCHIVED' },
  });

  console.log('================ DATABASE PRODUCT COUNTS ================');
  console.log(`COUNT(*) = Total Products:            ${totalCount}`);
  console.log(`COUNT(non-deleted products):          ${nonDeletedCount}`);
  console.log(`COUNT(deleted products):              ${deletedCount}`);
  console.log(`COUNT(published products):            ${publishedCount}`);
  console.log(`COUNT(draft products):                ${draftCount}`);
  console.log(`COUNT(archived products):             ${archivedCount}`);
  console.log(`COUNT(non-deleted & published):       ${nonDeletedPublishedCount}`);
  console.log(`COUNT(non-deleted & draft):           ${nonDeletedDraftCount}`);
  console.log(`COUNT(non-deleted & archived):        ${nonDeletedArchivedCount}`);
  console.log('=========================================================');

  const rawCounts = await prisma.$queryRawUnsafe<any[]>(`
    SELECT 
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE deleted_at IS NULL) as non_deleted,
      COUNT(*) FILTER (WHERE deleted_at IS NOT NULL) as deleted,
      COUNT(*) FILTER (WHERE status = 'PUBLISHED') as published,
      COUNT(*) FILTER (WHERE deleted_at IS NULL AND status = 'PUBLISHED') as non_deleted_published
    FROM products;
  `);
  console.log('Raw SQL Counts from PostgreSQL:', rawCounts);

  await prisma.$disconnect();
  process.exit(0);
}

main().catch((e) => {
  console.error('Error counting products:', e);
  process.exit(1);
});
