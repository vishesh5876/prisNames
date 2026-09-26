/**
 * PrisNames — Registrar Operation Repository
 *
 * Data access layer for registrar_operations with:
 * - Idempotent creation (ON CONFLICT)
 * - Fenced worker claims (CTE + FOR UPDATE SKIP LOCKED)
 * - Fenced result writes (CAS by claim_token)
 * - Reconciliation claims (separate CAS path)
 * - Webhook correlation writes (provider identity + order ID)
 * - Audit log insertion
 *
 * Three separate fenced CAS paths per §11.3:
 * 1. Worker: claim_token
 * 2. Reconciliation: reconciliation_claim_token
 * 3. Webhook: provider correlation (no token)
 *
 * Reference: Phase 6 Implementation Plan §4, §5, §11.3
 */

import { Inject, Injectable } from '@nestjs/common';
import { eq, and, sql } from 'drizzle-orm';
import { DATABASE_TOKEN } from '../../database/database.module.js';
import type { Database } from '@prisnames/database/client';
import {
  registrarOperations,
  registrarOperationAuditLog,
} from '@prisnames/database';
import type { AuditDetails } from './audit-detail-builders.js';

// ──────────────────────────────────────────────
// TYPES
// ──────────────────────────────────────────────

export type RegistrarOperationRow = typeof registrarOperations.$inferSelect;
export type NewRegistrarOperation = typeof registrarOperations.$inferInsert;

export interface ClaimResult {
  claimed: boolean;
  operation: RegistrarOperationRow | null;
  claimToken: string | null;
}

export interface WriteResult {
  written: boolean;
  operation: RegistrarOperationRow | null;
}

@Injectable()
export class RegistrarOperationRepository {
  constructor(@Inject(DATABASE_TOKEN) private readonly db: Database) {}

  // ──────────────────────────────────────────────
  // CREATION (TX1)
  // ──────────────────────────────────────────────

  /**
   * Insert a new operation with idempotency.
   * Returns { created: true, operation } on insert, { created: false, operation } on conflict.
   *
   * Correction 1: Active FQDN conflict is handled BEFORE this call.
   * This method only handles idempotency_key conflicts (same operation retry).
   */
  async insertIdempotent(
    data: NewRegistrarOperation,
    tx?: Database,
  ): Promise<{ created: boolean; operation: RegistrarOperationRow }> {
    const executor = tx ?? this.db;

    // Try insert
    const [inserted] = await executor
      .insert(registrarOperations)
      .values(data)
      .onConflictDoNothing({ target: registrarOperations.idempotencyKey })
      .returning();

    if (inserted) {
      return { created: true, operation: inserted };
    }

    // Conflict — return existing
    const [existing] = await executor
      .select()
      .from(registrarOperations)
      .where(eq(registrarOperations.idempotencyKey, data.idempotencyKey!));

    return { created: false, operation: existing! };
  }

  // ──────────────────────────────────────────────
  // WORKER CLAIM (TX2)
  // ──────────────────────────────────────────────

  /**
   * Claim an operation for processing.
   * Uses CTE + FOR UPDATE SKIP LOCKED for concurrency safety.
   *
   * Correction 4: QUEUED operations execute regardless of max_retries.
   * Only RETRY_PENDING checks retry_count < max_retries.
   * retry_count increments only when RETRY_PENDING is claimed.
   */
  async claimForProcessing(
    operationId: string,
    workerId: string,
  ): Promise<ClaimResult> {
    // Raw SQL CTE for atomic claim with conditional retry_count increment
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

  // ──────────────────────────────────────────────
  // ATTEMPT MARKER (TX-pre-attempt)
  // ──────────────────────────────────────────────

  /**
   * Mark attempt as started before entering provider capability method.
   * Fast, fenced write.
   */
  async markAttemptStarted(
    operationId: string,
    claimToken: string,
  ): Promise<boolean> {
    const result = await this.db.execute(sql`
      UPDATE registrar_operations
      SET attempt_status = 'ATTEMPT_STARTED'
      WHERE id = ${operationId}
        AND claim_token = ${claimToken}::uuid
      RETURNING id
    `);

    const rows = result as unknown as Array<{ id: string }>;
    return rows.length > 0;
  }

  // ──────────────────────────────────────────────
  // WORKER RESULT WRITE (TX3) — Fenced by claim_token
  // ──────────────────────────────────────────────

  /**
   * Write the result of a worker execution. CAS fenced by claim_token.
   * Returns { written: false } if the claim is stale.
   */
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
    tx?: Database,
  ): Promise<WriteResult> {
    const executor = tx ?? this.db;

    const result = await executor.execute(sql`
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
    if (!rows || rows.length === 0) {
      return { written: false, operation: null };
    }

    return { written: true, operation: rows[0]! };
  }

  // ──────────────────────────────────────────────
  // RECONCILIATION CLAIM — Separate CAS path
  // ──────────────────────────────────────────────

  /**
   * Claim operations for reconciliation.
   * CTE + FOR UPDATE SKIP LOCKED with batch limit.
   */
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

  /**
   * Write reconciliation result. CAS fenced by reconciliation_claim_token.
   *
   * Correction 3: When reconciliation resolves FAILED, the same TX performs
   * all local side-effects (domain/order/audit) — same crash-consistency as TX3.
   */
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
    tx?: Database,
  ): Promise<WriteResult> {
    const executor = tx ?? this.db;

    const result = await executor.execute(sql`
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
    if (!rows || rows.length === 0) {
      return { written: false, operation: null };
    }

    return { written: true, operation: rows[0]! };
  }

  // ──────────────────────────────────────────────
  // WEBHOOK RESULT WRITE — Provider correlation CAS
  // ──────────────────────────────────────────────

  /**
   * Write webhook-correlated result. CAS by provider identity + order ID.
   * No token needed — uses authoritative provider correlation.
   */
  async writeWebhookResult(
    operationId: string,
    providerDbId: string,
    providerOrderId: string,
    update: {
      status: string;
      isTerminal: boolean;
      reconciliationMethod?: string;
    },
    tx?: Database,
  ): Promise<WriteResult> {
    const executor = tx ?? this.db;

    const result = await executor.execute(sql`
      UPDATE registrar_operations
      SET status = ${update.status},
          reconciliation_method = COALESCE(${update.reconciliationMethod ?? null}, reconciliation_method),
          completed_at = CASE WHEN ${update.isTerminal} THEN now() ELSE completed_at END,
          claim_token = NULL,
          claimed_by = NULL,
          reconciliation_claim_token = NULL,
          reconciliation_claimed_at = NULL,
          next_reconciliation_at = NULL,
          next_retry_at = NULL
      WHERE id = ${operationId}
        AND status IN ('PROCESSING', 'ACCEPTED', 'UNKNOWN')
        AND registrar_provider_id = ${providerDbId}::uuid
        AND provider_order_id = ${providerOrderId}
      RETURNING *
    `);

    const rows = result as unknown as RegistrarOperationRow[];
    if (!rows || rows.length === 0) {
      return { written: false, operation: null };
    }

    return { written: true, operation: rows[0]! };
  }

  // ──────────────────────────────────────────────
  // SWEEPER QUERIES
  // ──────────────────────────────────────────────

  /**
   * Find orphan QUEUED operations (no claim, older than 2 minutes).
   */
  async findOrphanQueued(limit = 20): Promise<Array<{ id: string }>> {
    const result = await this.db.execute(sql`
      WITH orphans AS (
        SELECT id
        FROM registrar_operations
        WHERE status = 'QUEUED'
          AND claim_token IS NULL
          AND created_at < now() - interval '2 minutes'
        ORDER BY created_at ASC
        LIMIT ${limit}
        FOR UPDATE SKIP LOCKED
      )
      SELECT id FROM orphans
    `);

    return (result as unknown as Array<{ id: string }>) ?? [];
  }

  /**
   * Recover stale claims. Attempt-aware: NOT_ATTEMPTED → RETRY_PENDING, else → UNKNOWN.
   */
  async recoverStaleClaims(): Promise<RegistrarOperationRow[]> {
    const result = await this.db.execute(sql`
      WITH stale AS (
        SELECT id, attempt_status
        FROM registrar_operations
        WHERE status = 'PROCESSING'
          AND claim_token IS NOT NULL
          AND claimed_at < now() - interval '5 minutes'
        FOR UPDATE SKIP LOCKED
      )
      UPDATE registrar_operations ro
      SET claim_token = NULL,
          claimed_by = NULL,
          status = CASE
            WHEN s.attempt_status = 'NOT_ATTEMPTED' THEN 'RETRY_PENDING'
            ELSE 'UNKNOWN'
          END,
          next_reconciliation_at = CASE
            WHEN s.attempt_status != 'NOT_ATTEMPTED' THEN now() + interval '60 seconds'
            ELSE NULL
          END,
          next_retry_at = CASE
            WHEN s.attempt_status = 'NOT_ATTEMPTED' THEN now() + interval '30 seconds'
            ELSE NULL
          END
      FROM stale s
      WHERE ro.id = s.id
      RETURNING ro.*
    `);

    return (result as unknown as RegistrarOperationRow[]) ?? [];
  }

  /**
   * Find retryable operations.
   */
  async findRetryable(limit = 10): Promise<Array<{ id: string }>> {
    const result = await this.db.execute(sql`
      WITH retryable AS (
        SELECT id
        FROM registrar_operations
        WHERE status = 'RETRY_PENDING'
          AND next_retry_at <= now()
          AND retry_count < max_retries
        ORDER BY next_retry_at ASC
        LIMIT ${limit}
        FOR UPDATE SKIP LOCKED
      )
      SELECT id FROM retryable
    `);

    return (result as unknown as Array<{ id: string }>) ?? [];
  }

  /**
   * Sweep exhausted RETRY_PENDING operations → MANUAL_REVIEW.
   */
  async sweepExhaustedRetries(): Promise<RegistrarOperationRow[]> {
    const result = await this.db.execute(sql`
      WITH exhausted AS (
        SELECT id
        FROM registrar_operations
        WHERE status = 'RETRY_PENDING'
          AND retry_count >= max_retries
        FOR UPDATE SKIP LOCKED
      )
      UPDATE registrar_operations ro
      SET status = 'MANUAL_REVIEW',
          manual_review_reason = 'Retry attempts exhausted (retry_count=' || ro.retry_count || ', max=' || ro.max_retries || ')',
          manual_review_escalated_at = now(),
          next_retry_at = NULL
      FROM exhausted e
      WHERE ro.id = e.id
      RETURNING ro.*
    `);

    return (result as unknown as RegistrarOperationRow[]) ?? [];
  }

  // ──────────────────────────────────────────────
  // MANUAL REVIEW
  // ──────────────────────────────────────────────

  /**
   * Resolve a manual review operation.
   */
  async resolveManualReview(
    operationId: string,
    update: {
      status: string;
      resolutionAction: string;
      resolutionReason: string;
      resolutionEvidence?: string;
      resolvedBy: string;
      nextRetryAt?: Date;
      isTerminal: boolean;
    },
    tx?: Database,
  ): Promise<WriteResult> {
    const executor = tx ?? this.db;

    const result = await executor.execute(sql`
      UPDATE registrar_operations
      SET status = ${update.status},
          resolution_action = ${update.resolutionAction},
          resolution_reason = ${update.resolutionReason},
          resolution_evidence = ${update.resolutionEvidence ?? null},
          resolved_by = ${update.resolvedBy}::uuid,
          resolved_at = now(),
          next_retry_at = ${update.nextRetryAt ?? null},
          completed_at = CASE WHEN ${update.isTerminal} THEN now() ELSE completed_at END
      WHERE id = ${operationId}
        AND status = 'MANUAL_REVIEW'
      RETURNING *
    `);

    const rows = result as unknown as RegistrarOperationRow[];
    if (!rows || rows.length === 0) {
      return { written: false, operation: null };
    }

    return { written: true, operation: rows[0]! };
  }

  // ──────────────────────────────────────────────
  // AUDIT LOG
  // ──────────────────────────────────────────────

  /**
   * Insert an audit log entry. MUST be in the same TX as the status change.
   */
  async insertAuditLog(
    entry: {
      operationId: string;
      eventType: string;
      fromStatus?: string;
      toStatus?: string;
      attemptNumber?: number;
      providerRequestId?: string;
      providerHttpStatus?: number;
      providerErrorCode?: string;
      details?: AuditDetails;
      actor?: string;
      resolvedBy?: string;
    },
    tx?: Database,
  ): Promise<void> {
    const executor = tx ?? this.db;

    await executor.insert(registrarOperationAuditLog).values({
      operationId: entry.operationId,
      eventType: entry.eventType,
      fromStatus: entry.fromStatus,
      toStatus: entry.toStatus,
      attemptNumber: entry.attemptNumber,
      providerRequestId: entry.providerRequestId,
      providerHttpStatus: entry.providerHttpStatus,
      providerErrorCode: entry.providerErrorCode,
      details: entry.details ?? null,
      actor: entry.actor,
      resolvedBy: entry.resolvedBy,
    });
  }

  // ──────────────────────────────────────────────
  // QUERIES
  // ──────────────────────────────────────────────

  async findById(id: string): Promise<RegistrarOperationRow | null> {
    const [op] = await this.db
      .select()
      .from(registrarOperations)
      .where(eq(registrarOperations.id, id))
      .limit(1);
    return op ?? null;
  }

  async findByProviderOrder(
    providerDbId: string,
    providerOrderId: string,
  ): Promise<RegistrarOperationRow | null> {
    const [op] = await this.db
      .select()
      .from(registrarOperations)
      .where(
        and(
          eq(registrarOperations.registrarProviderId, providerDbId),
          eq(registrarOperations.providerOrderId, providerOrderId),
        ),
      )
      .limit(1);
    return op ?? null;
  }

  /**
   * Check for an existing active registration operation for a given FQDN.
   * Used by Correction 1: FQDN conflict detection in TX1.
   *
   * Returns an existing non-terminal operation for the FQDN if one exists.
   */
  async findActiveOperationByFqdn(
    fqdn: string,
    operationType: string,
  ): Promise<RegistrarOperationRow | null> {
    const [op] = await this.db
      .select()
      .from(registrarOperations)
      .where(
        and(
          eq(registrarOperations.fqdn, fqdn),
          eq(registrarOperations.operationType, operationType),
          sql`status NOT IN ('SUCCEEDED', 'FAILED', 'CANCELLED')`,
        ),
      )
      .limit(1);
    return op ?? null;
  }

  /**
   * Find operations by order ID (for multi-item fulfillment evaluation).
   */
  async findByOrderId(orderId: string, tx?: Database): Promise<RegistrarOperationRow[]> {
    const executor = tx ?? this.db;
    return executor
      .select()
      .from(registrarOperations)
      .where(eq(registrarOperations.orderId, orderId));
  }

  /**
   * Find webhook business outbox entries for processing.
   */
  async findPendingOutboxEntries(limit = 10): Promise<unknown[]> {
    const result = await this.db.execute(sql`
      SELECT * FROM webhook_business_outbox
      WHERE status = 'PENDING'
      ORDER BY created_at ASC
      LIMIT ${limit}
      FOR UPDATE SKIP LOCKED
    `);

    return (result as unknown as unknown[]) ?? [];
  }

  /**
   * List operations with pagination for admin view.
   */
  async listOperations(
    filters: { status?: string; operationType?: string },
    page = 1,
    pageSize = 20,
  ): Promise<{ operations: RegistrarOperationRow[]; total: number }> {
    const conditions = [];
    if (filters.status) {
      conditions.push(eq(registrarOperations.status, filters.status));
    }
    if (filters.operationType) {
      conditions.push(eq(registrarOperations.operationType, filters.operationType));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const operations = await this.db
      .select()
      .from(registrarOperations)
      .where(whereClause)
      .orderBy(sql`created_at DESC`)
      .limit(pageSize)
      .offset((page - 1) * pageSize);

    const [countResult] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(registrarOperations)
      .where(whereClause);

    return { operations, total: countResult?.count ?? 0 };
  }
}
