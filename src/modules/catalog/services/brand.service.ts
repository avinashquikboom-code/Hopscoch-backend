import { AppError } from '../../../middleware/errorHandler';
import prisma from '../../../utils/prisma';

export class BrandService {
  async listBrands() {
    const brands = await prisma.brand.findMany({
      where: { deletedAt: null },
      orderBy: { name: 'asc' },
    });

    return brands;
  }

  async getBrandById(brandId: any) {
    const brand = await prisma.brand.findUnique({
      where: { id: Number(brandId), deletedAt: null },
      include: {
        products: {
          where: { status: 'PUBLISHED', deletedAt: null },
          include: {
            images: {
              where: { sortOrder: 0 },
              take: 1,
            },
          },
          take: 12,
        },
      },
    });

    if (!brand) {
      throw new AppError('Brand not found', 404);
    }

    return brand;
  }
}

export default new BrandService();
