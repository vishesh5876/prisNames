/**
 * PrisNames — Webhook Business Outbox Processor
 *
 * Consumes webhook business events from the outbox table.
 */

import { Worker, Queue } from 'bullmq';
import type Redis from 'ioredis';
import type { Logger } from 'pino';
import type { Database } from '@prisnames/database/client';
import { sql } from 'drizzle-orm';
import { REGISTRAR_OP_STATUS } from '@prisnames/database';
import { StandaloneOperationRepository } from '../lib/standalone-operation-repository.js';

const QUEUE_NAME = 'webhook-business-outbox';

interface OutboxRow {
  id: string;
  webhook_event_id: string;
  provider_identity: string;
  event_type: string;
  event_payload: Record<string, unknown>;
  status: string;
  created_at: Date;
}

export async function createWebhookBusinessOutboxProcessor(
  redis: Redis,
  db: Database,
  logger: Logger,
): Promise<{ worker: Worker; queue: Queue; cleanup: () => Promise<void> }> {
  const repo = new StandaloneOperationRepository(db);
  const queue = new Queue(QUEUE_NAME, { connection: redis });

  await queue.upsertJobScheduler('webhook-outbox-scheduler', { every: 15_000 }, {
    name: 'webhook-outbox-sweep',
  });

  const worker = new Worker(
    QUEUE_NAME,
    async () => {
      const entries = await db.execute(sql`
        SELECT * FROM webhook_business_outbox
        WHERE status = 'PENDING'
        ORDER BY created_at ASC
        LIMIT 10
        FOR UPDATE SKIP LOCKED
      `) as unknown as OutboxRow[];

      if (!entries || entries.length === 0) return;

      logger.info({ count: entries.length }, 'Processing webhook outbox entries');

      for (const entry of entries) {
        try {
          const payload = entry.event_payload;

          if (payload.eventType === 'ORDER_COMPLETED' && 'providerOrderId' in payload) {
            const providerOrderId = payload.providerOrderId as string;
            // Find matching operation
            const op = await repo.findByProviderOrder('', providerOrderId);

            if (op) {
              const targetStatus = payload.orderStatus === 'completed'
                ? REGISTRAR_OP_STATUS.SUCCEEDED
                : REGISTRAR_OP_STATUS.FAILED;

              await repo.writeWebhookResult(op.id, op.registrarProviderId, providerOrderId, {
                status: targetStatus,
                isTerminal: true,
              });

              await repo.insertAuditLog({
                operationId: op.id,
                eventType: 'WEBHOOK_RESOLVED',
                fromStatus: op.status,
                toStatus: targetStatus,
                actor: 'webhook-outbox',
              });
            }
          }

          await db.execute(sql`
            UPDATE webhook_business_outbox
            SET status = 'COMPLETED', processed_at = now()
            WHERE id = ${entry.id}
          `);
        } catch (err) {
          logger.error({ err, entryId: entry.id }, 'Failed to process outbox entry');
          await db.execute(sql`
            UPDATE webhook_business_outbox
            SET error = ${(err as Error).message}
            WHERE id = ${entry.id}
          `);
        }
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
