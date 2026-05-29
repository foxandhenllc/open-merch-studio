import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env.js';
import { errorHandler, notFoundHandler } from './middleware.js';
import catalogRoutes from './routes/catalog.routes.js';
import designRoutes from './routes/design.routes.js';
import adminRoutes from './routes/admin.routes.js';
import { getCatalogHealth } from './controllers/catalog.controller.js';

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(
    cors({
      origin: [env.frontendUrl, 'http://localhost:5173', 'http://127.0.0.1:5173'],
      credentials: true,
    })
  );
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(morgan(env.nodeEnv === 'development' ? 'dev' : 'combined'));

  app.get('/', getCatalogHealth);
  app.get('/api/health', getCatalogHealth);
  app.use('/api/catalog', catalogRoutes);
  app.use('/api/design', designRoutes);
  app.use('/api/admin', adminRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
