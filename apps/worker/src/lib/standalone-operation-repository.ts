/**
 * PrisNames — Registrar Operation Repository (Standalone)
 *
 * Standalone version of the repository for worker processes.
 * Contains the critical CTE-based claim, fence, and sweep queries
 * without NestJS dependency injection.
 *
 * This duplicates the core SQL logic from the API module's repository
 * to avoid cross-app imports. Both must be kept in sync.
 */

import { sql } from 'drizzle-orm';
import { eq, and } from 'drizzle-orm';
import type { Database } from '@prisnames/database/client';
import {
  registrarOperations,
  registrarOperationAuditLog,
} from '@prisnames/database';

export type RegistrarOperationRow = typeof registrarOperations.$inferSelect;

export class StandaloneOperationRepository {
  constructor(private readonly db: Database) {}

  async claimForProcessing(operationId: string, workerId: string) {
    const result = await this.db.execute(sql`
      WITH candidate AS (
        SELECT id, status
        FROM registrar_operations
        WHERE id = ${operationId}
          AND (
            (status = 'QUEUED')
            OR (status = 'RETRY_PENDING' AND retry_count < max_retries)
          )
          AND (
            claim_token IS NULL
            OR claimed_at < now() - interval '5 minutes'
          )
        FOR UPDATE SKIP LOCKED
      )
      UPDATE registrar_operations ro
      SET status = 'PROCESSING',
          claim_token = gen_random_uuid(),
          claim_version = claim_version + 1,
          claimed_by = ${workerId},
          claimed_at = now(),
          started_at = now(),
          attempt_status = 'NOT_ATTEMPTED',
          next_retry_at = NULL,
          retry_count = CASE
            WHEN (SELECT status FROM candidate) = 'RETRY_PENDING'
            THEN ro.retry_count + 1
            ELSE ro.retry_count
          END
      FROM candidate c
      WHERE ro.id = c.id
      RETURNING ro.*
    `);

    const rows = result as unknown as RegistrarOperationRow[];
    if (!rows || rows.length === 0) {
      return { claimed: false, operation: null, claimToken: null };
    }

    const op = rows[0]!;
    return { claimed: true, operation: op, claimToken: op.claimToken };
  }

  async markAttemptStarted(operationId: string, claimToken: string): Promise<boolean> {
    const result = await this.db.execute(sql`
      UPDATE registrar_operations
      SET attempt_status = 'ATTEMPT_STARTED'
      WHERE id = ${operationId}
        AND claim_token = ${claimToken}::uuid
      RETURNING id
    `);
    return (result as unknown as Array<{ id: string }>).length > 0;
  }

  async writeWorkerResult(
    operationId: string,
    claimToken: string,
    update: {
      status: string;
      attemptStatus: string;
      providerOrderId?: string;
      providerResponseCode?: number;
      providerErrorCode?: string;
      providerErrorRetryable?: boolean;
      providerRequestId?: string;
      nextRetryAt?: Date;
      nextReconciliationAt?: Date;
      manualReviewReason?: string;
      lastError?: string;
      isTerminal: boolean;
    },
  ) {
    const result = await this.db.execute(sql`
      UPDATE registrar_operations
      SET status = ${update.status},
          attempt_status = ${update.attemptStatus},
          provider_order_id = COALESCE(${update.providerOrderId ?? null}, provider_order_id),
          provider_response_code = COALESCE(${update.providerResponseCode ?? null}, provider_response_code),
          provider_error_code = ${update.providerErrorCode ?? null},
          provider_error_retryable = ${update.providerErrorRetryable ?? null},
          provider_request_id = COALESCE(${update.providerRequestId ?? null}::uuid, provider_request_id),
          next_retry_at = ${update.nextRetryAt ?? null},
          next_reconciliation_at = ${update.nextReconciliationAt ?? null},
          manual_review_reason = ${update.manualReviewReason ?? null},
          manual_review_escalated_at = CASE WHEN ${update.status} = 'MANUAL_REVIEW' THEN now() ELSE manual_review_escalated_at END,
          last_error = ${update.lastError ?? null},
          claim_token = NULL,
          claimed_by = NULL,
          completed_at = CASE WHEN ${update.isTerminal} THEN now() ELSE NULL END
      WHERE id = ${operationId}
        AND status = 'PROCESSING'
        AND claim_token = ${claimToken}::uuid
      RETURNING *
    `);

    const rows = result as unknown as RegistrarOperationRow[];
    return { written: rows.length > 0, operation: rows[0] ?? null };
  }

  async claimForReconciliation(limit = 10): Promise<RegistrarOperationRow[]> {
    const result = await this.db.execute(sql`
      WITH candidates AS (
        SELECT id
        FROM registrar_operations
        WHERE status IN ('ACCEPTED', 'UNKNOWN')
          AND next_reconciliation_at <= now()
          AND reconciliation_attempts < max_reconciliation_attempts
          AND (
            reconciliation_claim_token IS NULL
            OR reconciliation_claimed_at < now() - interval '5 minutes'
          )
        ORDER BY next_reconciliation_at ASC
        LIMIT ${limit}
        FOR UPDATE SKIP LOCKED
      )
      UPDATE registrar_operations ro
      SET reconciliation_claim_token = gen_random_uuid(),
          reconciliation_claimed_at = now()
      FROM candidates c
      WHERE ro.id = c.id
      RETURNING ro.*
    `);
    return (result as unknown as RegistrarOperationRow[]) ?? [];
  }

  async writeReconciliationResult(
    operationId: string,
    reconToken: string,
    update: {
      status?: string;
      reconciliationMethod?: string;
      nextReconciliationAt?: Date | null;
      isTerminal?: boolean;
      isExhausted?: boolean;
      manualReviewReason?: string;
    },
  ) {
    const result = await this.db.execute(sql`
      UPDATE registrar_operations
      SET status = COALESCE(${update.status ?? null}, status),
          reconciliation_attempts = reconciliation_attempts + 1,
          last_reconciliation_at = now(),
          reconciliation_claim_token = NULL,
          reconciliation_claimed_at = NULL,
          reconciliation_method = COALESCE(${update.reconciliationMethod ?? null}, reconciliation_method),
          next_reconciliation_at = ${update.nextReconciliationAt ?? null},
          completed_at = CASE WHEN ${update.isTerminal ?? false} THEN now() ELSE completed_at END,
          manual_review_reason = COALESCE(${update.manualReviewReason ?? null}, manual_review_reason),
          manual_review_escalated_at = CASE WHEN ${update.isExhausted ?? false} THEN now() ELSE manual_review_escalated_at END
      WHERE id = ${operationId}
        AND reconciliation_claim_token = ${reconToken}::uuid
        AND status IN ('ACCEPTED', 'UNKNOWN')
      RETURNING *
    `);

    const rows = result as unknown as RegistrarOperationRow[];
    return { written: rows.length > 0, operation: rows[0] ?? null };
  }

  async writeWebhookResult(
    operationId: string,
    providerDbId: string,
    providerOrderId: string,
    update: { status: string; isTerminal: boolean; reconciliationMethod?: string },
  ) {
    const result = await this.db.execute(sql`
      UPDATE registrar_operations
      SET status = ${update.status},
          completed_at = CASE WHEN ${update.isTerminal} THEN now() ELSE completed_at END,
          claim_token = NULL, claimed_by = NULL,
          reconciliation_claim_token = NULL, reconciliation_claimed_at = NULL,
          next_reconciliation_at = NULL, next_retry_at = NULL
      WHERE id = ${operationId}
        AND status IN ('PROCESSING', 'ACCEPTED', 'UNKNOWN')
        AND registrar_provider_id = ${providerDbId}::uuid
        AND provider_order_id = ${providerOrderId}
      RETURNING *
    `);

    const rows = result as unknown as RegistrarOperationRow[];
    return { written: rows.length > 0, operation: rows[0] ?? null };
  }

  async findOrphanQueued(limit = 20) {
    const result = await this.db.execute(sql`
      WITH orphans AS (
        SELECT id FROM registrar_operations
        WHERE status = 'QUEUED' AND claim_token IS NULL
          AND created_at < now() - interval '2 minutes'
        ORDER BY created_at ASC LIMIT ${limit}
        FOR UPDATE SKIP LOCKED
      ) SELECT id FROM orphans
    `);
    return (result as unknown as Array<{ id: string }>) ?? [];
  }

  async recoverStaleClaims(): Promise<RegistrarOperationRow[]> {
    const result = await this.db.execute(sql`
      WITH stale AS (
        SELECT id, attempt_status FROM registrar_operations
        WHERE status = 'PROCESSING' AND claim_token IS NOT NULL
          AND claimed_at < now() - interval '5 minutes'
        FOR UPDATE SKIP LOCKED
      )
      UPDATE registrar_operations ro
      SET claim_token = NULL, claimed_by = NULL,
          status = CASE WHEN s.attempt_status = 'NOT_ATTEMPTED' THEN 'RETRY_PENDING' ELSE 'UNKNOWN' END,
          next_reconciliation_at = CASE WHEN s.attempt_status != 'NOT_ATTEMPTED' THEN now() + interval '60 seconds' ELSE NULL END,
          next_retry_at = CASE WHEN s.attempt_status = 'NOT_ATTEMPTED' THEN now() + interval '30 seconds' ELSE NULL END
      FROM stale s WHERE ro.id = s.id
      RETURNING ro.*
    `);
    return (result as unknown as RegistrarOperationRow[]) ?? [];
  }

  async findRetryable(limit = 10) {
    const result = await this.db.execute(sql`
      WITH retryable AS (
        SELECT id FROM registrar_operations
        WHERE status = 'RETRY_PENDING' AND next_retry_at <= now() AND retry_count < max_retries
        ORDER BY next_retry_at ASC LIMIT ${limit}
        FOR UPDATE SKIP LOCKED
      ) SELECT id FROM retryable
    `);
    return (result as unknown as Array<{ id: string }>) ?? [];
  }

  async sweepExhaustedRetries(): Promise<RegistrarOperationRow[]> {
    const result = await this.db.execute(sql`
      WITH exhausted AS (
        SELECT id FROM registrar_operations
        WHERE status = 'RETRY_PENDING' AND retry_count >= max_retries
        FOR UPDATE SKIP LOCKED
      )
      UPDATE registrar_operations ro
      SET status = 'MANUAL_REVIEW',
          manual_review_reason = 'Retry attempts exhausted (retry_count=' || ro.retry_count || ', max=' || ro.max_retries || ')',
          manual_review_escalated_at = now(), next_retry_at = NULL
      FROM exhausted e WHERE ro.id = e.id
      RETURNING ro.*
    `);
    return (result as unknown as RegistrarOperationRow[]) ?? [];
  }

  async findByProviderOrder(providerDbId: string, providerOrderId: string) {
    const [op] = await this.db.select().from(registrarOperations)
      .where(and(
        eq(registrarOperations.registrarProviderId, providerDbId),
        eq(registrarOperations.providerOrderId, providerOrderId),
      )).limit(1);
    return op ?? null;
  }

  async insertAuditLog(entry: {
    operationId: string;
    eventType: string;
    fromStatus?: string;
    toStatus?: string;
    attemptNumber?: number;
    providerHttpStatus?: number;
    details?: Record<string, unknown>;
    actor?: string;
  }) {
    await this.db.insert(registrarOperationAuditLog).values({
      operationId: entry.operationId,
      eventType: entry.eventType,
      fromStatus: entry.fromStatus,
      toStatus: entry.toStatus,
      attemptNumber: entry.attemptNumber,
      providerHttpStatus: entry.providerHttpStatus,
      details: entry.details ?? null,
      actor: entry.actor,
    });
  }
}
