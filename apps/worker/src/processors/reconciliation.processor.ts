/**
 * PrisNames — Reconciliation Processor
 *
 * Claims ACCEPTED/UNKNOWN operations, queries provider, writes result.
 * Strong correlation, exponential backoff, exhaustion → MANUAL_REVIEW.
 */

import { Worker, Queue } from 'bullmq';
import type Redis from 'ioredis';
import type { Logger } from 'pino';
import type { Database } from '@prisnames/database/client';
import {
  RegistrarCapability,
  type RegistrarProvider,
} from '@prisnames/registrar-core';
import { REGISTRAR_OP_STATUS } from '@prisnames/database';
import { StandaloneOperationRepository } from '../lib/standalone-operation-repository.js';

const QUEUE_NAME = 'registrar-reconciliation';

export async function createReconciliationProcessor(
  redis: Redis,
  db: Database,
  logger: Logger,
  provider: RegistrarProvider,
): Promise<{ worker: Worker; queue: Queue; cleanup: () => Promise<void> }> {
  const repo = new StandaloneOperationRepository(db);
  const queue = new Queue(QUEUE_NAME, { connection: redis });

  await queue.upsertJobScheduler('reconciliation-scheduler', { every: 30_000 }, {
    name: 'reconciliation-sweep',
  });

  const worker = new Worker(
    QUEUE_NAME,
    async () => {
      const claimed = await repo.claimForReconciliation(10);
      if (claimed.length === 0) return;

      logger.info({ count: claimed.length }, 'Reconciliation sweep: claimed operations');

      for (const op of claimed) {
        const reconToken = op.reconciliationClaimToken;
        if (!reconToken) continue;

        const isLastAttempt = (op.reconciliationAttempts + 1) >= op.maxReconciliationAttempts;

        try {
          const ordersCap = provider.getCapability(RegistrarCapability.ORDER_MANAGEMENT);
          const infoCap = provider.getCapability(RegistrarCapability.DOMAIN_INFO);

          let verified = false;
          let method = 'UNKNOWN';

          // Strong correlation: providerOrderId required
          if (op.providerOrderId && ordersCap) {
            const orderResult = await ordersCap.getOrderStatus(op.providerOrderId);
            if (orderResult) {
              if (orderResult.status === 'completed' || orderResult.status === 'COMPLETED') {
                if (infoCap && op.fqdn) {
                  const domainInfo = await infoCap.getDomainInfo(op.fqdn);
                  if (domainInfo?.domainName) {
                    verified = true;
                    method = 'ORDER_STATUS_THEN_DOMAIN_INFO';
                  }
                }
              } else if (orderResult.status === 'failed' || orderResult.status === 'FAILED') {
                // Correction 3: FAILED via reconciliation
                await repo.writeReconciliationResult(op.id, reconToken, {
                  status: REGISTRAR_OP_STATUS.FAILED,
                  reconciliationMethod: 'ORDER_STATUS',
                  nextReconciliationAt: null,
                  isTerminal: true,
                });
                await repo.insertAuditLog({
                  operationId: op.id,
                  eventType: 'RECONCILIATION_RESOLVED',
                  fromStatus: op.status,
                  toStatus: REGISTRAR_OP_STATUS.FAILED,
                  actor: 'reconciliation',
                });
                continue;
              }
            }
          }

          if (verified) {
            await repo.writeReconciliationResult(op.id, reconToken, {
              status: REGISTRAR_OP_STATUS.SUCCEEDED,
              reconciliationMethod: method,
              nextReconciliationAt: null,
              isTerminal: true,
            });
            await repo.insertAuditLog({
              operationId: op.id,
              eventType: 'RECONCILIATION_RESOLVED',
              fromStatus: op.status,
              toStatus: REGISTRAR_OP_STATUS.SUCCEEDED,
              actor: 'reconciliation',
            });
          } else if (isLastAttempt) {
            await repo.writeReconciliationResult(op.id, reconToken, {
              status: REGISTRAR_OP_STATUS.MANUAL_REVIEW,
              nextReconciliationAt: null,
              isExhausted: true,
              manualReviewReason: `Reconciliation exhausted after ${op.reconciliationAttempts + 1} attempts`,
            });
            await repo.insertAuditLog({
              operationId: op.id,
              eventType: 'RECONCILIATION_EXHAUSTED',
              fromStatus: op.status,
              toStatus: REGISTRAR_OP_STATUS.MANUAL_REVIEW,
              actor: 'reconciliation',
            });
          } else {
            const nextDelay = Math.min(30_000 * Math.pow(2, op.reconciliationAttempts), 900_000);
            await repo.writeReconciliationResult(op.id, reconToken, {
              nextReconciliationAt: new Date(Date.now() + nextDelay),
            });
            await repo.insertAuditLog({
              operationId: op.id,
              eventType: 'RECONCILIATION_ATTEMPT',
              actor: 'reconciliation',
            });
          }
        } catch (err) {
          logger.error({ err, opId: op.id }, 'Reconciliation failed for operation');
          await repo.writeReconciliationResult(op.id, reconToken, {
            nextReconciliationAt: new Date(Date.now() + 60_000),
          });
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
