import { Router } from 'express';
import CatalogController from '../controllers/catalog.controller';
import BrandController from '../controllers/brand.controller';
import CategoryController from '../controllers/category.controller';
import MarketingService from '../../marketing/services/marketing.service';
import { ResponseFormatter } from '../../../utils/responseFormatter';


const router = Router();
const catalogController = CatalogController;
const brandController = BrandController;
const categoryController = CategoryController;

/**
 * @swagger
 * /products:
 *   get:
 *     summary: List products with filters
 *     tags: [Catalog]
 *     parameters:
 *       - in: query
 *         name: categoryId
 *         schema:
 *           type: string
 *       - in: query
 *         name: brandId
 *         schema:
 *           type: string
 *       - in: query
 *         name: minPrice
 *         schema:
 *           type: number
 *       - in: query
 *         name: maxPrice
 *         schema:
 *           type: number
 *       - in: query
 *         name: page
 *         schema:
 *           type: number
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: number
 *           default: 20
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           enum: [price_asc, price_desc, rating, newest]
 *           default: newest
 *     responses:
 *       200:
 *         description: Products retrieved successfully
 */
router.get('/products', catalogController.listProducts.bind(catalogController));

/**
 * @swagger
 * /products/:productId:
 *   get:
 *     summary: Get a single product's full detail
 *     tags: [Catalog]
 *     parameters:
 *       - in: path
 *         name: productId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Product retrieved successfully
 *       404:
 *         description: Product not found
 */
router.get('/products/:productId', catalogController.getProductById.bind(catalogController));

/**
 * @swagger
 * /products/:productId/images:
 *   get:
 *     summary: List all images for a product
 *     tags: [Catalog]
 *     parameters:
 *       - in: path
 *         name: productId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Product images retrieved successfully
 *       404:
 *         description: Product not found
 */
router.get('/products/:productId/images', catalogController.getProductImages.bind(catalogController));

/**
 * @swagger
 * /products/:productId/variants:
 *   get:
 *     summary: List available size/color variants and stock for a product
 *     tags: [Catalog]
 *     parameters:
 *       - in: path
 *         name: productId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Product variants retrieved successfully
 *       404:
 *         description: Product not found
 */
router.get('/products/:productId/variants', catalogController.getProductVariants.bind(catalogController));

/**
 * @swagger
 * /products/:productId/related:
 *   get:
 *     summary: Get related products for a given product
 *     tags: [Catalog]
 *     parameters:
 *       - in: path
 *         name: productId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Related products retrieved successfully
 *       404:
 *         description: Product not found
 */
router.get('/products/:productId/related', catalogController.getRelatedProducts.bind(catalogController));

/**
 * @swagger
 * /brands:
 *   get:
 *     summary: List all brands
 *     tags: [Catalog]
 *     responses:
 *       200:
 *         description: Brands retrieved successfully
 */
router.get('/brands', brandController.listBrands.bind(brandController));

/**
 * @swagger
 * /brands/:brandId:
 *   get:
 *     summary: Get a single brand and its products
 *     tags: [Catalog]
 *     parameters:
 *       - in: path
 *         name: brandId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Brand retrieved successfully
 *       404:
 *         description: Brand not found
 */
router.get('/brands/:brandId', brandController.getBrandById.bind(brandController));

/**
 * @swagger
 * /categories:
 *   get:
 *     summary: List distinct product categories
 *     tags: [Catalog]
 *     responses:
 *       200:
 *         description: Categories retrieved successfully
 */
router.get('/categories', categoryController.listCategories.bind(categoryController));

/**
 * @swagger
 * /banners:
 *   get:
 *     summary: List active banners (Public)
 *     tags: [Catalog]
 *     responses:
 *       200:
 *         description: Banners retrieved successfully
 */
router.get('/banners', async (req, res, next) => {
  try {
    const banners = await MarketingService.getBanners({ isActive: true });
    return ResponseFormatter.success(res, 'Banners retrieved successfully', banners);
  } catch (error) {
    return next(error);
  }
});

export default router;
