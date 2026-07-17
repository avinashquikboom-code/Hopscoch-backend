import dotenv from 'dotenv';
import fs from 'fs';
// Load environment variables early from env directory
if (fs.existsSync('./env/env.local')) {
  dotenv.config({ path: './env/env.local' });
} else {
  dotenv.config({ path: './env/.env' });
}

import path from 'path';
import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';

import { errorHandler } from './middleware/errorHandler';
import { notFoundHandler } from './middleware/notFoundHandler';
import { rateLimiter } from './middleware/rateLimiter';
import { logger } from './utils/logger';
import authRoutes from './modules/auth/routes';
import userRoutes from './modules/user/routes';
import catalogRoutes from './modules/catalog/routes';
import visualSearchRoutes from './modules/visual_search/routes';
import recentlyViewedRoutes from './modules/recently_viewed/routes';
import categoryRoutes from './modules/category/routes';
import brandRoutes from './modules/brand/routes';
import collectionRoutes from './modules/collections/routes';
import productRoutes from './modules/product/routes';
import cartRoutes from './modules/cart/routes';
import wishlistRoutes from './modules/wishlist/routes';
import addressRoutes from './modules/address/routes';
import orderRoutes from './modules/order/routes';
import reviewRoutes from './modules/review/routes';
import notificationRoutes from './modules/notification/routes';
import couponRoutes from './modules/coupon/routes';
import homeRoutes from './modules/home/routes';
import searchRoutes from './modules/search/routes';
import returnRoutes from './modules/returns/routes';
import paymentRoutes from './modules/payments/routes';
import shipmentRoutes from './modules/shipments/routes';
import inventoryRoutes from './modules/inventory/routes';
import reportRoutes from './modules/reports/routes';
import adminRoutes from './modules/admin/routes';
import settingsRoutes from './modules/settings/routes';
import v1Routes from './routes/v1';
import './workers';

const app: Application = express();
const PORT = process.env.PORT || 5000;

// Trust proxy headers from Nginx reverse proxy
app.set('trust proxy', 1);

// Middleware
app.use(helmet());

const allowedOrigins = [
  'https://admin.fciseller.com',
  'https://fciseller.com',
  'https://www.fciseller.com',
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow server-to-server / curl (no Origin header)
    if (!origin) return callback(null, true);
    if (
      allowedOrigins.includes(origin) ||
      origin.startsWith('http://localhost:') ||
      origin.startsWith('http://127.0.0.1:')
    ) {
      callback(null, true);
    } else {
      callback(new Error(`CORS: origin '${origin}' not allowed`));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Origin', 'Accept', 'X-Requested-With'],
}));
app.use(compression());
// Use absolute path for uploads directory to work correctly from both src and dist
const uploadsPath = path.resolve(process.cwd(), 'uploads');
app.use('/uploads', express.static(uploadsPath));
const assetsPath = path.resolve(process.cwd(), 'assets');
app.use('/assets', express.static(assetsPath));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(rateLimiter);

// Request logging
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`);
  next();
});

// Swagger Documentation
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'FCISeller E-Commerce API',
      version: '1.0.0',
      description: 'Production-grade luxury fashion e-commerce backend API',
    },
    servers: [
      {
        url: process.env.API_URL || 'https://api.fciseller.com',
        description: 'Production server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
  },
  apis: ['./src/modules/*/routes/*.ts', './src/modules/*/routes/*.js'],
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    message: 'Server is running',
    timestamp: new Date().toISOString(),
  });
});

import prisma from './utils/prisma';
import { ResponseFormatter } from './utils/responseFormatter';

// API Routes
app.get('/api/banners', async (req, res, next) => {
  try {
    const banners = await prisma.banner.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });
    return ResponseFormatter.success(res, 'Banners retrieved successfully', banners);
  } catch (error) {
    return next(error);
  }
});

app.use('/api/auth', authRoutes);
app.use('/api', catalogRoutes);
app.use('/api', visualSearchRoutes);
app.use('/api/users', userRoutes);
app.use('/api/categories', categoryRoutes);

app.use('/api/coupons', couponRoutes);
app.use('/api/brands', brandRoutes);
app.use('/api/collections', collectionRoutes);
app.use('/api/products', productRoutes);
app.use('/api/catalog/products', productRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/wishlist', wishlistRoutes);
app.use('/api/addresses', addressRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/returns', returnRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/shipments', shipmentRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/v1', v1Routes);
app.use('/api/recently-viewed', recentlyViewedRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/coupons', couponRoutes);
app.use('/api/home', homeRoutes);
app.use('/api/search', searchRoutes);

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  logger.info(`🚀 Server running on port ${PORT}`);
  logger.info(`📚 API Documentation: http://localhost:${PORT}/api-docs`);
  logger.info(`🏥 Health Check: http://localhost:${PORT}/health`);
});

export default app;
