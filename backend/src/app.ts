import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env.js';
import { errorHandler, notFoundHandler, requestContext } from './middleware.js';
import catalogRoutes from './routes/catalog.routes.js';
import designRoutes from './routes/design.routes.js';
import adminRoutes from './routes/admin.routes.js';
import commerceRoutes from './routes/commerce.routes.js';
import storefrontRoutes from './routes/storefront.routes.js';
import { getCatalogHealth } from './controllers/catalog.controller.js';
import { postStripeWebhook } from './controllers/commerce.controller.js';
import { postPrintfulWebhook } from './controllers/printful-webhook.controller.js';
import { redactRequestUrl } from './utils/operational-logger.js';

morgan.token('safe-url', (req) => {
  const url = (req as typeof req & { originalUrl?: string }).originalUrl || req.url || '';
  return redactRequestUrl(url);
});

const productionRequestLog =
  ':remote-addr - :remote-user [:date[clf]] ":method :safe-url HTTP/:http-version" :status :res[content-length] :response-time ms ":user-agent"';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    })
  );
  app.use(
    cors({
      origin: [env.frontendUrl, 'http://localhost:5173', 'http://127.0.0.1:5173'],
      credentials: true,
    })
  );
  app.use(requestContext);
  app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), postStripeWebhook);
  app.post('/api/printful/webhook', express.raw({ type: 'application/json' }), postPrintfulWebhook);
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '100kb', parameterLimit: 100 }));
  app.use(
    morgan(
      env.nodeEnv === 'development'
        ? ':method :safe-url :status :response-time ms - :res[content-length]'
        : productionRequestLog,
      {
        stream: {
          write: (message) => console.info(message.trim()),
        },
      }
    )
  );

  app.get('/', getCatalogHealth);
  app.get('/api/health', getCatalogHealth);
  app.use('/api/catalog', catalogRoutes);
  app.use('/api/design', designRoutes);
  app.use('/api/storefronts', storefrontRoutes);
  app.use('/api', commerceRoutes);
  app.use('/api/admin', adminRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
