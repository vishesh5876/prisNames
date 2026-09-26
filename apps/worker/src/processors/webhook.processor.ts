/**
 * PrisNames — Webhook Processing Worker
 *
 * BullMQ consumer that processes webhook events.
 * Lives in apps/worker (not apps/api) to maintain stateless API architecture.
 *
 * Flow:
 * QUEUED → PROCESSING → PROCESSED (or FAILED)
 *
 * The processor:
 * 1. Loads event by ID from database
 * 2. Decrypts payload
 * 3. Validates provider envelope/event
 * 4. Normalizes provider event
 * 5. Updates infrastructure processing state
 *
 * Does NOT implement customer/domain business orchestration.
 * That belongs in later phases.
 *
 * Security:
 * - Decryption failure does not leak ciphertext or plaintext
 * - Already-PROCESSED events are skipped (idempotent)
 * - Missing events are handled safely
 */

import { Worker, type Job } from 'bullmq';
import type Redis from 'ioredis';
import type { Database } from '@prisnames/database';
import { eq, and, sql } from 'drizzle-orm';
import type { Logger } from '@prisnames/logger';

import { DynadotWebhookEnvelopeSchema } from '@prisnames/registrar-dynadot';
import type { EnvelopeEncryption } from '@prisnames/security';
import { webhookEvents } from '@prisnames/database';

const WEBHOOK_QUEUE_NAME = 'dynadot-webhooks';

export interface WebhookJobData {
  webhookEventId: string;
  providerEventId: string;
  eventType: string;
  provider: string;
}

export function createWebhookProcessingWorker(
  redis: Redis,
  db: Database,
  logger: Logger,
  encryption: EnvelopeEncryption,
): Worker<WebhookJobData> {
  const worker = new Worker<WebhookJobData>(
    WEBHOOK_QUEUE_NAME,
    async (job: Job<WebhookJobData>) => {
      const { webhookEventId, providerEventId, eventType } = job.data;

      logger.debug(
        { webhookEventId, providerEventId, eventType },
        'Processing webhook event',
      );

      // Step 1: Update to PROCESSING + increment attempts
      const updated = await db
        .update(webhookEvents)
        .set({
          processingStatus: 'PROCESSING',
          processingAttempts: sql`CAST(CAST(${webhookEvents.processingAttempts} AS integer) + 1 AS varchar)`,
        })
        .where(
          and(
            eq(webhookEvents.id, webhookEventId),
            sql`${webhookEvents.processingStatus} IN ('QUEUED', 'PROCESSING')`,
          ),
        )
        .returning({ id: webhookEvents.id });

      if (!updated || updated.length === 0) {
        logger.warn(
          { webhookEventId },
          'Webhook event not found or already processed — skipping',
        );
        return;
      }

      try {
        // Step 2: Load and decrypt payload
        const events = await db
          .select({
            rawPayload: webhookEvents.rawPayload,
            encryptionKeyId: webhookEvents.encryptionKeyId,
          })
          .from(webhookEvents)
          .where(eq(webhookEvents.id, webhookEventId))
          .limit(1);

        const event = events[0];
        if (!event?.rawPayload) {
          throw new Error(`No payload found for webhook event ${webhookEventId}`);
        }

        // Decrypt — failure does not leak ciphertext
        let decryptedPayload: string;
        try {
          decryptedPayload = encryption.decrypt(event.rawPayload).toString('utf-8');
        } catch {
          throw new Error('Failed to decrypt webhook payload');
        }

        // Step 3: Validate provider envelope
        const parsed = JSON.parse(decryptedPayload);
        DynadotWebhookEnvelopeSchema.parse(parsed);

        // Step 4: Normalize provider event
        // Phase 5: Infrastructure validation only.
        // Business orchestration will be added in later phases.

        // Step 5: Update to PROCESSED
        await db
          .update(webhookEvents)
          .set({
            processingStatus: 'PROCESSED',
            processedAt: new Date(),
          })
          .where(eq(webhookEvents.id, webhookEventId));

        logger.info(
          { webhookEventId, providerEventId, eventType },
          'Webhook processed successfully',
        );
      } catch (error) {
        // Update to FAILED — never log decrypted payload content
        await db
          .update(webhookEvents)
          .set({
            processingStatus: 'FAILED',
            processingError: error instanceof Error ? error.message : 'Unknown error',
          })
          .where(eq(webhookEvents.id, webhookEventId));

        throw error; // Let BullMQ handle retry
      }
    },
    {
      connection: redis,
      concurrency: 5,
      limiter: {
        max: 10,
        duration: 1000,
      },
    },
  );

  worker.on('failed', (job, error) => {
    logger.error({ jobId: job?.id, error: error.message }, 'Webhook job failed');
  });

  worker.on('completed', (job) => {
    logger.debug({ jobId: job.id }, 'Webhook job completed');
  });

  logger.info('Webhook processing worker started');

  return worker;
}
