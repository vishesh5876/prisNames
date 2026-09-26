import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../../../.env') });

import { validateEnv } from '@prisnames/config';
import { createLogger } from '@prisnames/logger';
import { SmtpEmailProvider } from '@prisnames/email-core';
import { createQueueEncryption } from '@prisnames/security';
import { createDb } from '@prisnames/database';
import Redis from 'ioredis';
import { createAuthEmailWorker } from './processors/auth-email.processor.js';
import { createWebhookProcessingWorker } from './processors/webhook.processor.js';
import { createWebhookRecoveryScheduler } from './processors/webhook-recovery.processor.js';
// Phase 6: Registrar orchestration processors
import { createStaleClaimProcessor } from './processors/stale-claim.processor.js';
import { createOrphanQueuedProcessor } from './processors/orphan-queued.processor.js';
import { createRetryProcessor } from './processors/retry.processor.js';
import { createWebhookBusinessOutboxProcessor } from './processors/webhook-business-outbox.processor.js';
// NOTE: domain-registration.processor and reconciliation.processor
// require a RegistrarProvider instance. They are registered conditionally
// when provider credentials are available. See composition root pattern.

const env = validateEnv();

const logger = createLogger({
  service: 'worker',
  level: env.LOG_LEVEL,
  pretty: env.LOG_FORMAT === 'pretty',
});

logger.info('PrisNames Worker starting...');

// ─── Redis Connection ─────────────────────────────────
const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null, // Required by BullMQ
  lazyConnect: true,
});

redis.on('error', (err) => {
  logger.error({ err: err.message }, 'Worker Redis error');
});

await redis.connect();
logger.info('Worker connected to Redis');

// ─── Database Connection ──────────────────────────────
const { db } = createDb(env.DATABASE_URL);
logger.info('Worker connected to database');

// ─── Email Provider ───────────────────────────────────
const emailProvider = new SmtpEmailProvider({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  from: env.EMAIL_FROM,
});

// ─── Queue Encryption ─────────────────────────────────
const encryption = createQueueEncryption(
  env.QUEUE_ENCRYPTION_KEY,
  env.QUEUE_ENCRYPTION_KEY_ID,
);

// ─── Auth Email Worker ────────────────────────────────
const authEmailWorker = createAuthEmailWorker(
  redis,
  emailProvider,
  logger,
  env.WEB_URL,
  encryption,
);

logger.info('Auth email worker registered');

// ─── Webhook Processing Worker ────────────────────────
const webhookWorker = createWebhookProcessingWorker(
  redis,
  db,
  logger,
  encryption,
);

logger.info('Webhook processing worker registered');

// ─── Webhook Recovery Scheduler ───────────────────────
const webhookRecovery = await createWebhookRecoveryScheduler(
  redis,
  db,
  logger,
);

logger.info('Webhook recovery scheduler registered');

// ─── Phase 6: Registrar Sweeper Processors ────────────
const staleClaim = await createStaleClaimProcessor(redis, db, logger);
logger.info('Stale claim processor registered');

const orphanQueued = await createOrphanQueuedProcessor(redis, db, logger);
logger.info('Orphan queued processor registered');

const retryProcessor = await createRetryProcessor(redis, db, logger);
logger.info('Retry processor registered');

const webhookOutbox = await createWebhookBusinessOutboxProcessor(redis, db, logger);
logger.info('Webhook business outbox processor registered');

// NOTE: Registration fulfillment and reconciliation processors require
// a RegistrarProvider instance. They are conditionally registered when
// provider configuration is available. In sandbox/testing, they may
// run with a mock provider.

// ─── Graceful Shutdown ────────────────────────────────
async function shutdown(signal: string) {
  logger.info({ signal }, 'Shutdown signal received, closing gracefully...');
  await authEmailWorker.close();
  await webhookWorker.close();
  await webhookRecovery.cleanup();
  // Phase 6 processors
  await staleClaim.cleanup();
  await orphanQueued.cleanup();
  await retryProcessor.cleanup();
  await webhookOutbox.cleanup();
  await redis.quit();
  process.exit(0);
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

logger.info(
  { redisUrl: env.REDIS_URL.replace(/\/\/.*@/, '//***@') },
  'PrisNames Worker ready',
);
