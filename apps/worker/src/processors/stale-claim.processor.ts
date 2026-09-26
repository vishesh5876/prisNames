/**
 * PrisNames — Stale Claim Sweeper Processor
 *
 * Recovers operations stuck in PROCESSING with expired claims.
 * Attempt-aware: NOT_ATTEMPTED → RETRY_PENDING, else → UNKNOWN.
 *
 * Reference: Phase 6 Implementation Plan §14.4
 */

import { Worker, Queue } from 'bullmq';
import type Redis from 'ioredis';
import type { Logger } from 'pino';
import type { Database } from '@prisnames/database/client';
import { StandaloneOperationRepository } from '../lib/standalone-operation-repository.js';

const QUEUE_NAME = 'registrar-stale-claim';

export async function createStaleClaimProcessor(
  redis: Redis,
  db: Database,
  logger: Logger,
): Promise<{ worker: Worker; queue: Queue; cleanup: () => Promise<void> }> {
  const repo = new StandaloneOperationRepository(db);
  const queue = new Queue(QUEUE_NAME, { connection: redis });

  await queue.upsertJobScheduler('stale-claim-scheduler', { every: 120_000 }, {
    name: 'stale-claim-sweep',
  });

  const worker = new Worker(
    QUEUE_NAME,
    async () => {
      const recovered = await repo.recoverStaleClaims();
      if (recovered.length === 0) return;

      logger.info({ count: recovered.length }, 'Recovered stale claims');

      for (const op of recovered) {
        await repo.insertAuditLog({
          operationId: op.id,
          eventType: 'STALE_CLAIM_RECOVERED',
          fromStatus: 'PROCESSING',
          toStatus: op.status,
          actor: 'stale-claim-sweeper',
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
      await queue.close();
    },
  };
}
