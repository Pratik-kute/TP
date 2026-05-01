import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { config } from './config.js';
import { requestId } from './middleware/requestId.js';
import { usageLog } from './middleware/usageLog.js';
import { errorHandler, notFound } from './middleware/error.js';

import authRoutes from './routes/auth.js';
import assetRoutes from './routes/assets.js';
import maintenanceRoutes from './routes/maintenance.js';
import repairRoutes from './routes/repairs.js';
import recoveryRoutes from './routes/recovery.js';
import auditRoutes from './routes/audit.js';
import referenceRoutes from './routes/reference.js';
import healthRoutes from './routes/health.js';
import adminApiKeysRoutes from './routes/adminApiKeys.js';

export function createApp() {
  const app = express();

  app.set('trust proxy', 1); // honour X-Forwarded-For from one proxy hop
  app.disable('x-powered-by');

  app.use(helmet({ crossOriginResourcePolicy: false }));

  app.use(cors({
    origin: (origin, cb) => {
      // Allow no-origin (curl, mobile) and any whitelisted origin.
      if (!origin) return cb(null, true);
      if (config.corsOrigins.length === 0) return cb(null, true);
      if (config.corsOrigins.includes(origin)) return cb(null, true);
      cb(new Error(`CORS: origin ${origin} not allowed`));
    },
    credentials: false,
    allowedHeaders: [
      'authorization', 'content-type',
      'x-request-id', 'x-admin-user-id', 'idempotency-key',
    ],
    exposedHeaders: [
      'x-request-id',
      'x-ratelimit-limit', 'x-ratelimit-remaining', 'x-ratelimit-reset',
      'retry-after',
    ],
    maxAge: 86400,
  }));

  app.use(express.json({ limit: '1mb' }));
  app.use(requestId);
  app.use(usageLog);

  // Public, no auth.
  app.use('/health', healthRoutes);

  // Admin routes (the React management page) — auth handled in router.
  app.use('/api/v1/admin/api-keys', adminApiKeysRoutes);

  // Mobile API. Each router enforces requireApiKey + apiKeyRateLimit
  // internally via the `mobileAuth` chain.
  app.use('/api/v1/auth',      authRoutes);
  app.use('/api/v1/assets',    assetRoutes);
  app.use('/api/v1/reference', referenceRoutes);
  // The next four routers mount paths starting with /assets, /repairs,
  // /maintenance, /recovery, /audit — keep the prefix as /api/v1.
  app.use('/api/v1', maintenanceRoutes);
  app.use('/api/v1', repairRoutes);
  app.use('/api/v1', recoveryRoutes);
  app.use('/api/v1', auditRoutes);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
