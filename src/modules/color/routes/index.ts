import { Router } from 'express';
import prisma from '../../../utils/prisma';
import { ResponseFormatter } from '../../../utils/responseFormatter';

const router = Router();

const DEFAULT_COLORS = [
  { name: 'Red', hexCode: '#EF4444' },
  { name: 'Blue', hexCode: '#3B82F6' },
  { name: 'Green', hexCode: '#10B981' },
  { name: 'Black', hexCode: '#000000' },
  { name: 'White', hexCode: '#FFFFFF' },
  { name: 'Yellow', hexCode: '#F59E0B' },
  { name: 'Pink', hexCode: '#EC4899' },
  { name: 'Navy', hexCode: '#1E3A8A' },
  { name: 'Grey', hexCode: '#6B7280' },
  { name: 'Purple', hexCode: '#8B5CF6' },
  { name: 'Orange', hexCode: '#F97316' },
  { name: 'Beige', hexCode: '#F5F5DC' },
  { name: 'Brown', hexCode: '#78350F' },
  { name: 'Maroon', hexCode: '#800000' },
  { name: 'Gold', hexCode: '#FFD700' },
  { name: 'Silver', hexCode: '#C0C0C0' },
  { name: 'Multicolor', hexCode: '#6366F1' },
];

async function seedColorsIfEmpty() {
  try {
    const count = await prisma.color.count();
    if (count === 0) {
      await prisma.color.createMany({
        data: DEFAULT_COLORS,
        skipDuplicates: true,
      });
    }
  } catch (error) {
    console.error('Error seeding default colors:', error);
  }
}

// GET all colors
router.get('/', async (req, res, next) => {
  try {
    await seedColorsIfEmpty();
    const colors = await prisma.color.findMany({
      orderBy: { name: 'asc' },
    });
    return ResponseFormatter.success(res, 'Colors retrieved successfully', colors);
  } catch (error: any) {
    if (error?.code === 'P2021') {
      console.warn('Color table does not exist in database yet. Run `npx prisma db push`.');
      return ResponseFormatter.success(res, 'Colors retrieved successfully (table pending migration)', []);
    }
    return next(error);
  }
});

// GET single color
router.get('/:colorId', async (req, res, next) => {
  try {
    const { colorId } = req.params;
    const parsedId = Number(colorId);
    if (isNaN(parsedId)) {
      return res.status(400).json({ success: false, message: 'Invalid color ID' });
    }

    const color = await prisma.color.findUnique({
      where: { id: parsedId },
    });
    if (!color) {
      return res.status(404).json({ success: false, message: 'Color not found' });
    }
    return ResponseFormatter.success(res, 'Color retrieved successfully', color);
  } catch (error) {
    return next(error);
  }
});

// POST create color
router.post('/', async (req, res, next) => {
  try {
    const { name, hexCode } = req.body;
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Color name is required' });
    }

    const trimmedName = name.trim();
    const existing = await prisma.color.findUnique({ where: { name: trimmedName } });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Color already exists' });
    }

    const color = await prisma.color.create({
      data: {
        name: trimmedName,
        hexCode: hexCode ? String(hexCode).trim() : null,
      },
    });
    return ResponseFormatter.success(res, 'Color created successfully', color);
  } catch (error) {
    return next(error);
  }
});

// PUT update color
router.put('/:colorId', async (req, res, next) => {
  try {
    const { colorId } = req.params;
    const parsedId = Number(colorId);
    if (isNaN(parsedId)) {
      return res.status(400).json({ success: false, message: 'Invalid color ID' });
    }

    const { name, hexCode, isActive } = req.body;

    const existing = await prisma.color.findUnique({ where: { id: parsedId } });
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Color not found' });
    }

    if (name && name.trim() !== existing.name) {
      const duplicate = await prisma.color.findUnique({ where: { name: name.trim() } });
      if (duplicate) {
        return res.status(400).json({ success: false, message: 'Color with this name already exists' });
      }
    }

    const updated = await prisma.color.update({
      where: { id: parsedId },
      data: {
        ...(name !== undefined ? { name: String(name).trim() } : {}),
        ...(hexCode !== undefined ? { hexCode: hexCode ? String(hexCode).trim() : null } : {}),
        ...(isActive !== undefined ? { isActive: Boolean(isActive) } : {}),
      },
    });
    return ResponseFormatter.success(res, 'Color updated successfully', updated);
  } catch (error) {
    return next(error);
  }
});

// DELETE delete color
router.delete('/:colorId', async (req, res, next) => {
  try {
    const { colorId } = req.params;
    const parsedId = Number(colorId);
    if (isNaN(parsedId)) {
      return res.status(400).json({ success: false, message: 'Invalid color ID' });
    }

    const existing = await prisma.color.findUnique({ where: { id: parsedId } });
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Color not found' });
    }

    await prisma.color.delete({
      where: { id: parsedId },
    });
    return ResponseFormatter.success(res, 'Color deleted successfully', { id: parsedId });
  } catch (error) {
    return next(error);
  }
});

export default router;
