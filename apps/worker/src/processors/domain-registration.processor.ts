/**
 * PrisNames — Domain Registration Processor
 *
 * BullMQ worker for registrar fulfillment jobs.
 * TX2 → provider call → TX3 sequence.
 */

import { Worker, Queue } from 'bullmq';
import type Redis from 'ioredis';
import type { Logger } from 'pino';
import type { Database } from '@prisnames/database/client';
import {
  RegistrarCapability,
  ProviderErrorCode,
  ProviderError,
  type RegistrarProvider,
  type ProviderOperationResult,
} from '@prisnames/registrar-core';
import { REGISTRAR_OP_STATUS } from '@prisnames/database';
import { StandaloneOperationRepository } from '../lib/standalone-operation-repository.js';
import { OperationResultHandler } from '../lib/operation-result-handler.js';

const QUEUE_NAME = 'registrar-fulfillment';

export function createDomainRegistrationProcessor(
  redis: Redis,
  db: Database,
  logger: Logger,
  provider: RegistrarProvider,
): { worker: Worker; queue: Queue } {
  const repo = new StandaloneOperationRepository(db);
  const resultHandler = new OperationResultHandler();
  const workerId = `worker-${process.pid}-${Date.now()}`;

  const queue = new Queue(QUEUE_NAME, { connection: redis });

  const worker = new Worker(
    QUEUE_NAME,
    async (job) => {
      const { operationId } = job.data as { operationId: string };
      logger.info({ operationId, jobId: job.id }, 'Processing registration');

      // TX2: Claim
      const claim = await repo.claimForProcessing(operationId, workerId);
      if (!claim.claimed || !claim.operation || !claim.claimToken) {
        logger.info({ operationId }, 'Could not claim operation — skipping');
        return;
      }

      const op = claim.operation;
      const claimToken = claim.claimToken;

      await repo.insertAuditLog({
        operationId,
        eventType: 'CLAIM_ACQUIRED',
        actor: workerId,
      });

      // Mark attempt started
      const marked = await repo.markAttemptStarted(operationId, claimToken);
      if (!marked) {
        logger.warn({ operationId }, 'Failed to mark attempt started — claim lost');
        return;
      }

      // Provider call (NO open PostgreSQL TX)
      let result: ProviderOperationResult;
      let classified;

      try {
        const regCap = provider.getCapability(RegistrarCapability.DOMAIN_REGISTER);
        if (!regCap) {
          throw new ProviderError(
            ProviderErrorCode.CAPABILITY_UNSUPPORTED,
            'Registration capability not available',
            provider.providerId,
          );
        }

        const metadata = op.operationMetadata as { type: string; years: number; privacyEnabled: boolean } | null;

        result = await regCap.registerDomain({
          domain: op.fqdn!,
          duration: metadata?.years ?? 1,
          privacy: metadata?.privacyEnabled ? 'full' : 'none',
        });

        classified = resultHandler.classifySuccess(result);
      } catch (err) {
        const providerErr = err instanceof ProviderError ? err : undefined;
        classified = resultHandler.classifyError(providerErr?.code, true);

        logger.error({ err, operationId }, 'Provider call failed');

        // TX3: Write failure
        const writeResult = await repo.writeWorkerResult(operationId, claimToken, {
          status: classified.status,
          attemptStatus: classified.attemptStatus,
          providerErrorCode: providerErr?.code,
          providerErrorRetryable: providerErr?.retryable,
          providerResponseCode: providerErr?.httpStatus,
          providerRequestId: providerErr?.providerRequestId,
          nextRetryAt: classified.needsRetry ? new Date(Date.now() + 30_000) : undefined,
          nextReconciliationAt: classified.needsReconciliation ? new Date(Date.now() + 30_000) : undefined,
          manualReviewReason: classified.status === REGISTRAR_OP_STATUS.MANUAL_REVIEW ? classified.reason : undefined,
          lastError: (err as Error).message,
          isTerminal: classified.isTerminal,
        });

        if (writeResult.written) {
          await repo.insertAuditLog({
            operationId,
            eventType: 'STATUS_CHANGE',
            fromStatus: REGISTRAR_OP_STATUS.PROCESSING,
            toStatus: classified.status,
            actor: workerId,
          });
        }

        return;
      }

      // TX3: Write result
      const writeResult = await repo.writeWorkerResult(operationId, claimToken, {
        status: classified.status,
        attemptStatus: classified.attemptStatus,
        providerOrderId: result.providerOrderId,
        providerResponseCode: result.rawHttpStatus,
        providerRequestId: result.providerRequestId,
        nextReconciliationAt: classified.needsReconciliation ? new Date(Date.now() + 30_000) : undefined,
        isTerminal: classified.isTerminal,
      });

      if (!writeResult.written) {
        logger.warn({ operationId }, 'Stale claim — result write rejected');
        return;
      }

      await repo.insertAuditLog({
        operationId,
        eventType: 'STATUS_CHANGE',
        fromStatus: REGISTRAR_OP_STATUS.PROCESSING,
        toStatus: classified.status,
        providerHttpStatus: result.rawHttpStatus,
        actor: workerId,
      });

      logger.info({ operationId, status: classified.status }, 'Registration result committed');
    },
    {
      connection: redis,
      concurrency: 5,
      removeOnComplete: { count: 0 },
      removeOnFail: { count: 0 },
    },
  );

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err: err.message }, 'Registration job failed');
  });

  return { worker, queue };
}
