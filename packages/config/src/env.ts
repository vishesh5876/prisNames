import { z } from 'zod';

/**
 * Environment schema for all PrisNames applications.
 *
 * Applications validate environment variables at startup using this schema.
 * Missing or invalid values cause a fatal startup error with a descriptive message.
 *
 * IMPORTANT: This schema defines the structure. Actual values come from .env files
 * or deployment configuration. Never commit real credentials.
 */
export const envSchema = z.object({
  // --- Application ---
  NODE_ENV: z.enum(['development', 'test', 'staging', 'production']).default('development'),
  APP_ENV: z.enum(['development', 'test', 'staging', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  WORKER_PORT: z.coerce.number().int().positive().default(4001),

  // --- URLs ---
  API_URL: z.string().url().default('http://localhost:4000'),
  WEB_URL: z.string().url().default('http://localhost:3000'),

  // --- PostgreSQL ---
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  TEST_DATABASE_URL: z.string().optional(),

  // --- Redis ---
  REDIS_URL: z.string().min(1, 'REDIS_URL is required'),

  // --- Auth ---
  AUTH_SECRET: z.string().min(16, 'AUTH_SECRET must be at least 16 characters'),
  AUTH_OTP_PEPPER: z.string().min(32, 'AUTH_OTP_PEPPER must be at least 32 characters'),
  COOKIE_DOMAIN: z.string().default('localhost'),
  SESSION_MAX_AGE_SECONDS: z.coerce.number().int().positive().default(604800),

  // --- HTTP Security ---
  /** Fastify trustProxy config. false=none, true=all, number=hop count, string=comma-sep CIDRs */
  TRUST_PROXY: z.string().default('false'),
  HSTS_ENABLED: z.coerce.boolean().default(true),
  HSTS_MAX_AGE: z.coerce.number().int().nonnegative().default(63072000),
  HSTS_INCLUDE_SUBDOMAINS: z.coerce.boolean().default(false),
  HSTS_PRELOAD: z.coerce.boolean().default(false),

  // --- Dynadot ---
  DYNADOT_ENVIRONMENT: z.enum(['sandbox', 'production']).default('sandbox'),
  DYNADOT_API_KEY: z.string().default(''),
  DYNADOT_API_SECRET: z.string().default(''),
  DYNADOT_WEBHOOK_KEY: z.string().default(''),
  DYNADOT_WEBHOOK_SECRET: z.string().default(''),
  DYNADOT_ACCOUNT_TIER: z.enum(['REGULAR', 'BULK', 'SUPER_BULK']).default('REGULAR'),

  // --- Encryption ---
  ENCRYPTION_KEY: z.string().default(''),

  // --- Queue Encryption (BullMQ payload encryption) ---
  // Validated at runtime by createQueueEncryption() — required when queue is initialized.
  QUEUE_ENCRYPTION_KEY: z.string().default(''),
  QUEUE_ENCRYPTION_KEY_ID: z.string().default('k-auth-001'),

  // --- Email ---
  EMAIL_PROVIDER: z.string().default('mailpit'),
  EMAIL_FROM: z.string().default('noreply@prisnames.com'),
  SMTP_HOST: z.string().default('localhost'),
  SMTP_PORT: z.coerce.number().int().positive().default(1025),

  // --- Observability ---
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error', 'fatal']).default('debug'),
  LOG_FORMAT: z.enum(['pretty', 'json']).default('pretty'),
});

export type Env = z.infer<typeof envSchema>;
