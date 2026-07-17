# FCISeller E-Commerce Backend API

Production-grade luxury fashion e-commerce backend API built with Node.js, Express, TypeScript, PostgreSQL, and Prisma.

## 🚀 Features

- **Authentication**: JWT-based auth with refresh tokens, email verification, password reset
- **User Management**: Profile management, addresses, preferences, multi-device sessions
- **Product Management**: Full CRUD with variants, images, inventory, categories, brands
- **Cart & Wishlist**: Guest cart merge, quantity management, gift wrapping
- **Orders**: Complete order lifecycle, tracking, returns, refunds
- **Payments**: Architecture ready for Razorpay, Stripe, UPI, Cards, Wallet, COD
- **Reviews & Ratings**: Product reviews with images/videos, helpful votes
- **Notifications**: Push notifications (FCM), email ready
- **Coupons**: Discount system with validation and usage tracking
- **Search**: Advanced search with filters, pagination, and AI image search (Google Gemini Vision)
- **Analytics**: Event tracking for user behavior
- **Admin Dashboard**: Complete admin APIs for management

## 🛠 Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Language**: TypeScript
- **Database**: PostgreSQL
- **ORM**: Prisma
- **Authentication**: JWT + Refresh Tokens
- **Validation**: Zod
- **Security**: bcrypt, Helmet, Rate Limiting
- **File Upload**: Multer + Cloudinary
- **AI**: Google Gemini Vision
- **Notifications**: Firebase Cloud Messaging
- **Documentation**: Swagger/OpenAPI
- **Logging**: Winston

## 📋 Prerequisites

- Node.js >= 18.x
- PostgreSQL >= 14.x
- npm or yarn

## 🔧 Installation

1. Clone the repository:
```bash
cd hopscotch_backend
```

2. Install dependencies:
```bash
npm install
```

3. Copy environment variables:
```bash
cp .env.example .env
```

4. Configure environment variables in `.env`:
```env
NODE_ENV=development
PORT=5000
DATABASE_URL="postgresql://username:password@localhost:5432/hopscotch_db?schema=public"
JWT_SECRET=your-super-secret-jwt-key
REFRESH_TOKEN_SECRET=your-super-secret-refresh-token-key
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
GEMINI_API_KEY=your-gemini-api-key
```

5. Generate Prisma client:
```bash
npm run prisma:generate
```

6. Run database migrations:
```bash
npm run prisma:migrate
```

7. Start the development server:
```bash
npm run dev
```

## 📁 Project Structure

```
hopscotch_backend/
├── prisma/
│   └── schema.prisma          # Database schema
├── src/
│   ├── index.ts               # Application entry point
│   ├── middleware/            # Express middleware
│   │   ├── auth.ts           # Authentication middleware
│   │   ├── errorHandler.ts   # Global error handler
│   │   ├── notFoundHandler.ts
│   │   └── rateLimiter.ts    # Rate limiting
│   ├── modules/              # Feature modules
│   │   ├── auth/            # Authentication module
│   │   │   ├── controllers/
│   │   │   ├── dto/
│   │   │   ├── repositories/
│   │   │   ├── routes/
│   │   │   ├── services/
│   │   │   └── validators/
│   │   ├── user/            # User module
│   │   ├── category/        # Category module
│   │   ├── product/         # Product module
│   │   ├── cart/            # Cart module
│   │   ├── wishlist/        # Wishlist module
│   │   ├── address/         # Address module
│   │   ├── order/           # Order module
│   │   ├── review/          # Review module
│   │   ├── notification/    # Notification module
│   │   ├── coupon/          # Coupon module
│   │   ├── home/            # Home module
│   │   └── search/          # Search module
│   └── utils/               # Utility functions
│       ├── logger.ts        # Winston logger
│       ├── prisma.ts        # Prisma client
│       └── responseFormatter.ts
├── .env.example
├── .gitignore
├── package.json
├── tsconfig.json
└── README.md
```

## 🔌 API Documentation

Once the server is running, visit:
- **API Docs**: http://localhost:5000/api-docs
- **Health Check**: http://localhost:5000/health

## 📊 Database Schema

The application uses the following main entities:

- **Users**: User accounts with roles and preferences
- **Products**: Products with variants, images, inventory
- **Categories**: Hierarchical category structure
- **Brands**: Brand information
- **Cart**: Shopping cart management
- **Wishlist**: User wishlist
- **Addresses**: User shipping addresses
- **Orders**: Order management
- **Reviews**: Product reviews
- **Coupons**: Discount coupons
- **Notifications**: User notifications
- **Analytics**: Event tracking

## 🔐 Authentication

The API uses JWT (JSON Web Tokens) for authentication:

1. **Register**: `POST /api/auth/register`
2. **Login**: `POST /api/auth/login`
3. **Refresh Token**: `POST /api/auth/refresh`
4. **Logout**: `POST /api/auth/logout`

Protected routes require the `Authorization` header:
```
Authorization: Bearer <access_token>
```

## 🚦 API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `POST /api/auth/refresh` - Refresh access token
- `POST /api/auth/logout` - Logout user
- `POST /api/auth/logout-all` - Logout from all devices
- `POST /api/auth/change-password` - Change password
- `POST /api/auth/forgot-password` - Request password reset
- `POST /api/auth/reset-password` - Reset password
- `DELETE /api/auth/delete-account` - Delete account

### Products
- `GET /api/products` - List products (with filters, pagination)
- `GET /api/products/:id` - Get product details
- `GET /api/products/trending` - Get trending products
- `GET /api/products/new-arrivals` - Get new arrivals

### Categories
- `GET /api/categories` - List categories
- `GET /api/categories/:id` - Get category details

### Cart
- `GET /api/cart` - Get user's cart
- `POST /api/cart/add` - Add item to cart
- `PUT /api/cart/:itemId` - Update cart item
- `DELETE /api/cart/:itemId` - Remove item from cart

### Wishlist
- `GET /api/wishlist` - Get wishlist
- `POST /api/wishlist/add` - Add to wishlist
- `DELETE /api/wishlist/:itemId` - Remove from wishlist

### Orders
- `GET /api/orders` - Get order history
- `POST /api/orders` - Create order
- `GET /api/orders/:id` - Get order details
- `GET /api/orders/:id/track` - Track order

### Reviews
- `POST /api/reviews` - Create review
- `GET /api/reviews/:productId` - Get product reviews
- `PUT /api/reviews/:id` - Update review
- `DELETE /api/reviews/:id` - Delete review

## 🧪 Testing

```bash
npm test
```

## 📝 Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build TypeScript to JavaScript
- `npm start` - Start production server
- `npm run prisma:generate` - Generate Prisma client
- `npm run prisma:migrate` - Run database migrations
- `npm run prisma:studio` - Open Prisma Studio
- `npm run lint` - Run ESLint
- `npm run format` - Format code with Prettier

## 🔒 Security Features

- Password hashing with bcrypt (12 rounds)
- JWT access tokens (15min expiry)
- Refresh tokens (7 days expiry)
- Rate limiting on all endpoints
- Helmet for security headers
- CORS configuration
- Input validation with Zod
- SQL injection protection via Prisma

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## 📄 License

ISC

## 👥 Authors

- FCISeller Development Team

## 🙏 Acknowledgments

- Built with Clean Architecture principles
- Following SOLID principles
- Production-ready code quality
