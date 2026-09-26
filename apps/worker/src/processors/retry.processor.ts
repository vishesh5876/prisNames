/**
 * PrisNames — Retry Processor
 *
 * Re-enqueues RETRY_PENDING operations and sweeps exhausted retries.
 */

import { Worker, Queue } from 'bullmq';
import type Redis from 'ioredis';
import type { Logger } from 'pino';
import type { Database } from '@prisnames/database/client';
import { StandaloneOperationRepository } from '../lib/standalone-operation-repository.js';

const QUEUE_NAME = 'registrar-retry';
const FULFILLMENT_QUEUE_NAME = 'registrar-fulfillment';

export async function createRetryProcessor(
  redis: Redis,
  db: Database,
  logger: Logger,
): Promise<{ worker: Worker; queue: Queue; cleanup: () => Promise<void> }> {
  const repo = new StandaloneOperationRepository(db);
  const queue = new Queue(QUEUE_NAME, { connection: redis });
  const fulfillmentQueue = new Queue(FULFILLMENT_QUEUE_NAME, { connection: redis });

  await queue.upsertJobScheduler('retry-scheduler', { every: 30_000 }, {
    name: 'retry-sweep',
  });

  const worker = new Worker(
    QUEUE_NAME,
    async () => {
      // First: sweep exhausted retries → MANUAL_REVIEW
      const exhausted = await repo.sweepExhaustedRetries();
      if (exhausted.length > 0) {
        logger.info({ count: exhausted.length }, 'Exhausted retries escalated to MANUAL_REVIEW');
        for (const op of exhausted) {
          await repo.insertAuditLog({
            operationId: op.id,
            eventType: 'RETRY_EXHAUSTED',
            fromStatus: 'RETRY_PENDING',
            toStatus: 'MANUAL_REVIEW',
            actor: 'retry-sweeper',
          });
        }
      }

      // Then: re-enqueue retryable operations
      const retryable = await repo.findRetryable(10);
      if (retryable.length === 0) return;

      logger.info({ count: retryable.length }, 'Re-enqueuing retryable operations');

      for (const op of retryable) {
        await fulfillmentQueue.add('registration', { operationId: op.id }, {
          jobId: op.id,
          attempts: 1,
          removeOnComplete: true,
          removeOnFail: true,
        });
      }
    },
    { connection: redis, concurrency: 1 },
  );

  return {
    worker,
    queue,
    cleanup: async () => {
      await worker.close();
      await fulfillmentQueue.close();
      await queue.close();
    },
  };
}
