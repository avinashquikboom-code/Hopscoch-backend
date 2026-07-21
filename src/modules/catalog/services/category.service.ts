import prisma from '../../../utils/prisma';

export class CategoryService {
  async listCategories(includeAll: boolean = false) {
    const whereCondition: any = { deletedAt: null };
    if (!includeAll) {
      whereCondition.parentId = null;
    }

    const categories = await prisma.category.findMany({
      where: whereCondition,
      include: {
        parent: true,
        children: {
          where: { deletedAt: null },
          orderBy: { sortOrder: 'asc' },
        },
      },
      orderBy: { sortOrder: 'asc' },
    });

    return categories;
  }
}

export default new CategoryService();
