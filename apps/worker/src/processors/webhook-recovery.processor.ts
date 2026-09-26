/**
 * PrisNames — Webhook Recovery Scheduler
 *
 * Periodically recovers stranded webhook events stuck in RECEIVED state.
 * Lives in apps/worker to avoid duplicate schedulers from multiple API replicas.
 *
 * Uses BullMQ v5.81.5 upsertJobScheduler API.
 * Deterministic scheduler ID 'dynadot-webhook-recovery' ensures:
 *   - Multiple worker instances calling upsertJobScheduler → one logical scheduler
 *   - Idempotent across restarts
 *
 * Events stuck in RECEIVED state (BullMQ add failed after DB insert)
 * are recovered by re-queueing with deterministic job IDs.
 */

import { Queue, Worker, type Job } from 'bullmq';
import type Redis from 'ioredis';
import type { Database } from '@prisnames/database';
import { eq, and, sql } from 'drizzle-orm';
import type { Logger } from '@prisnames/logger';

import { generateWebhookJobId } from '@prisnames/registrar-dynadot';
import { webhookEvents } from '@prisnames/database';

const RECOVERY_QUEUE_NAME = 'webhook-recovery';
const WEBHOOK_QUEUE_NAME = 'dynadot-webhooks';

/** Deterministic scheduler ID — idempotent across multiple worker starts */
export const RECOVERY_SCHEDULER_ID = 'dynadot-webhook-recovery';

export interface WebhookRecoveryResult {
  queue: Queue;
  worker: Worker;
  cleanup: () => Promise<void>;
}

export async function createWebhookRecoveryScheduler(
  redis: Redis,
  db: Database,
  logger: Logger,
): Promise<WebhookRecoveryResult> {
  // Queue for the webhook processing target
  const webhookQueue = new Queue(WEBHOOK_QUEUE_NAME, {
    connection: redis,
  });

  // Recovery queue
  const recoveryQueue = new Queue(RECOVERY_QUEUE_NAME, {
    connection: redis,
  });

  // upsertJobScheduler (BullMQ v5.81.5+)
  // Deterministic: multiple worker instances calling this → one logical scheduler
  // Idempotent across restarts — same schedulerID + same repeat config → no-op
  await recoveryQueue.upsertJobScheduler(
    RECOVERY_SCHEDULER_ID,
    { every: 60_000 }, // Every 60 seconds
    {
      name: 'recover-stranded-events',
      opts: {
        removeOnComplete: true,
        removeOnFail: { age: 3600 },
      },
    },
  );

  // Worker processes recovery jobs
  const recoveryWorker = new Worker(
    RECOVERY_QUEUE_NAME,
    async (_job: Job) => {
      const staleThreshold = new Date(Date.now() - 60_000);

      const strandedEvents = await db
        .select({
          id: webhookEvents.id,
          providerEventId: webhookEvents.providerEventId,
          eventType: webhookEvents.eventType,
        })
        .from(webhookEvents)
        .where(
          and(
            eq(webhookEvents.processingStatus, 'RECEIVED'),
            sql`${webhookEvents.receivedAt} < ${staleThreshold}`,
          ),
        )
        .limit(50);

      let recovered = 0;
      for (const event of strandedEvents) {
        const jobId = generateWebhookJobId('dynadot', event.providerEventId);
        try {
          await webhookQueue.add(
            'process-webhook',
            {
              webhookEventId: event.id,
              providerEventId: event.providerEventId,
              eventType: event.eventType,
              provider: 'dynadot',
            },
            { jobId },
          );

          await db
            .update(webhookEvents)
            .set({
              processingStatus: 'QUEUED',
              queuedAt: new Date(),
            })
            .where(
              and(
                eq(webhookEvents.id, event.id),
                eq(webhookEvents.processingStatus, 'RECEIVED'),
              ),
            );

          recovered++;
        } catch {
          // Job already exists or DB update failed — safe to skip
          logger.debug(
            { webhookEventId: event.id, providerEventId: event.providerEventId },
            'Recovery: event already queued or re-queue failed',
          );
        }
      }

      if (recovered > 0) {
        logger.info({ recovered }, 'Recovered stranded webhook events');
      }
    },
    {
      connection: redis,
      concurrency: 1, // Only one recovery pass at a time
    },
  );

  recoveryWorker.on('failed', (_job, error) => {
    logger.error({ error: error.message }, 'Recovery job failed');
  });

  logger.info('Webhook recovery scheduler started (every 60s)');

  const cleanup = async () => {
    await recoveryWorker.close();
    await recoveryQueue.close();
    await webhookQueue.close();
    logger.info('Webhook recovery scheduler stopped');
  };

  return { queue: recoveryQueue, worker: recoveryWorker, cleanup };
}
