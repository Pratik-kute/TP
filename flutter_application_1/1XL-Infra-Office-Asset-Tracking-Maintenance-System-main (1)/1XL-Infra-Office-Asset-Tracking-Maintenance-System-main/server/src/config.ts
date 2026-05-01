import { z } from 'zod';

const schema = z.object({
  PORT: z.coerce.number().int().positive().default(4000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
  CORS_ORIGINS: z.string().default(''),

  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),

  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_ACCESS_TTL_SECONDS: z.coerce.number().int().positive().default(1800),
  JWT_REFRESH_TTL_SECONDS: z.coerce.number().int().positive().default(2592000),

  BCRYPT_COST: z.coerce.number().int().min(8).max(14).default(10),

  IDEMPOTENCY_TTL_HOURS: z.coerce.number().int().positive().default(24),

  PHOTO_BUCKET: z.string().default('asset-images'),
  PHOTO_MAX_BYTES: z.coerce.number().int().positive().default(10 * 1024 * 1024),
  PHOTO_PRESIGNED_TTL_SECONDS: z.coerce.number().int().positive().default(600),

  LOGIN_RATE_LIMIT_PER_15MIN: z.coerce.number().int().positive().default(20),
  DEFAULT_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(120),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  console.error('[config] Invalid environment variables:');
  for (const issue of parsed.error.issues) {
    console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
  }
  process.exit(1);
}

export const config = {
  ...parsed.data,
  corsOrigins: parsed.data.CORS_ORIGINS.split(',').map(s => s.trim()).filter(Boolean),
  isProd: parsed.data.NODE_ENV === 'production',
};

export type Config = typeof config;
