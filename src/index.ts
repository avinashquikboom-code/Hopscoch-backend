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
import 'express-async-errors';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { apiReference } from '@scalar/express-api-reference';

import { errorHandler } from './middleware/errorHandler';
import { notFoundHandler } from './middleware/notFoundHandler';
import { rateLimiter, readRateLimiter } from './middleware/rateLimiter';
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
import colorRoutes from './modules/color/routes';
import sizeRoutes from './modules/size/routes';
import resellerRoutes from './modules/reseller/routes';
import v1Routes from './routes/v1';
import './workers';

const app: Application = express();
const PORT = process.env.PORT || 5000;

// Trust proxy headers from Nginx reverse proxy
app.set('trust proxy', 1);

// 1. CORS (registered BEFORE helmet, routes, and static file handlers)
const defaultOrigins = [
  'https://admin.fciseller.com',
  'https://fciseller.com',
  'https://www.fciseller.com',
  'http://localhost:3000',
  'http://localhost:3001',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3001'
];
const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map(o => o.trim())
  : defaultOrigins;

app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    if (defaultOrigins.includes(origin) || allowedOrigins.includes(origin)) {
      return cb(null, true);
    }
    return cb(new Error(`CORS blocked: ${origin}`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Origin', 'Accept', 'X-Requested-With', 'X-API-Key', 'X-App-Type'],
  exposedHeaders: ['X-New-Access-Token'],
}));

// 2. Helmet (configured to allow cross-origin resource sharing for uploads)
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

app.use(compression());
// Use absolute path for uploads directory to work correctly from both src and dist
const uploadsPath = path.resolve(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsPath)) {
  fs.mkdirSync(uploadsPath, { recursive: true });
}
app.use('/uploads', express.static(uploadsPath, {
  setHeaders: (res) => {
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  }
}));

app.get(['/api/uploads/*', '/uploads/*'], async (req, res): Promise<void> => {
  try {
    const rawKey = req.params[0];
    if (!rawKey) {
      res.status(404).json({ success: false, message: 'File key missing' });
      return;
    }
    const key = rawKey.startsWith('/') ? rawKey.substring(1) : rawKey;
    const localPath = path.resolve(process.cwd(), 'uploads', key);

    if (fs.existsSync(localPath)) {
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      res.setHeader('Cache-Control', 'public, max-age=31536000');
      res.sendFile(localPath);
      return;
    }

    const { getObjectFromS3 } = require('./services/s3.service');
    const s3Object = await getObjectFromS3(key);

    res.setHeader('Content-Type', s3Object.ContentType || 'image/jpeg');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('Cache-Control', 'public, max-age=31536000');

    if (s3Object.Body && typeof (s3Object.Body as any).pipe === 'function') {
      (s3Object.Body as any).pipe(res);
    } else if (s3Object.Body) {
      const bytes = await s3Object.Body.transformToByteArray();
      res.send(Buffer.from(bytes));
    } else {
      res.status(404).json({ success: false, message: 'File body empty' });
    }
  } catch (error: any) {
    const errStr = String(error?.name || '') + String(error?.message || '') + String(error?.code || '') + String(error || '');
    const isNotFound = errStr.includes('NoSuchKey') || error?.statusCode === 404 || error?.$metadata?.httpStatusCode === 404;
    if (isNotFound) {
      logger.warn(`Uploaded file not found (key=${req.params[0]})`);
    } else {
      logger.error(`Failed to serve uploaded file key=${req.params[0]}: ${error}`);
    }
    res.status(404).json({ success: false, message: 'File not found' });
  }
});
const assetsPath = path.resolve(process.cwd(), 'assets');
app.use('/assets', express.static(assetsPath));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
// Rate limiting: generous readRateLimiter for GET requests, state-changing rateLimiter for mutations
app.use((req, res, next) => {
  if (req.method === 'GET') {
    return readRateLimiter(req, res, next);
  }
  return rateLimiter(req, res, next);
});

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

// OpenAPI Spec JSON endpoint
app.get('/openapi.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

// Swagger UI Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Scalar API Reference
app.use(
  '/docs',
  apiReference({
    spec: {
      content: swaggerSpec,
    },
    theme: 'purple',
    pageTitle: 'FCISeller API Reference (Scalar)',
  })
);

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
app.get(['/api/banners', '/api/v1/banners', '/api/v1/web/banners'], async (req, res, next) => {
  try {
    const { position, type } = req.query;
    const where: any = { isActive: true };
    if (position) where.position = String(position);
    if (type) where.type = String(type);
    const banners = await prisma.banner.findMany({
      where,
      orderBy: { sortOrder: 'asc' },
    });
    return ResponseFormatter.success(res, 'Banners retrieved successfully', banners);
  } catch (error) {
    return next(error);
  }
});

app.get(['/api/config/gift-wrap', '/api/v1/config/gift-wrap', '/api/v1/web/config/gift-wrap'], async (req, res) => {
  try {
    const { default: settingsService } = await import('./modules/settings/services/settings.service');
    const config = await settingsService.getGiftWrapConfig();
    return ResponseFormatter.success(res, 'Gift wrap config retrieved', config);
  } catch (error) {
    return ResponseFormatter.error(res, 'Failed to fetch gift wrap config', 500);
  }
});

app.use(['/api/auth', '/api/v1/auth', '/api/v1/web/auth'], authRoutes);
app.use('/api', catalogRoutes);
app.use('/api', visualSearchRoutes);
app.use(['/api/users', '/api/v1/users', '/api/v1/web/users', '/api/v1/mobile/users', '/api/web/users', '/api/mobile/users'], userRoutes);
app.use(['/api/categories', '/api/v1/categories', '/api/v1/web/categories'], categoryRoutes);

app.use(['/api/coupons', '/api/v1/coupons', '/api/v1/web/coupons', '/api/v1/mobile/coupons', '/api/web/coupons', '/api/mobile/coupons'], couponRoutes);
app.use(['/api/brands', '/api/v1/brands', '/api/v1/web/brands'], brandRoutes);
app.use(['/api/collections', '/api/v1/collections', '/api/v1/web/collections'], collectionRoutes);
app.use(['/api/products', '/api/v1/products', '/api/v1/web/products'], productRoutes);
app.use('/api/catalog/products', productRoutes);
app.use(['/api/cart', '/api/v1/cart', '/api/v1/web/cart', '/api/v1/mobile/cart', '/api/web/cart', '/api/mobile/cart'], cartRoutes);
app.use(['/api/wishlist', '/api/v1/wishlist', '/api/v1/web/wishlist', '/api/v1/mobile/wishlist', '/api/web/wishlist', '/api/mobile/wishlist'], wishlistRoutes);
app.use(['/api/addresses', '/api/v1/addresses', '/api/v1/web/addresses', '/api/v1/mobile/addresses', '/api/web/addresses', '/api/mobile/addresses'], addressRoutes);
app.use(['/api/orders', '/api/v1/orders', '/api/v1/web/orders', '/api/v1/mobile/orders', '/api/web/orders', '/api/mobile/orders'], orderRoutes);
app.use(['/api/returns', '/api/v1/returns', '/api/v1/web/returns', '/api/v1/mobile/returns', '/api/web/returns', '/api/mobile/returns'], returnRoutes);
app.use(['/api/payments', '/api/v1/payments', '/api/v1/web/payments', '/api/v1/mobile/payments', '/api/web/payments', '/api/mobile/payments'], paymentRoutes);

app.use('/api/shipments', shipmentRoutes);
app.use('/api/v1/shipments', shipmentRoutes);

app.use('/api/inventory', inventoryRoutes);
app.use('/api/v1/inventory', inventoryRoutes);

app.use('/api/reports', reportRoutes);
app.use('/api/v1/reports', reportRoutes);

import loyaltyRoutes from './modules/loyalty/routes/loyalty.routes';

app.use('/loyalty', loyaltyRoutes);
app.use('/api/loyalty', loyaltyRoutes);
app.use('/api/v1/loyalty', loyaltyRoutes);
app.use('/api/admin/loyalty', loyaltyRoutes);
app.use('/mobile/wallet', loyaltyRoutes);
app.use('/api/mobile/wallet', loyaltyRoutes);

app.use('/api/reseller', resellerRoutes);
app.use('/api/mobile/reseller', resellerRoutes);
app.use('/api/v1/reseller', resellerRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/v1/admin', adminRoutes);

app.use('/api/settings', settingsRoutes);
app.use('/api/v1/settings', settingsRoutes);
app.use('/api/v1', v1Routes);
app.use(['/api/recently-viewed', '/api/v1/recently-viewed', '/api/v1/web/recently-viewed', '/api/v1/mobile/recently-viewed'], recentlyViewedRoutes);
app.use(['/api/reviews', '/api/v1/reviews', '/api/v1/web/reviews', '/api/v1/mobile/reviews'], reviewRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/v1/notifications', notificationRoutes);
app.use('/api/home', homeRoutes);
app.use('/api/colors', colorRoutes);
app.use('/api/admin/colors', colorRoutes);
app.use('/api/sizes', sizeRoutes);
app.use('/api/admin/sizes', sizeRoutes);
import taxRoutes from './modules/tax/routes/tax.routes';
import socialContentRoutes from './modules/content/routes/socialContent.routes';

app.use('/api/taxes', taxRoutes);
app.use('/api/admin/taxes', taxRoutes);
app.use('/api/search', searchRoutes);
app.use('/api', socialContentRoutes);
import webhookRoutes from './modules/webhooks/routes/webhook.routes';

app.use('/api', webhookRoutes);
app.use('/api/v1', webhookRoutes);


// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  logger.info(`🚀 Server running on port ${PORT}`);
  logger.info(`📖 Scalar API Reference: http://localhost:${PORT}/docs`);
  logger.info(`📚 Swagger UI Docs:     http://localhost:${PORT}/api-docs`);
  logger.info(`📄 OpenAPI JSON Spec:   http://localhost:${PORT}/openapi.json`);
  logger.info(`🏥 Health Check:         http://localhost:${PORT}/health`);
  
  // Auto-open Swagger UI in development
  if (process.env.NODE_ENV !== 'production') {
    try {
      const open = require('open');
      open(`http://localhost:${PORT}/api-docs`).catch(() => {
        logger.info('Could not auto-open browser. Please visit http://localhost:' + PORT + '/api-docs manually');
      });
    } catch (error) {
      logger.info(`Could not auto-open browser (open module not found). Please visit http://localhost:${PORT}/api-docs manually`);
    }
  }
});

export default app;
