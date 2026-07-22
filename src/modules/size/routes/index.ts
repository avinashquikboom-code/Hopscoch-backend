import { Router } from 'express';
import prisma from '../../../utils/prisma';
import { ResponseFormatter } from '../../../utils/responseFormatter';

const router = Router();

const DEFAULT_SIZES = [
  { name: 'XS', code: 'XS', sortOrder: 1 },
  { name: 'S', code: 'S', sortOrder: 2 },
  { name: 'M', code: 'M', sortOrder: 3 },
  { name: 'L', code: 'L', sortOrder: 4 },
  { name: 'XL', code: 'XL', sortOrder: 5 },
  { name: '2XL', code: '2XL', sortOrder: 6 },
  { name: '3XL', code: '3XL', sortOrder: 7 },
  { name: 'Free Size', code: 'FS', sortOrder: 8 }, 
  { name: '28', code: '28', sortOrder: 9 },
  { name: '30', code: '30', sortOrder: 10 },
  { name: '32', code: '32', sortOrder: 11 },
  { name: '34', code: '34', sortOrder: 12 },
  { name: '36', code: '36', sortOrder: 13 },
  { name: '38', code: '38', sortOrder: 14 },
  { name: '40', code: '40', sortOrder: 15 },
  { name: 'One Size', code: 'OS', sortOrder: 16 },
];

async function seedSizesIfEmpty() {
  try {
    const count = await prisma.size.count();
    if (count === 0) {
      await prisma.size.createMany({
        data: DEFAULT_SIZES,
        skipDuplicates: true,
      });
    }
  } catch (error) {
    console.error('Error seeding default sizes:', error);
  }
}

// GET all sizes
router.get('/', async (req, res, next) => {
  try {
    await seedSizesIfEmpty();
    const sizes = await prisma.size.findMany({
      orderBy: [
        { sortOrder: 'asc' },
        { name: 'asc' },
      ],
    });
    return ResponseFormatter.success(res, 'Sizes retrieved successfully', sizes);
  } catch (error) {
    return next(error);
  }
});

// GET single size
router.get('/:sizeId', async (req, res, next) => {
  try {
    const { sizeId } = req.params;
    const parsedId = Number(sizeId);
    if (isNaN(parsedId)) {
      return res.status(400).json({ success: false, message: 'Invalid size ID' });
    }

    const size = await prisma.size.findUnique({
      where: { id: parsedId },
    });
    if (!size) {
      return res.status(404).json({ success: false, message: 'Size not found' });
    }
    return ResponseFormatter.success(res, 'Size retrieved successfully', size);
  } catch (error) {
    return next(error);
  }
});

// POST create size
router.post('/', async (req, res, next) => {
  try {
    const { name, code, sortOrder } = req.body;
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Size name is required' });
    }

    const trimmedName = name.trim();
    const existing = await prisma.size.findUnique({ where: { name: trimmedName } });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Size already exists' });
    }

    const size = await prisma.size.create({
      data: {
        name: trimmedName,
        code: code ? String(code).trim() : trimmedName,
        sortOrder: sortOrder !== undefined && !isNaN(Number(sortOrder)) ? Number(sortOrder) : 0,
      },
    });
    return ResponseFormatter.success(res, 'Size created successfully', size);
  } catch (error) {
    return next(error);
  }
});

// PUT update size
router.put('/:sizeId', async (req, res, next) => {
  try {
    const { sizeId } = req.params;
    const parsedId = Number(sizeId);
    if (isNaN(parsedId)) {
      return res.status(400).json({ success: false, message: 'Invalid size ID' });
    }

    const { name, code, sortOrder, isActive } = req.body;

    const existing = await prisma.size.findUnique({ where: { id: parsedId } });
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Size not found' });
    }

    if (name && name.trim() !== existing.name) {
      const duplicate = await prisma.size.findUnique({ where: { name: name.trim() } });
      if (duplicate) {
        return res.status(400).json({ success: false, message: 'Size with this name already exists' });
      }
    }

    const updated = await prisma.size.update({
      where: { id: parsedId },
      data: {
        ...(name !== undefined ? { name: String(name).trim() } : {}),
        ...(code !== undefined ? { code: code ? String(code).trim() : null } : {}),
        ...(sortOrder !== undefined && !isNaN(Number(sortOrder)) ? { sortOrder: Number(sortOrder) } : {}),
        ...(isActive !== undefined ? { isActive: Boolean(isActive) } : {}),
      },
    });
    return ResponseFormatter.success(res, 'Size updated successfully', updated);
  } catch (error) {
    return next(error);
  }
});

// DELETE delete size
router.delete('/:sizeId', async (req, res, next) => {
  try {
    const { sizeId } = req.params;
    const parsedId = Number(sizeId);
    if (isNaN(parsedId)) {
      return res.status(400).json({ success: false, message: 'Invalid size ID' });
    }

    const existing = await prisma.size.findUnique({ where: { id: parsedId } });
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Size not found' });
    }

    await prisma.size.delete({
      where: { id: parsedId },
    });
    return ResponseFormatter.success(res, 'Size deleted successfully', { id: parsedId });
  } catch (error) {
    return next(error);
  }
});

export default router;
