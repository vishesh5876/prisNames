/**
 * PrisNames — Registrar Schema
 *
 * Tables: registrar_providers, registrar_operations, registrar_operation_audit_log,
 *         webhook_business_outbox, contact_profile_snapshots, transfers
 *
 * Reference: DATABASE.md §3.3, ORDER_STATE_MACHINE.md §1.4, §1.7
 *            Phase 6 Implementation Plan §2-§19
 *
 * Design decisions:
 * - registrar_operations has an idempotency_key with UNIQUE constraint
 *   Scope: per-provider idempotency. Prevents duplicate operations even under
 *   concurrent worker execution. Format: "{provider}:{op_type}:{domain}:{order_item}"
 * - provider_response_raw is BYTEA with encryption_key_id for key rotation
 * - transfers.auth_code_hash is VARCHAR (hashed, never plaintext)
 * - provider_order_id is VARCHAR (opaque string, no numeric conversion)
 * - All external provider identifiers are opaque strings throughout orchestration
 * - claim_token/reconciliation_claim_token provide CAS fencing
 * - contact_profile_snapshots provide immutable registration intent storage
 */

import {
  pgTable,
  uuid,
  varchar,
  boolean,
  text,
  timestamp,
  integer,
  jsonb,
  index,
  unique,
  uniqueIndex,
  foreignKey,
  check,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { pkUuid, timestamps, createdTimestamp, statusCheck } from './helpers.js';
import { REGISTRAR_OP_STATUS_VALUES, TRANSFER_STATUS_VALUES } from './enums.js';
import { users } from './auth.js';


// Forward reference placeholder for domains — will use raw uuid FK
// (Avoids circular import: domains.ts references registrar_providers)

// ──────────────────────────────────────────────
// REGISTRAR PROVIDERS
// ──────────────────────────────────────────────

export const registrarProviders = pgTable(
  'registrar_providers',
  {
    id: pkUuid(),
    providerId: varchar('provider_id', { length: 30 }).notNull(),
    providerName: varchar('provider_name', { length: 100 }).notNull(),
    isActive: boolean('is_active').notNull().default(true),
    config: jsonb('config'),
    ...timestamps,
  },
  (table) => [
    unique('uq_registrar_providers_provider_id').on(table.providerId),
  ],
);

// ──────────────────────────────────────────────
// REGISTRAR OPERATIONS
// ──────────────────────────────────────────────

/**
 * Attempt status values for CHECK constraint.
 * Tracks whether the provider capability method was entered.
 */
export const ATTEMPT_STATUS_VALUES = [
  'NOT_ATTEMPTED',
  'ATTEMPT_STARTED',
  'OUTCOME_RECEIVED',
  'OUTCOME_UNKNOWN',
] as const;

/**
 * Reconciliation method values for CHECK constraint.
 */
export const RECONCILIATION_METHOD_VALUES = [
  'ORDER_STATUS',
  'DOMAIN_INFO',
  'ORDER_STATUS_THEN_DOMAIN_INFO',
] as const;

/**
 * Resolution action values for CHECK constraint.
 */
export const RESOLUTION_ACTION_VALUES = [
  'CONFIRM_SUCCEEDED',
  'CONFIRM_FAILED',
  'RETRY',
  'CANCELLED',
] as const;

export const registrarOperations = pgTable(
  'registrar_operations',
  {
    id: pkUuid(),
    orderId: uuid('order_id'),
    // FK to orders defined in relations (avoids circular import)
    orderItemId: uuid('order_item_id'),
    // FK to order_items defined in relations
    domainId: uuid('domain_id'),
    // FK to domains defined in relations
    registrarProviderId: uuid('registrar_provider_id').notNull(),
    status: varchar('status', { length: 20 }).notNull().default('QUEUED'),
    operationType: varchar('operation_type', { length: 30 }).notNull(),

    // Idempotency key — UNIQUE constraint prevents duplicate operations
    // Format: "{provider_id}:{op_type}:{fqdn}:{order_item_id or uuid}"
    idempotencyKey: varchar('idempotency_key', { length: 500 }).notNull(),

    // Canonical FQDN for this operation
    fqdn: varchar('fqdn', { length: 255 }),

    // Provider correlation — all IDs are opaque strings
    providerRequestId: uuid('provider_request_id'),
    providerOrderId: varchar('provider_order_id', { length: 100 }),
    providerResponseCode: integer('provider_response_code'),

    // Encrypted raw response — BYTEA with versioned encryption metadata
    providerResponseRaw: text('provider_response_raw'),
    encryptionKeyId: varchar('encryption_key_id', { length: 50 }),

    // Provider error normalization
    providerErrorCode: varchar('provider_error_code', { length: 50 }),
    providerErrorRetryable: boolean('provider_error_retryable'),

    // Attempt tracking — Phase 6
    attemptStatus: varchar('attempt_status', { length: 20 }).notNull().default('NOT_ATTEMPTED'),

    // Fenced claims — Phase 6
    claimToken: uuid('claim_token'),
    claimVersion: integer('claim_version').notNull().default(0),
    claimedBy: varchar('claimed_by', { length: 100 }),
    claimedAt: timestamp('claimed_at', { withTimezone: true }),

    // Retry tracking
    retryCount: integer('retry_count').notNull().default(0),
    maxRetries: integer('max_retries').notNull().default(3),
    lastError: text('last_error'),
    nextRetryAt: timestamp('next_retry_at', { withTimezone: true }),

    // Reconciliation tracking — Phase 6
    reconciliationAttempts: integer('reconciliation_attempts').notNull().default(0),
    maxReconciliationAttempts: integer('max_reconciliation_attempts').notNull().default(10),
    nextReconciliationAt: timestamp('next_reconciliation_at', { withTimezone: true }),
    lastReconciliationAt: timestamp('last_reconciliation_at', { withTimezone: true }),
    reconciliationMethod: varchar('reconciliation_method', { length: 30 }),
    reconciliationClaimToken: uuid('reconciliation_claim_token'),
    reconciliationClaimedAt: timestamp('reconciliation_claimed_at', { withTimezone: true }),

    // Manual review — Phase 6
    manualReviewReason: varchar('manual_review_reason', { length: 1000 }),
    manualReviewEscalatedAt: timestamp('manual_review_escalated_at', { withTimezone: true }),
    resolvedBy: uuid('resolved_by'),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    resolutionAction: varchar('resolution_action', { length: 30 }),
    resolutionReason: varchar('resolution_reason', { length: 1000 }),
    resolutionEvidence: varchar('resolution_evidence', { length: 2000 }),

    // Operation metadata (typed, validated before write)
    operationMetadata: jsonb('operation_metadata'),

    // Timing
    startedAt: timestamp('started_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('uq_registrar_ops_idempotency').on(table.idempotencyKey),
    index('idx_reg_ops_order_id').on(table.orderId),
    index('idx_reg_ops_domain_id').on(table.domainId),
    index('idx_reg_ops_status').on(table.status),
    // Provider-scoped order ID lookup
    index('idx_reg_ops_provider_order').on(table.registrarProviderId, table.providerOrderId),
    // Reconciliation sweep
    index('idx_reg_ops_reconciliation').on(table.nextReconciliationAt),
    // Retry sweep
    index('idx_reg_ops_retry').on(table.nextRetryAt),
    // Orphan QUEUED
    index('idx_reg_ops_queued_orphan').on(table.createdAt),
    // Stale claims
    index('idx_reg_ops_stale_claim').on(table.claimedAt),
    // Manual review queue
    index('idx_reg_ops_manual_review').on(table.manualReviewEscalatedAt),
    // FQDN lookup
    index('idx_reg_ops_fqdn').on(table.fqdn),
    statusCheck('chk_reg_ops_status', 'status', REGISTRAR_OP_STATUS_VALUES),
    check('chk_reg_ops_attempt_status',
      sql`attempt_status IN ('NOT_ATTEMPTED', 'ATTEMPT_STARTED', 'OUTCOME_RECEIVED', 'OUTCOME_UNKNOWN')`),
    check('chk_reg_ops_recon_method',
      sql`reconciliation_method IS NULL OR reconciliation_method IN ('ORDER_STATUS', 'DOMAIN_INFO', 'ORDER_STATUS_THEN_DOMAIN_INFO')`),
    check('chk_reg_ops_resolution_action',
      sql`resolution_action IS NULL OR resolution_action IN ('CONFIRM_SUCCEEDED', 'CONFIRM_FAILED', 'RETRY', 'CANCELLED')`),
    foreignKey({
      name: 'fk_reg_ops_provider',
      columns: [table.registrarProviderId],
      foreignColumns: [registrarProviders.id],
    }).onDelete('restrict'),
    foreignKey({
      name: 'fk_reg_ops_resolved_by',
      columns: [table.resolvedBy],
      foreignColumns: [users.id],
    }).onDelete('set null'),
  ],
);

// ──────────────────────────────────────────────
// REGISTRAR OPERATION AUDIT LOG
// ──────────────────────────────────────────────

export const registrarOperationAuditLog = pgTable(
  'registrar_operation_audit_log',
  {
    id: pkUuid(),
    operationId: uuid('operation_id').notNull(),
    eventType: varchar('event_type', { length: 50 }).notNull(),
    fromStatus: varchar('from_status', { length: 20 }),
    toStatus: varchar('to_status', { length: 20 }),
    attemptNumber: integer('attempt_number'),
    providerRequestId: varchar('provider_request_id', { length: 100 }),
    providerHttpStatus: integer('provider_http_status'),
    providerErrorCode: varchar('provider_error_code', { length: 50 }),
    details: jsonb('details'),
    actor: varchar('actor', { length: 100 }),
    resolvedBy: uuid('resolved_by'),
    ...createdTimestamp,
  },
  (table) => [
    index('idx_reg_op_audit_operation').on(table.operationId),
    index('idx_reg_op_audit_created').on(table.createdAt),
    foreignKey({
      name: 'fk_reg_op_audit_operation',
      columns: [table.operationId],
      foreignColumns: [registrarOperations.id],
    }).onDelete('restrict'),
    foreignKey({
      name: 'fk_reg_op_audit_resolved_by',
      columns: [table.resolvedBy],
      foreignColumns: [users.id],
    }).onDelete('set null'),
  ],
);

// ──────────────────────────────────────────────
// WEBHOOK BUSINESS OUTBOX
// ──────────────────────────────────────────────

export const webhookBusinessOutbox = pgTable(
  'webhook_business_outbox',
  {
    id: pkUuid(),
    webhookEventId: uuid('webhook_event_id').notNull(),
    providerIdentity: varchar('provider_identity', { length: 30 }).notNull(),
    eventType: varchar('event_type', { length: 50 }).notNull(),
    eventPayload: jsonb('event_payload').notNull(),
    status: varchar('status', { length: 20 }).notNull().default('PENDING'),
    processedAt: timestamp('processed_at', { withTimezone: true }),
    error: text('error'),
    ...createdTimestamp,
  },
  (table) => [
    uniqueIndex('uq_webhook_outbox_event').on(table.webhookEventId),
    index('idx_webhook_outbox_pending').on(table.createdAt),
    check('chk_webhook_outbox_status', sql`status IN ('PENDING', 'COMPLETED', 'FAILED')`),
  ],
);

// ──────────────────────────────────────────────
// CONTACT PROFILE SNAPSHOTS — Immutable, versioned
// Correction 5: real backing storage for registration snapshots.
// Version is a SHA-256 content hash of canonical fields.
// ──────────────────────────────────────────────

export const contactProfileSnapshots = pgTable(
  'contact_profile_snapshots',
  {
    id: pkUuid(),
    version: varchar('version', { length: 64 }).notNull(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'restrict' }),
    firstName: varchar('first_name', { length: 100 }),
    lastName: varchar('last_name', { length: 100 }),
    company: varchar('company', { length: 200 }),
    email: varchar('email', { length: 255 }),
    phone: varchar('phone', { length: 30 }),
    addressLine1: varchar('address_line1', { length: 255 }),
    addressLine2: varchar('address_line2', { length: 255 }),
    city: varchar('city', { length: 100 }),
    state: varchar('state', { length: 100 }),
    postalCode: varchar('postal_code', { length: 20 }),
    country: varchar('country', { length: 2 }),
    ...createdTimestamp,
  },
  (table) => [
    uniqueIndex('uq_contact_snapshot_version').on(table.userId, table.version),
    index('idx_contact_snapshot_user').on(table.userId),
  ],
);

// ──────────────────────────────────────────────
// TRANSFERS
// ──────────────────────────────────────────────

export const transfers = pgTable(
  'transfers',
  {
    id: pkUuid(),
    domainId: uuid('domain_id'),
    // FK to domains defined in relations
    orderId: uuid('order_id'),
    // FK to orders defined in relations
    registrarOperationId: uuid('registrar_operation_id').references(
      () => registrarOperations.id,
      { onDelete: 'set null' },
    ),
    status: varchar('status', { length: 30 }).notNull().default('INITIATED'),
    direction: varchar('direction', { length: 10 }).notNull(),
    authCodeHash: varchar('auth_code_hash', { length: 255 }),
    gainingRegistrar: varchar('gaining_registrar', { length: 100 }),
    initiatedAt: timestamp('initiated_at', { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    failedReason: text('failed_reason'),
    ...timestamps,
  },
  (table) => [
    index('idx_transfers_domain_id').on(table.domainId),
    index('idx_transfers_status').on(table.status),
    statusCheck('chk_transfers_status', 'status', TRANSFER_STATUS_VALUES),
  ],
);
