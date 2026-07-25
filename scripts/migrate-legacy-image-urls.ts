import prisma from '../src/utils/prisma';

/**
 * Migration Script: Clean up legacy local '/uploads/' or presigned image URLs in PostgreSQL.
 * Converts legacy relative/localhost paths to permanent static S3 URLs.
 */
async function migrateLegacyImageUrls() {
  const bucketName = process.env.S3_BUCKET_NAME || 'hopscotch-bt';
  const region = process.env.AWS_REGION || 'ap-south-1';
  const s3BaseUrl = `https://${bucketName}.s3.${region}.amazonaws.com`;

  console.log('🔄 Starting migration of legacy image URLs...');

  // 1. Migrate Users avatarUrl
  const usersWithLegacy = await prisma.user.findMany({
    where: { avatarUrl: { contains: '/uploads/' } },
  });

  for (const user of usersWithLegacy) {
    if (user.avatarUrl) {
      const filename = user.avatarUrl.split('/uploads/').pop();
      const newUrl = `${s3BaseUrl}/avatars/${filename}`;
      await prisma.user.update({
        where: { id: user.id },
        data: { avatarUrl: newUrl },
      });
      console.log(`Updated User #${user.id} avatarUrl: ${newUrl}`);
    }
  }

  // 2. Migrate ProductImage url
  const prodImagesWithLegacy = await prisma.productImage.findMany({
    where: { url: { contains: '/uploads/' } },
  });

  for (const img of prodImagesWithLegacy) {
    const filename = img.url.split('/uploads/').pop();
    const newUrl = `${s3BaseUrl}/products/${filename}`;
    await prisma.productImage.update({
      where: { id: img.id },
      data: { url: newUrl },
    });
    console.log(`Updated ProductImage #${img.id} url: ${newUrl}`);
  }

  // 3. Migrate Category iconUrl & bannerUrl
  const categoriesWithLegacy = await prisma.category.findMany({
    where: {
      OR: [
        { iconUrl: { contains: '/uploads/' } },
        { bannerUrl: { contains: '/uploads/' } },
      ],
    },
  });

  for (const cat of categoriesWithLegacy) {
    const updateData: any = {};
    if (cat.iconUrl && cat.iconUrl.includes('/uploads/')) {
      const filename = cat.iconUrl.split('/uploads/').pop();
      updateData.iconUrl = `${s3BaseUrl}/categories/${filename}`;
    }
    if (cat.bannerUrl && cat.bannerUrl.includes('/uploads/')) {
      const urls = cat.bannerUrl.split(',').map((u) => {
        if (u.includes('/uploads/')) {
          const filename = u.split('/uploads/').pop();
          return `${s3BaseUrl}/categories/${filename}`;
        }
        return u;
      });
      updateData.bannerUrl = urls.join(',');
    }

    await prisma.category.update({
      where: { id: cat.id },
      data: updateData,
    });
    console.log(`Updated Category #${cat.id} URLs`);
  }

  // 4. Migrate Banner imageUrl
  const bannersWithLegacy = await prisma.banner.findMany({
    where: { imageUrl: { contains: '/uploads/' } },
  });

  for (const banner of bannersWithLegacy) {
    const filename = banner.imageUrl.split('/uploads/').pop();
    const newUrl = `${s3BaseUrl}/banners/${filename}`;
    await prisma.banner.update({
      where: { id: banner.id },
      data: { imageUrl: newUrl },
    });
    console.log(`Updated Banner #${banner.id} imageUrl: ${newUrl}`);
  }

  const totalAffected =
    usersWithLegacy.length +
    prodImagesWithLegacy.length +
    categoriesWithLegacy.length +
    bannersWithLegacy.length;

  console.log(`✅ Migration complete! Total rows updated: ${totalAffected}`);
}

migrateLegacyImageUrls()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
