import prisma from '../../../utils/prisma';

export class CategoryService {
  async listCategories() {
    const categories = await prisma.category.findMany({
      where: { deletedAt: null },
      include: {
        parent: true,
        children: true,
      },
      orderBy: { sortOrder: 'asc' },
    });

    return categories;
  }
}

export default new CategoryService();
