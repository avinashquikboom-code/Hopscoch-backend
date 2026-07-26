import fs from 'fs';
import path from 'path';
import swaggerJsdoc from 'swagger-jsdoc';

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
const docsDir = path.join(__dirname, '../../public/docs');

if (!fs.existsSync(docsDir)) {
  fs.mkdirSync(docsDir, { recursive: true });
}

fs.writeFileSync(path.join(docsDir, 'openapi.json'), JSON.stringify(swaggerSpec, null, 2));

const htmlContent = `<!DOCTYPE html>
<html>
  <head>
    <title>FCISeller API Reference (Scalar)</title>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      body { margin: 0; padding: 0; }
    </style>
  </head>
  <body>
    <script
      id="api-reference"
      type="application/json"
    >${JSON.stringify(swaggerSpec)}</script>
    <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
  </body>
</html>`;

fs.writeFileSync(path.join(docsDir, 'index.html'), htmlContent);
console.log('✅ Generated public/docs/openapi.json and public/docs/index.html successfully!');
