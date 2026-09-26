/**
 * PrisNames — Orphan Queued Sweeper Processor
 *
 * Re-enqueues QUEUED operations that have no active BullMQ job.
 */

import { Worker, Queue } from 'bullmq';
import type Redis from 'ioredis';
import type { Logger } from 'pino';
import type { Database } from '@prisnames/database/client';
import { StandaloneOperationRepository } from '../lib/standalone-operation-repository.js';

const QUEUE_NAME = 'registrar-orphan-queued';
const FULFILLMENT_QUEUE_NAME = 'registrar-fulfillment';

export async function createOrphanQueuedProcessor(
  redis: Redis,
  db: Database,
  logger: Logger,
): Promise<{ worker: Worker; queue: Queue; cleanup: () => Promise<void> }> {
  const repo = new StandaloneOperationRepository(db);
  const queue = new Queue(QUEUE_NAME, { connection: redis });
  const fulfillmentQueue = new Queue(FULFILLMENT_QUEUE_NAME, { connection: redis });

  await queue.upsertJobScheduler('orphan-queued-scheduler', { every: 180_000 }, {
    name: 'orphan-queued-sweep',
  });

  const worker = new Worker(
    QUEUE_NAME,
    async () => {
      const orphans = await repo.findOrphanQueued(20);
      if (orphans.length === 0) return;

      logger.info({ count: orphans.length }, 'Found orphan QUEUED operations');

      for (const orphan of orphans) {
        await fulfillmentQueue.add('registration', { operationId: orphan.id }, {
          jobId: orphan.id,
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
