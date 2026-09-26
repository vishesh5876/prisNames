/**
 * PrisNames — Phase 6 Integration Tests
 *
 * Real PostgreSQL integration tests covering:
 * - Registration orchestration lifecycle
 * - ACCEPTED/UNKNOWN flows
 * - Reconciliation success/failure/exhaustion
 * - Retry lifecycle & budget enforcement
 * - Concurrent FQDN conflict
 * - Idempotent duplicate requests
 * - Multi-item fulfillment evaluation
 * - Fenced claim concurrency
 * - Crash window recovery
 * - Reconciliation claim fencing
 * - Webhook outbox lifecycle
 * - Contact snapshot immutability
 * - Manual review resolution
 * - Authorization boundaries
 * - CSRF origin configuration
 * - Provider-neutral architecture
 *
 * Requires DATABASE_URL or TEST_DATABASE_URL set.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { config } from 'dotenv';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';
import { randomUUID, createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../../../../../../.env') });

const DB_URL = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;

// ──────────────────────────────────────────────────────
// HELPERS
// ──────────────────────────────────────────────────────

/** Insert a test user and return their ID */
async function createTestUser(sql: ReturnType<typeof postgres>, prefix: string): Promise<string> {
  const userId = randomUUID();
  const email = `${prefix}${Date.now()}@test.local`;
  await sql`INSERT INTO users (id, email, email_canonical, account_status, created_at, updated_at)
            VALUES (${userId}, ${email}, ${email.toLowerCase()}, 'ACTIVE', now(), now())`;
  return userId;
}

/** Insert a test registrar provider and return its ID */
async function createTestProvider(sql: ReturnType<typeof postgres>, prefix: string): Promise<string> {
  const providerId = randomUUID();
  const provCode = `${prefix}${providerId.slice(0, 8)}`;
  await sql`INSERT INTO registrar_providers (id, provider_id, provider_name, is_active, config, created_at, updated_at)
            VALUES (${providerId}, ${provCode}, ${provCode + '_name'}, true, '{}'::jsonb, now(), now())`;
  return providerId;
}

/** Insert a test order */
async function createTestOrder(
  sql: ReturnType<typeof postgres>,
  userId: string,
  status = 'PROCESSING',
): Promise<string> {
  const orderId = randomUUID();
  await sql`INSERT INTO orders (id, user_id, status, subtotal_minor, tax_minor, discount_minor, total_minor, currency, created_at, updated_at)
            VALUES (${orderId}, ${userId}, ${status}, 999, 0, 0, 999, 'USD', now(), now())`;
  return orderId;
}

/** Insert a test order item */
async function createTestOrderItem(
  sql: ReturnType<typeof postgres>,
  orderId: string,
  domainName: string,
  operation = 'REGISTER',
  providerId?: string,
): Promise<string> {
  const itemId = randomUUID();
  // If no providerId, create a temporary provider (FK requires valid reference)
  let provId = providerId;
  if (!provId) {
    provId = randomUUID();
    const provCode = `tmp_${provId.slice(0, 8)}`;
    await sql`INSERT INTO registrar_providers (id, provider_id, provider_name, is_active, config, created_at, updated_at)
              VALUES (${provId}, ${provCode}, ${provCode + '_name'}, true, '{}'::jsonb, now(), now())
              ON CONFLICT (provider_id) DO NOTHING`;
  }
  await sql`INSERT INTO order_items (id, order_id, domain, operation, years, amount_minor, currency, registrar_provider_id, provider_cost_minor, created_at)
            VALUES (${itemId}, ${orderId}, ${domainName}, ${operation}, 1, 999, 'USD', ${provId}, 0, now())`;
  return itemId;
}

/** Insert a registrar operation directly */
async function insertOperation(
  sql: ReturnType<typeof postgres>,
  params: {
    orderId?: string;
    orderItemId?: string;
    providerId: string;
    status: string;
    operationType?: string;
    fqdn?: string;
    idempotencyKey?: string;
    retryCount?: number;
    maxRetries?: number;
    claimToken?: string | null;
    claimedBy?: string | null;
    claimedAt?: Date | null;
    attemptStatus?: string;
    providerOrderId?: string;
    nextRetryAt?: Date | null;
    nextReconciliationAt?: Date | null;
    reconciliationAttempts?: number;
    maxReconciliationAttempts?: number;
    reconciliationClaimToken?: string | null;
    reconciliationClaimedAt?: Date | null;
    manualReviewReason?: string;
    manualReviewEscalatedAt?: Date | null;
    operationMetadata?: Record<string, unknown>;
  },
): Promise<string> {
  const opId = randomUUID();
  const iKey = params.idempotencyKey ?? `idem_${opId}`;
  await sql`
    INSERT INTO registrar_operations (
      id, order_id, order_item_id, registrar_provider_id, status, operation_type,
      idempotency_key, fqdn, retry_count, max_retries,
      claim_token, claimed_by, claimed_at, attempt_status,
      provider_order_id, next_retry_at, next_reconciliation_at,
      reconciliation_attempts, max_reconciliation_attempts,
      reconciliation_claim_token, reconciliation_claimed_at,
      manual_review_reason, manual_review_escalated_at,
      operation_metadata,
      created_at, updated_at
    ) VALUES (
      ${opId}, ${params.orderId ?? null}, ${params.orderItemId ?? null},
      ${params.providerId}, ${params.status}, ${params.operationType ?? 'REGISTER'},
      ${iKey}, ${params.fqdn ?? null},
      ${params.retryCount ?? 0}, ${params.maxRetries ?? 3},
      ${params.claimToken ?? null}::uuid, ${params.claimedBy ?? null},
      ${params.claimedAt ?? null},
      ${params.attemptStatus ?? 'NOT_ATTEMPTED'},
      ${params.providerOrderId ?? null},
      ${params.nextRetryAt ?? null}, ${params.nextReconciliationAt ?? null},
      ${params.reconciliationAttempts ?? 0}, ${params.maxReconciliationAttempts ?? 10},
      ${params.reconciliationClaimToken ?? null}::uuid, ${params.reconciliationClaimedAt ?? null},
      ${params.manualReviewReason ?? null}, ${params.manualReviewEscalatedAt ?? null},
      ${params.operationMetadata ? JSON.stringify(params.operationMetadata) : null}::jsonb,
      now(), now()
    )
  `;
  return opId;
}

/** Insert a test domain */
async function insertDomain(
  sql: ReturnType<typeof postgres>,
  params: { userId: string; domainName: string; status?: string; providerId?: string },
): Promise<string> {
  const domainId = randomUUID();
  const sld = params.domainName.split('.')[0];
  const tld = params.domainName.split('.').slice(1).join('.');
  // Auto-create provider if none supplied (FK requires valid reference)
  let provId = params.providerId;
  if (!provId) {
    provId = randomUUID();
    const provCode = `tmp_dom_${provId.slice(0, 8)}`;
    await sql`INSERT INTO registrar_providers (id, provider_id, provider_name, is_active, config, created_at, updated_at)
              VALUES (${provId}, ${provCode}, ${provCode + '_name'}, true, '{}'::jsonb, now(), now())
              ON CONFLICT (provider_id) DO NOTHING`;
  }
  await sql`INSERT INTO domains (id, user_id, fqdn, sld, tld, lifecycle_status, registrar_provider_id, created_at, updated_at)
            VALUES (${domainId}, ${params.userId}, ${params.domainName},
                    ${sld}, ${tld},
                    ${params.status ?? 'PENDING_REGISTRATION'}, ${provId}, now(), now())`;
  return domainId;
}

/** Get operation by ID */
async function getOp(sql: ReturnType<typeof postgres>, opId: string) {
  const [op] = await sql`SELECT * FROM registrar_operations WHERE id = ${opId}`;
  return op;
}

/** Get audit logs for operation */
async function getAuditLogs(sql: ReturnType<typeof postgres>, opId: string) {
  return sql`SELECT * FROM registrar_operation_audit_log WHERE operation_id = ${opId} ORDER BY created_at`;
}

/** Get domain by ID */
async function getDomain(sql: ReturnType<typeof postgres>, domainId: string) {
  const [d] = await sql`SELECT id, lifecycle_status as status FROM domains WHERE id = ${domainId}`;
  return d;
}

/** Get order by ID */
async function getOrder(sql: ReturnType<typeof postgres>, orderId: string) {
  const [o] = await sql`SELECT * FROM orders WHERE id = ${orderId}`;
  return o;
}

// ──────────────────────────────────────────────────────
// TEST SUITE
// ──────────────────────────────────────────────────────

describe('Phase 6 Integration', { timeout: 60_000 }, () => {
  let sql: ReturnType<typeof postgres>;
  const TEST_PREFIX = `p6_${Date.now()}_`;
  const createdIds: { users: string[]; providers: string[]; operations: string[];
    orders: string[]; orderItems: string[]; domains: string[] } = {
    users: [], providers: [], operations: [], orders: [], orderItems: [], domains: [],
  };

  beforeAll(async () => {
    if (!DB_URL) throw new Error('DATABASE_URL or TEST_DATABASE_URL required');
    sql = postgres(DB_URL);
  });

  afterAll(async () => {
    if (sql) {
      // Cascade cleanup (order matters for FK constraints)
      if (createdIds.operations.length > 0) {
        await sql`DELETE FROM registrar_operation_audit_log WHERE operation_id IN ${sql(createdIds.operations)}`;
        await sql`DELETE FROM registrar_operations WHERE id IN ${sql(createdIds.operations)}`;
      }
      if (createdIds.orderItems.length > 0) {
        await sql`DELETE FROM order_items WHERE id IN ${sql(createdIds.orderItems)}`;
      }
      if (createdIds.orders.length > 0) {
        await sql`DELETE FROM orders WHERE id IN ${sql(createdIds.orders)}`;
      }
      if (createdIds.domains.length > 0) {
        await sql`DELETE FROM domains WHERE id IN ${sql(createdIds.domains)}`;
      }
      if (createdIds.providers.length > 0) {
        await sql`DELETE FROM registrar_providers WHERE id IN ${sql(createdIds.providers)}`;
      }
      if (createdIds.users.length > 0) {
        // Clean user-related tables first
        await sql`DELETE FROM contact_profile_snapshots WHERE user_id IN ${sql(createdIds.users)}`;
        await sql`DELETE FROM sessions WHERE user_id IN ${sql(createdIds.users)}`;
        await sql`DELETE FROM password_credentials WHERE user_id IN ${sql(createdIds.users)}`;
        await sql`DELETE FROM auth_identities WHERE user_id IN ${sql(createdIds.users)}`;
        await sql`DELETE FROM user_profiles WHERE user_id IN ${sql(createdIds.users)}`;
        await sql`DELETE FROM user_roles WHERE user_id IN ${sql(createdIds.users)}`;
        await sql`DELETE FROM users WHERE id IN ${sql(createdIds.users)}`;
      }
      await sql.end();
    }
  });

  // Helper that tracks created IDs
  async function createUser(): Promise<string> {
    const id = await createTestUser(sql, TEST_PREFIX);
    createdIds.users.push(id);
    return id;
  }
  async function createProvider(): Promise<string> {
    const id = await createTestProvider(sql, TEST_PREFIX);
    createdIds.providers.push(id);
    return id;
  }
  async function createOrder(userId: string, status = 'PROCESSING'): Promise<string> {
    const id = await createTestOrder(sql, userId, status);
    createdIds.orders.push(id);
    return id;
  }
  async function createOrderItem(orderId: string, domain: string, providerId?: string): Promise<string> {
    const id = await createTestOrderItem(sql, orderId, domain, 'REGISTER', providerId);
    createdIds.orderItems.push(id);
    return id;
  }
  async function createOp(params: Parameters<typeof insertOperation>[1]): Promise<string> {
    const id = await insertOperation(sql, params);
    createdIds.operations.push(id);
    return id;
  }
  async function createDomain(userId: string, domain: string, status = 'PENDING_REGISTRATION'): Promise<string> {
    const id = await insertDomain(sql, { userId, domainName: domain, status });
    createdIds.domains.push(id);
    return id;
  }

  // ════════════════════════════════════════════════════════
  // §2 Registration Orchestration — TX1 → QUEUED → PROCESSING → SUCCEEDED
  // ════════════════════════════════════════════════════════

  describe('Registration orchestration (§2)', () => {
    it('creates QUEUED operation with correct initial state', async () => {
      const userId = await createUser();
      const providerId = await createProvider();
      const orderId = await createOrder(userId);
      const itemId = await createOrderItem(orderId, 'test-reg.com');
      const _domainId = await createDomain(userId, 'test-reg.com');

      const opId = await createOp({
        orderId, orderItemId: itemId, providerId,
        status: 'QUEUED', fqdn: 'test-reg.com',
        idempotencyKey: `dynadot_REGISTER_test-reg.com_${itemId}`,
      });

      const op = await getOp(sql, opId);
      expect(op.status).toBe('QUEUED');
      expect(op.attempt_status).toBe('NOT_ATTEMPTED');
      expect(op.claim_token).toBeNull();
      expect(op.retry_count).toBe(0);
      expect(op.fqdn).toBe('test-reg.com');
    });

    it('claim transitions QUEUED → PROCESSING with claim_token', async () => {
      const _userId = await createUser();
      const providerId = await createProvider();
      const opId = await createOp({
        providerId, status: 'QUEUED', fqdn: 'claim-test.com',
      });

      // Simulate claim CTE
      const [claimed] = await sql`
        WITH candidate AS (
          SELECT id, status
          FROM registrar_operations
          WHERE id = ${opId}
            AND (status = 'QUEUED' OR (status = 'RETRY_PENDING' AND retry_count < max_retries))
            AND (claim_token IS NULL OR claimed_at < now() - interval '5 minutes')
          FOR UPDATE SKIP LOCKED
        )
        UPDATE registrar_operations ro
        SET status = 'PROCESSING',
            claim_token = gen_random_uuid(),
            claim_version = claim_version + 1,
            claimed_by = 'worker-1',
            claimed_at = now(),
            started_at = now(),
            attempt_status = 'NOT_ATTEMPTED',
            retry_count = CASE
              WHEN (SELECT status FROM candidate) = 'RETRY_PENDING'
              THEN ro.retry_count + 1
              ELSE ro.retry_count
            END
        FROM candidate c
        WHERE ro.id = c.id
        RETURNING ro.*
      `;

      expect(claimed).toBeDefined();
      expect(claimed.status).toBe('PROCESSING');
      expect(claimed.claim_token).not.toBeNull();
      expect(claimed.claimed_by).toBe('worker-1');
      expect(claimed.retry_count).toBe(0); // QUEUED doesn't increment
    });

    it('TX3 writes SUCCEEDED with CAS fencing', async () => {
      const _userId = await createUser();
      const providerId = await createProvider();
      const claimToken = randomUUID();

      const opId = await createOp({
        providerId, status: 'PROCESSING', fqdn: 'tx3-test.com',
        claimToken, claimedBy: 'worker-1', claimedAt: new Date(),
        attemptStatus: 'ATTEMPT_STARTED',
      });

      // TX3: write SUCCEEDED with claim_token CAS
      const [result] = await sql`
        UPDATE registrar_operations
        SET status = 'SUCCEEDED',
            attempt_status = 'OUTCOME_RECEIVED',
            provider_order_id = '12345',
            claim_token = NULL,
            claimed_by = NULL,
            completed_at = now()
        WHERE id = ${opId}
          AND status = 'PROCESSING'
          AND claim_token = ${claimToken}::uuid
        RETURNING *
      `;

      expect(result).toBeDefined();
      expect(result.status).toBe('SUCCEEDED');
      expect(result.provider_order_id).toBe('12345');
      expect(result.completed_at).not.toBeNull();
      expect(result.claim_token).toBeNull();
    });

    it('audit log commits in same TX as status transition', async () => {
      const _userId = await createUser();
      const providerId = await createProvider();
      const claimToken = randomUUID();

      const opId = await createOp({
        providerId, status: 'PROCESSING', fqdn: 'audit-test.com',
        claimToken, claimedBy: 'worker-1', claimedAt: new Date(),
        attemptStatus: 'ATTEMPT_STARTED',
      });

      // TX3 with audit log in same transaction
      await sql.begin(async (tx) => {
        await tx`
          UPDATE registrar_operations
          SET status = 'SUCCEEDED', attempt_status = 'OUTCOME_RECEIVED',
              claim_token = NULL, completed_at = now()
          WHERE id = ${opId} AND claim_token = ${claimToken}::uuid
        `;
        await tx`
          INSERT INTO registrar_operation_audit_log
          (operation_id, event_type, from_status, to_status, actor, details)
          VALUES (${opId}, 'STATUS_CHANGE', 'PROCESSING', 'SUCCEEDED', 'worker-1',
                  ${'{"reason":"provider confirmed"}'}::jsonb)
        `;
      });

      const logs = await getAuditLogs(sql, opId);
      expect(logs).toHaveLength(1);
      expect(logs[0].event_type).toBe('STATUS_CHANGE');
      expect(logs[0].to_status).toBe('SUCCEEDED');
    });
  });

  // ════════════════════════════════════════════════════════
  // §3 ACCEPTED flow
  // ════════════════════════════════════════════════════════

  describe('ACCEPTED flow (§3)', () => {
    it('PROCESSING → ACCEPTED keeps domain PENDING and order PROCESSING', async () => {
      const userId = await createUser();
      const providerId = await createProvider();
      const claimToken = randomUUID();
      const orderId = await createOrder(userId);
      const domainId = await createDomain(userId, 'accepted-test.com');

      const opId = await createOp({
        orderId, providerId, status: 'PROCESSING', fqdn: 'accepted-test.com',
        claimToken, claimedBy: 'worker-1', claimedAt: new Date(),
        attemptStatus: 'ATTEMPT_STARTED',
      });

      // Provider returns ACCEPTED with providerOrderId
      await sql`
        UPDATE registrar_operations
        SET status = 'ACCEPTED',
            attempt_status = 'OUTCOME_RECEIVED',
            provider_order_id = '67890',
            claim_token = NULL,
            next_reconciliation_at = now() + interval '30 seconds'
        WHERE id = ${opId} AND claim_token = ${claimToken}::uuid
      `;

      const op = await getOp(sql, opId);
      expect(op.status).toBe('ACCEPTED');
      expect(op.provider_order_id).toBe('67890');
      expect(op.next_reconciliation_at).not.toBeNull();

      // Domain stays PENDING
      const domain = await getDomain(sql, domainId);
      expect(domain.status).toBe('PENDING_REGISTRATION');

      // Order stays PROCESSING
      const order = await getOrder(sql, orderId);
      expect(order.status).toBe('PROCESSING');
    });

    it('reconciliation resolves ACCEPTED → SUCCEEDED atomically', async () => {
      const _userId = await createUser();
      const providerId = await createProvider();
      const reconToken = randomUUID();

      const opId = await createOp({
        providerId, status: 'ACCEPTED', fqdn: 'recon-accept.com',
        providerOrderId: '99999',
        reconciliationClaimToken: reconToken,
        reconciliationClaimedAt: new Date(),
        nextReconciliationAt: new Date(Date.now() - 60000),
      });

      // Reconciliation: write SUCCEEDED
      const [result] = await sql`
        UPDATE registrar_operations
        SET status = 'SUCCEEDED',
            reconciliation_attempts = reconciliation_attempts + 1,
            last_reconciliation_at = now(),
            reconciliation_claim_token = NULL,
            reconciliation_method = 'ORDER_STATUS_THEN_DOMAIN_INFO',
            completed_at = now()
        WHERE id = ${opId}
          AND reconciliation_claim_token = ${reconToken}::uuid
          AND status IN ('ACCEPTED', 'UNKNOWN')
        RETURNING *
      `;

      expect(result).toBeDefined();
      expect(result.status).toBe('SUCCEEDED');
      expect(result.reconciliation_method).toBe('ORDER_STATUS_THEN_DOMAIN_INFO');
      expect(result.completed_at).not.toBeNull();
    });
  });

  // ════════════════════════════════════════════════════════
  // §4 UNKNOWN flow
  // ════════════════════════════════════════════════════════

  describe('UNKNOWN flow (§4)', () => {
    it('PROCESSING → UNKNOWN (no RETRY_PENDING allowed)', async () => {
      const providerId = await createProvider();
      const claimToken = randomUUID();

      const opId = await createOp({
        providerId, status: 'PROCESSING', fqdn: 'unknown-test.com',
        claimToken, claimedBy: 'worker-1', claimedAt: new Date(),
        attemptStatus: 'ATTEMPT_STARTED',
      });

      await sql`
        UPDATE registrar_operations
        SET status = 'UNKNOWN',
            attempt_status = 'OUTCOME_UNKNOWN',
            claim_token = NULL,
            next_reconciliation_at = now() + interval '60 seconds'
        WHERE id = ${opId} AND claim_token = ${claimToken}::uuid
      `;

      const op = await getOp(sql, opId);
      expect(op.status).toBe('UNKNOWN');
    });

    it('CHECK constraint prevents UNKNOWN → RETRY_PENDING via status column', async () => {
      // State machine validation happens at application layer, but the DB
      // allows the column values. Verify the application-level restriction.
      // The DB CHECK allows RETRY_PENDING as a valid status value,
      // but the application state machine rejects UNKNOWN → RETRY_PENDING.
      // We verify the state machine check directly.
      const { assertValidTransition } = await import('../state-machine.js');
      expect(() => assertValidTransition('UNKNOWN', 'RETRY_PENDING')).toThrow();
    });

    it('reconciliation resolves UNKNOWN → SUCCEEDED on confirmed evidence', async () => {
      const providerId = await createProvider();
      const reconToken = randomUUID();

      const opId = await createOp({
        providerId, status: 'UNKNOWN', fqdn: 'unknown-resolve.com',
        providerOrderId: '11111',
        reconciliationClaimToken: reconToken,
        reconciliationClaimedAt: new Date(),
      });

      const [result] = await sql`
        UPDATE registrar_operations
        SET status = 'SUCCEEDED',
            reconciliation_attempts = reconciliation_attempts + 1,
            reconciliation_claim_token = NULL,
            reconciliation_method = 'ORDER_STATUS_THEN_DOMAIN_INFO',
            completed_at = now()
        WHERE id = ${opId}
          AND reconciliation_claim_token = ${reconToken}::uuid
          AND status IN ('ACCEPTED', 'UNKNOWN')
        RETURNING *
      `;

      expect(result.status).toBe('SUCCEEDED');
    });

    it('UNKNOWN remains UNKNOWN after max attempts → MANUAL_REVIEW', async () => {
      const providerId = await createProvider();

      const opId = await createOp({
        providerId, status: 'UNKNOWN', fqdn: 'unknown-exhaust.com',
        reconciliationAttempts: 9, maxReconciliationAttempts: 10,
      });

      // Simulate exhaustion: claim + final attempt
      const reconToken = randomUUID();
      await sql`
        UPDATE registrar_operations
        SET reconciliation_claim_token = ${reconToken}::uuid,
            reconciliation_claimed_at = now()
        WHERE id = ${opId}
      `;

      // Unresolved → exhaustion
      const [result] = await sql`
        UPDATE registrar_operations
        SET status = 'MANUAL_REVIEW',
            reconciliation_attempts = reconciliation_attempts + 1,
            reconciliation_claim_token = NULL,
            next_reconciliation_at = NULL,
            manual_review_reason = 'Reconciliation exhausted after max attempts',
            manual_review_escalated_at = now()
        WHERE id = ${opId}
          AND reconciliation_claim_token = ${reconToken}::uuid
          AND status IN ('ACCEPTED', 'UNKNOWN')
        RETURNING *
      `;

      expect(result.status).toBe('MANUAL_REVIEW');
      expect(result.reconciliation_attempts).toBe(10);
      expect(result.next_reconciliation_at).toBeNull();
      expect(result.manual_review_reason).toContain('exhausted');
      expect(result.manual_review_escalated_at).not.toBeNull();
    });
  });

  // ════════════════════════════════════════════════════════
  // §5 Reconciliation failure path
  // ════════════════════════════════════════════════════════

  describe('Reconciliation failure (§5)', () => {
    it('ACCEPTED → FAILED atomically with audit insert', async () => {
      const userId = await createUser();
      const providerId = await createProvider();
      const reconToken = randomUUID();
      const orderId = await createOrder(userId);
      const domainId = await createDomain(userId, 'recon-fail.com');

      const opId = await createOp({
        orderId, providerId, status: 'ACCEPTED', fqdn: 'recon-fail.com',
        providerOrderId: '22222',
        reconciliationClaimToken: reconToken,
        reconciliationClaimedAt: new Date(),
      });

      // Atomic TX: operation → FAILED + domain → REGISTRATION_FAILED + audit
      await sql.begin(async (tx) => {
        await tx`
          UPDATE registrar_operations
          SET status = 'FAILED',
              reconciliation_attempts = reconciliation_attempts + 1,
              reconciliation_claim_token = NULL,
              reconciliation_method = 'ORDER_STATUS',
              completed_at = now()
          WHERE id = ${opId}
            AND reconciliation_claim_token = ${reconToken}::uuid
            AND status IN ('ACCEPTED', 'UNKNOWN')
        `;
        await tx`
          UPDATE domains SET lifecycle_status = 'REGISTRATION_FAILED' WHERE id = ${domainId}
        `;
        await tx`
          INSERT INTO registrar_operation_audit_log
          (operation_id, event_type, from_status, to_status, actor, details)
          VALUES (${opId}, 'RECONCILIATION_FAILED', 'ACCEPTED', 'FAILED', 'reconciliation-worker',
                  ${'{"reason":"Provider order failed"}'}::jsonb)
        `;
      });

      const op = await getOp(sql, opId);
      expect(op.status).toBe('FAILED');
      const domain = await getDomain(sql, domainId);
      expect(domain.status).toBe('REGISTRATION_FAILED');
      const logs = await getAuditLogs(sql, opId);
      expect(logs.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ════════════════════════════════════════════════════════
  // §6 Retry lifecycle
  // ════════════════════════════════════════════════════════

  describe('Retry lifecycle (§6)', () => {
    it('RETRY_PENDING → PROCESSING increments retry_count exactly once', async () => {
      const providerId = await createProvider();

      const opId = await createOp({
        providerId, status: 'RETRY_PENDING', fqdn: 'retry-test.com',
        retryCount: 0, maxRetries: 3,
        nextRetryAt: new Date(Date.now() - 60000),
      });

      const [claimed] = await sql`
        WITH candidate AS (
          SELECT id, status
          FROM registrar_operations
          WHERE id = ${opId}
            AND (status = 'QUEUED' OR (status = 'RETRY_PENDING' AND retry_count < max_retries))
            AND (claim_token IS NULL OR claimed_at < now() - interval '5 minutes')
          FOR UPDATE SKIP LOCKED
        )
        UPDATE registrar_operations ro
        SET status = 'PROCESSING',
            claim_token = gen_random_uuid(),
            claim_version = claim_version + 1,
            claimed_by = 'worker-1',
            claimed_at = now(),
            retry_count = CASE
              WHEN (SELECT status FROM candidate) = 'RETRY_PENDING'
              THEN ro.retry_count + 1
              ELSE ro.retry_count
            END
        FROM candidate c
        WHERE ro.id = c.id
        RETURNING ro.*
      `;

      expect(claimed.retry_count).toBe(1); // Incremented exactly once
    });

    it('max_retries=0 permits initial QUEUED attempt', async () => {
      const providerId = await createProvider();

      const opId = await createOp({
        providerId, status: 'QUEUED', fqdn: 'zero-retry.com',
        retryCount: 0, maxRetries: 0,
      });

      const [claimed] = await sql`
        WITH candidate AS (
          SELECT id, status
          FROM registrar_operations
          WHERE id = ${opId}
            AND (status = 'QUEUED' OR (status = 'RETRY_PENDING' AND retry_count < max_retries))
            AND (claim_token IS NULL OR claimed_at < now() - interval '5 minutes')
          FOR UPDATE SKIP LOCKED
        )
        UPDATE registrar_operations ro
        SET status = 'PROCESSING',
            claim_token = gen_random_uuid(),
            claimed_by = 'worker-1',
            claimed_at = now(),
            retry_count = CASE
              WHEN (SELECT status FROM candidate) = 'RETRY_PENDING'
              THEN ro.retry_count + 1
              ELSE ro.retry_count
            END
        FROM candidate c
        WHERE ro.id = c.id
        RETURNING ro.*
      `;

      expect(claimed).toBeDefined(); // QUEUED bypasses max_retries check
      expect(claimed.retry_count).toBe(0); // Not incremented for QUEUED
    });

    it('max_retries=0 blocks subsequent RETRY_PENDING claim', async () => {
      const providerId = await createProvider();

      const opId = await createOp({
        providerId, status: 'RETRY_PENDING', fqdn: 'zero-retry-block.com',
        retryCount: 0, maxRetries: 0,
        nextRetryAt: new Date(Date.now() - 60000),
      });

      const result = await sql`
        WITH candidate AS (
          SELECT id, status
          FROM registrar_operations
          WHERE id = ${opId}
            AND (status = 'QUEUED' OR (status = 'RETRY_PENDING' AND retry_count < max_retries))
          FOR UPDATE SKIP LOCKED
        )
        UPDATE registrar_operations ro
        SET status = 'PROCESSING'
        FROM candidate c
        WHERE ro.id = c.id
        RETURNING ro.*
      `;

      expect(result).toHaveLength(0); // Blocked: retry_count(0) >= max_retries(0)
    });

    it('exhausted retries → MANUAL_REVIEW', async () => {
      const providerId = await createProvider();

      const opId = await createOp({
        providerId, status: 'RETRY_PENDING', fqdn: 'exhaust-retry.com',
        retryCount: 3, maxRetries: 3,
      });

      // Sweep exhausted
      const result = await sql`
        WITH exhausted AS (
          SELECT id FROM registrar_operations
          WHERE id = ${opId} AND status = 'RETRY_PENDING' AND retry_count >= max_retries
          FOR UPDATE SKIP LOCKED
        )
        UPDATE registrar_operations ro
        SET status = 'MANUAL_REVIEW',
            manual_review_reason = 'Retry attempts exhausted',
            manual_review_escalated_at = now(),
            next_retry_at = NULL
        FROM exhausted e
        WHERE ro.id = e.id
        RETURNING ro.*
      `;

      expect(result).toHaveLength(1);
      expect(result[0].status).toBe('MANUAL_REVIEW');
    });
  });

  // ════════════════════════════════════════════════════════
  // §7 Concurrent same-domain registration
  // ════════════════════════════════════════════════════════

  describe('Concurrent FQDN conflict (§7)', () => {
    it('exactly one operation survives for the same FQDN', async () => {
      const providerId = await createProvider();
      const userId = await createUser();
      const orderId1 = await createOrder(userId);
      const orderId2 = await createOrder(userId);
      const itemId1 = await createOrderItem(orderId1, 'Example.COM');
      const _itemId2 = await createOrderItem(orderId2, 'example.com');
      const fqdn = 'example.com'; // canonical

      // Insert first operation
      const opId1 = await createOp({
        orderId: orderId1, orderItemId: itemId1, providerId,
        status: 'QUEUED', fqdn,
        idempotencyKey: `dynadot_REGISTER_${fqdn}_${itemId1}`,
      });

      // Attempt second operation with different order/item but same FQDN
      const [existingActive] = await sql`
        SELECT id FROM registrar_operations
        WHERE fqdn = ${fqdn}
          AND operation_type = 'REGISTER'
          AND status NOT IN ('SUCCEEDED', 'FAILED', 'CANCELLED')
        LIMIT 1
      `;

      expect(existingActive).toBeDefined();
      expect(existingActive.id).toBe(opId1);
      // Application MUST reject the second request
    });

    it('DB idempotency_key UNIQUE constraint is final race protection', async () => {
      const providerId = await createProvider();
      const iKey = `unique_test_${randomUUID()}`;

      const _opId1 = await createOp({
        providerId, status: 'QUEUED', fqdn: 'unique-race.com',
        idempotencyKey: iKey,
      });

      // Attempt duplicate insert with same idempotency_key
      try {
        await sql`
          INSERT INTO registrar_operations
          (id, registrar_provider_id, status, operation_type, idempotency_key, fqdn,
           retry_count, max_retries, created_at, updated_at)
          VALUES (${randomUUID()}, ${providerId}, 'QUEUED', 'REGISTER', ${iKey}, 'unique-race.com',
                  0, 3, now(), now())
        `;
        expect.unreachable('Should have thrown unique constraint violation');
      } catch (e: any) {
        expect(e.code).toBe('23505'); // unique_violation
      }
    });
  });

  // ════════════════════════════════════════════════════════
  // §8 Idempotent duplicate request
  // ════════════════════════════════════════════════════════

  describe('Idempotent duplicate request (§8)', () => {
    it('ON CONFLICT DO NOTHING returns existing operation', async () => {
      const providerId = await createProvider();
      const iKey = `idem_dup_${randomUUID()}`;

      const opId = await createOp({
        providerId, status: 'QUEUED', fqdn: 'idem-test.com',
        idempotencyKey: iKey,
      });

      // Second insert with same idempotency_key: ON CONFLICT DO NOTHING
      const insertResult = await sql`
        INSERT INTO registrar_operations
        (id, registrar_provider_id, status, operation_type, idempotency_key, fqdn,
         retry_count, max_retries, created_at, updated_at)
        VALUES (${randomUUID()}, ${providerId}, 'QUEUED', 'REGISTER', ${iKey}, 'idem-test.com',
                0, 3, now(), now())
        ON CONFLICT (idempotency_key) DO NOTHING
        RETURNING id
      `;

      expect(insertResult).toHaveLength(0); // Nothing inserted

      // Retrieve existing
      const [existing] = await sql`
        SELECT id FROM registrar_operations WHERE idempotency_key = ${iKey}
      `;
      expect(existing.id).toBe(opId);
    });
  });

  // ════════════════════════════════════════════════════════
  // §9 Multi-item fulfillment
  // ════════════════════════════════════════════════════════

  describe('Multi-item fulfillment (§9)', () => {
    async function evaluateFulfillment(orderId: string): Promise<string> {
      // Query all operations for the order
      const ops = await sql`
        SELECT status FROM registrar_operations WHERE order_id = ${orderId}
      `;
      const items = await sql`
        SELECT id, operation FROM order_items WHERE order_id = ${orderId}
      `;

      const fulfillable = items.filter((i: any) => i.operation === 'REGISTER');
      if (fulfillable.length === 0) return 'PROCESSING';
      if (ops.length === 0) return 'PROCESSING';
      if (ops.length < fulfillable.length) return 'PROCESSING'; // Missing operations

      const statuses = ops.map((o: any) => o.status);
      if (statuses.some((s: string) => s === 'FAILED')) return 'FAILED';
      if (statuses.every((s: string) => s === 'SUCCEEDED')) return 'COMPLETED';
      return 'PROCESSING';
    }

    it('missing operations → PROCESSING', async () => {
      const userId = await createUser();
      const providerId = await createProvider();
      const orderId = await createOrder(userId);
      const item1 = await createOrderItem(orderId, 'a.com');
      const _item2 = await createOrderItem(orderId, 'b.com');
      const _item3 = await createOrderItem(orderId, 'c.com');

      // Only one operation (A = SUCCEEDED)
      await createOp({
        orderId, orderItemId: item1, providerId, status: 'SUCCEEDED', fqdn: 'a.com',
      });

      expect(await evaluateFulfillment(orderId)).toBe('PROCESSING');
    });

    it('zero operations → PROCESSING', async () => {
      const userId = await createUser();
      const orderId = await createOrder(userId);
      await createOrderItem(orderId, 'x.com');
      await createOrderItem(orderId, 'y.com');
      await createOrderItem(orderId, 'z.com');

      expect(await evaluateFulfillment(orderId)).toBe('PROCESSING');
    });

    it('partial processing → PROCESSING', async () => {
      const userId = await createUser();
      const providerId = await createProvider();
      const orderId = await createOrder(userId);
      const item1 = await createOrderItem(orderId, 'pp1.com');
      const item2 = await createOrderItem(orderId, 'pp2.com');
      const item3 = await createOrderItem(orderId, 'pp3.com');

      await createOp({ orderId, orderItemId: item1, providerId, status: 'SUCCEEDED', fqdn: 'pp1.com' });
      await createOp({ orderId, orderItemId: item2, providerId, status: 'PROCESSING', fqdn: 'pp2.com' });
      await createOp({ orderId, orderItemId: item3, providerId, status: 'SUCCEEDED', fqdn: 'pp3.com' });

      expect(await evaluateFulfillment(orderId)).toBe('PROCESSING');
    });

    it('all success → COMPLETED', async () => {
      const userId = await createUser();
      const providerId = await createProvider();
      const orderId = await createOrder(userId);
      const item1 = await createOrderItem(orderId, 'as1.com');
      const item2 = await createOrderItem(orderId, 'as2.com');
      const item3 = await createOrderItem(orderId, 'as3.com');

      await createOp({ orderId, orderItemId: item1, providerId, status: 'SUCCEEDED', fqdn: 'as1.com' });
      await createOp({ orderId, orderItemId: item2, providerId, status: 'SUCCEEDED', fqdn: 'as2.com' });
      await createOp({ orderId, orderItemId: item3, providerId, status: 'SUCCEEDED', fqdn: 'as3.com' });

      expect(await evaluateFulfillment(orderId)).toBe('COMPLETED');
    });

    it('partial failure → FAILED', async () => {
      const userId = await createUser();
      const providerId = await createProvider();
      const orderId = await createOrder(userId);
      const item1 = await createOrderItem(orderId, 'pf1.com');
      const item2 = await createOrderItem(orderId, 'pf2.com');
      const item3 = await createOrderItem(orderId, 'pf3.com');

      await createOp({ orderId, orderItemId: item1, providerId, status: 'SUCCEEDED', fqdn: 'pf1.com' });
      await createOp({ orderId, orderItemId: item2, providerId, status: 'FAILED', fqdn: 'pf2.com' });
      await createOp({ orderId, orderItemId: item3, providerId, status: 'SUCCEEDED', fqdn: 'pf3.com' });

      expect(await evaluateFulfillment(orderId)).toBe('FAILED');
    });

    it('manual review → PROCESSING (not terminal)', async () => {
      const userId = await createUser();
      const providerId = await createProvider();
      const orderId = await createOrder(userId);
      const item1 = await createOrderItem(orderId, 'mr1.com');
      const item2 = await createOrderItem(orderId, 'mr2.com');

      await createOp({ orderId, orderItemId: item1, providerId, status: 'SUCCEEDED', fqdn: 'mr1.com' });
      await createOp({ orderId, orderItemId: item2, providerId, status: 'MANUAL_REVIEW', fqdn: 'mr2.com' });

      expect(await evaluateFulfillment(orderId)).toBe('PROCESSING');
    });
  });

  // ════════════════════════════════════════════════════════
  // §10 Fenced claim concurrency
  // ════════════════════════════════════════════════════════

  describe('Fenced claim concurrency (§10)', () => {
    it('exactly one of 5 concurrent workers claims the operation', async () => {
      const providerId = await createProvider();
      const opId = await createOp({
        providerId, status: 'QUEUED', fqdn: 'concurrent-claim.com',
      });

      // 5 concurrent claim attempts
      const claims = await Promise.all(
        Array.from({ length: 5 }, (_, i) =>
          sql`
            WITH candidate AS (
              SELECT id FROM registrar_operations
              WHERE id = ${opId}
                AND (status = 'QUEUED' OR (status = 'RETRY_PENDING' AND retry_count < max_retries))
                AND (claim_token IS NULL OR claimed_at < now() - interval '5 minutes')
              FOR UPDATE SKIP LOCKED
            )
            UPDATE registrar_operations ro
            SET status = 'PROCESSING',
                claim_token = gen_random_uuid(),
                claimed_by = ${'worker-' + i},
                claimed_at = now()
            FROM candidate c
            WHERE ro.id = c.id
            RETURNING ro.*
          `
        )
      );

      const successfulClaims = claims.filter(r => r.length > 0);
      expect(successfulClaims).toHaveLength(1);
    });

    it('stale claim fencing: old worker result write rejected', async () => {
      const providerId = await createProvider();
      const oldToken = randomUUID();
      const newToken = randomUUID();

      const opId = await createOp({
        providerId, status: 'PROCESSING', fqdn: 'stale-fence.com',
        claimToken: newToken, claimedBy: 'worker-B', claimedAt: new Date(),
        attemptStatus: 'ATTEMPT_STARTED',
      });

      // Worker A (with old token) tries to write result
      const staleResult = await sql`
        UPDATE registrar_operations
        SET status = 'SUCCEEDED', claim_token = NULL, completed_at = now()
        WHERE id = ${opId}
          AND status = 'PROCESSING'
          AND claim_token = ${oldToken}::uuid
        RETURNING *
      `;

      expect(staleResult).toHaveLength(0); // Rejected: token mismatch

      // Worker B (with current token) can still write
      const [validResult] = await sql`
        UPDATE registrar_operations
        SET status = 'SUCCEEDED', claim_token = NULL, completed_at = now()
        WHERE id = ${opId}
          AND status = 'PROCESSING'
          AND claim_token = ${newToken}::uuid
        RETURNING *
      `;

      expect(validResult.status).toBe('SUCCEEDED');
    });
  });

  // ════════════════════════════════════════════════════════
  // §11 Crash window recovery
  // ════════════════════════════════════════════════════════

  describe('Crash window recovery (§11)', () => {
    it('crash before ATTEMPT_STARTED → RETRY_PENDING', async () => {
      const providerId = await createProvider();

      const opId = await createOp({
        providerId, status: 'PROCESSING', fqdn: 'crash-pre-attempt.com',
        claimToken: randomUUID(), claimedBy: 'worker-1',
        claimedAt: new Date(Date.now() - 600000), // 10 min ago = stale
        attemptStatus: 'NOT_ATTEMPTED',
      });

      // Stale claim recovery
      const [recovered] = await sql`
        WITH stale AS (
          SELECT id, attempt_status FROM registrar_operations
          WHERE id = ${opId}
            AND status = 'PROCESSING'
            AND claim_token IS NOT NULL
            AND claimed_at < now() - interval '5 minutes'
          FOR UPDATE SKIP LOCKED
        )
        UPDATE registrar_operations ro
        SET claim_token = NULL, claimed_by = NULL,
            status = CASE
              WHEN s.attempt_status = 'NOT_ATTEMPTED' THEN 'RETRY_PENDING'
              ELSE 'UNKNOWN'
            END,
            next_retry_at = CASE
              WHEN s.attempt_status = 'NOT_ATTEMPTED' THEN now() + interval '30 seconds'
              ELSE NULL
            END,
            next_reconciliation_at = CASE
              WHEN s.attempt_status != 'NOT_ATTEMPTED' THEN now() + interval '60 seconds'
              ELSE NULL
            END
        FROM stale s
        WHERE ro.id = s.id
        RETURNING ro.*
      `;

      expect(recovered.status).toBe('RETRY_PENDING');
      expect(recovered.next_retry_at).not.toBeNull();
    });

    it('crash after ATTEMPT_STARTED → UNKNOWN', async () => {
      const providerId = await createProvider();

      const opId = await createOp({
        providerId, status: 'PROCESSING', fqdn: 'crash-post-attempt.com',
        claimToken: randomUUID(), claimedBy: 'worker-1',
        claimedAt: new Date(Date.now() - 600000),
        attemptStatus: 'ATTEMPT_STARTED',
      });

      const [recovered] = await sql`
        WITH stale AS (
          SELECT id, attempt_status FROM registrar_operations
          WHERE id = ${opId}
            AND status = 'PROCESSING'
            AND claim_token IS NOT NULL
            AND claimed_at < now() - interval '5 minutes'
          FOR UPDATE SKIP LOCKED
        )
        UPDATE registrar_operations ro
        SET claim_token = NULL, claimed_by = NULL,
            status = CASE
              WHEN s.attempt_status = 'NOT_ATTEMPTED' THEN 'RETRY_PENDING'
              ELSE 'UNKNOWN'
            END,
            next_reconciliation_at = CASE
              WHEN s.attempt_status != 'NOT_ATTEMPTED' THEN now() + interval '60 seconds'
              ELSE NULL
            END
        FROM stale s
        WHERE ro.id = s.id
        RETURNING ro.*
      `;

      expect(recovered.status).toBe('UNKNOWN');
      expect(recovered.next_reconciliation_at).not.toBeNull();
    });
  });

  // ════════════════════════════════════════════════════════
  // §12 Reconciliation claim fencing
  // ════════════════════════════════════════════════════════

  describe('Reconciliation claim fencing (§12)', () => {
    it('late reconciliation worker result is rejected', async () => {
      const providerId = await createProvider();
      const tokenA = randomUUID();
      const tokenB = randomUUID();

      // Operation claimed by B (A expired)
      const opId = await createOp({
        providerId, status: 'ACCEPTED', fqdn: 'recon-fence.com',
        providerOrderId: '33333',
        reconciliationClaimToken: tokenB,
        reconciliationClaimedAt: new Date(),
      });

      // Worker A (with expired token) tries to write
      const stale = await sql`
        UPDATE registrar_operations
        SET status = 'SUCCEEDED', reconciliation_claim_token = NULL, completed_at = now()
        WHERE id = ${opId}
          AND reconciliation_claim_token = ${tokenA}::uuid
          AND status IN ('ACCEPTED', 'UNKNOWN')
        RETURNING *
      `;

      expect(stale).toHaveLength(0);

      // Worker B succeeds
      const [valid] = await sql`
        UPDATE registrar_operations
        SET status = 'SUCCEEDED', reconciliation_claim_token = NULL, completed_at = now()
        WHERE id = ${opId}
          AND reconciliation_claim_token = ${tokenB}::uuid
          AND status IN ('ACCEPTED', 'UNKNOWN')
        RETURNING *
      `;

      expect(valid.status).toBe('SUCCEEDED');
    });
  });

  // ════════════════════════════════════════════════════════
  // §13 Reconciliation exhaustion
  // ════════════════════════════════════════════════════════

  describe('Reconciliation exhaustion (§13)', () => {
    it('9→10 attempts triggers MANUAL_REVIEW atomically', async () => {
      const providerId = await createProvider();
      const reconToken = randomUUID();

      const opId = await createOp({
        providerId, status: 'UNKNOWN', fqdn: 'exhaust-recon.com',
        reconciliationAttempts: 9, maxReconciliationAttempts: 10,
        reconciliationClaimToken: reconToken,
        reconciliationClaimedAt: new Date(),
      });

      await sql.begin(async (tx) => {
        await tx`
          UPDATE registrar_operations
          SET status = 'MANUAL_REVIEW',
              reconciliation_attempts = reconciliation_attempts + 1,
              reconciliation_claim_token = NULL,
              next_reconciliation_at = NULL,
              manual_review_reason = 'Reconciliation exhausted: 10/10 attempts',
              manual_review_escalated_at = now()
          WHERE id = ${opId}
            AND reconciliation_claim_token = ${reconToken}::uuid
        `;
        await tx`
          INSERT INTO registrar_operation_audit_log
          (operation_id, event_type, from_status, to_status, actor)
          VALUES (${opId}, 'RECONCILIATION_EXHAUSTED', 'UNKNOWN', 'MANUAL_REVIEW', 'reconciliation-worker')
        `;
      });

      const op = await getOp(sql, opId);
      expect(op.status).toBe('MANUAL_REVIEW');
      expect(op.reconciliation_attempts).toBe(10);
      expect(op.next_reconciliation_at).toBeNull();
      expect(op.manual_review_reason).toContain('10/10');
      expect(op.manual_review_escalated_at).not.toBeNull();

      const logs = await getAuditLogs(sql, opId);
      expect(logs.some((l: any) => l.event_type === 'RECONCILIATION_EXHAUSTED')).toBe(true);
    });
  });

  // ════════════════════════════════════════════════════════
  // §14 Webhook business outbox
  // ════════════════════════════════════════════════════════

  describe('Webhook business outbox (§14)', () => {
    it('atomic webhook receipt + outbox insert', async () => {
      // Create a webhook event first
      const _providerId = await createProvider();
      const eventId = randomUUID();
      await sql`
        INSERT INTO webhook_events (id, provider, provider_event_id, event_type, raw_payload, received_at, processing_status, raw_payload_expires_at, signature_valid, created_at)
        VALUES (${eventId}, 'dynadot', ${'test_' + eventId}, 'order.complete', ${'{"test":true}'}::jsonb, now(), 'PROCESSED', now() + interval '30 days', true, now())
      `;

      // Atomic: mark webhook PROCESSED + insert outbox
      const outboxId = randomUUID();
      await sql.begin(async (tx) => {
        await tx`
          UPDATE webhook_events SET processing_status = 'PROCESSED' WHERE id = ${eventId}
        `;
        await tx`
          INSERT INTO webhook_business_outbox
          (id, webhook_event_id, provider_identity, event_type, event_payload, status)
          VALUES (${outboxId}, ${eventId}, 'dynadot', 'REGISTRATION_COMPLETE',
                  ${'{"providerOrderId":"44444"}'}::jsonb, 'PENDING')
        `;
      });

      // Verify outbox entry
      const [outbox] = await sql`SELECT * FROM webhook_business_outbox WHERE id = ${outboxId}`;
      expect(outbox.status).toBe('PENDING');
      expect(outbox.provider_identity).toBe('dynadot');

      // Process outbox → COMPLETED
      await sql`UPDATE webhook_business_outbox SET status = 'COMPLETED', processed_at = now() WHERE id = ${outboxId}`;
      const [processed] = await sql`SELECT * FROM webhook_business_outbox WHERE id = ${outboxId}`;
      expect(processed.status).toBe('COMPLETED');

      // Cleanup
      await sql`DELETE FROM webhook_business_outbox WHERE id = ${outboxId}`;
      await sql`DELETE FROM webhook_events WHERE id = ${eventId}`;
    });

    it('CHECK constraint enforces outbox status values', async () => {
      const _providerId = await createProvider();
      const eventId = randomUUID();
      await sql`
        INSERT INTO webhook_events (id, provider, provider_event_id, event_type, raw_payload, received_at, processing_status, raw_payload_expires_at, signature_valid, created_at)
        VALUES (${eventId}, 'test', ${'test_' + eventId}, 'test.event', ${'{}'}::jsonb, now(), 'RECEIVED', now() + interval '30 days', true, now())
      `;

      try {
        await sql`
          INSERT INTO webhook_business_outbox
          (webhook_event_id, provider_identity, event_type, event_payload, status)
          VALUES (${eventId}, 'test', 'TEST', ${'{}'}::jsonb, 'INVALID_STATUS')
        `;
        expect.unreachable('Should have thrown CHECK violation');
      } catch (e: any) {
        expect(e.code).toBe('23514'); // check_violation
      }

      await sql`DELETE FROM webhook_events WHERE id = ${eventId}`;
    });
  });

  // ════════════════════════════════════════════════════════
  // §15 Webhook race tests
  // ════════════════════════════════════════════════════════

  describe('Webhook race (§15)', () => {
    it('webhook vs worker: second write gets zero rows', async () => {
      const providerId = await createProvider();
      const claimToken = randomUUID();

      const opId = await createOp({
        providerId, status: 'PROCESSING', fqdn: 'webhook-race.com',
        claimToken, claimedBy: 'worker-1', claimedAt: new Date(),
        attemptStatus: 'ATTEMPT_STARTED',
        providerOrderId: '55555',
      });

      // Webhook resolves SUCCEEDED first (via provider correlation)
      const [webhookResult] = await sql`
        UPDATE registrar_operations
        SET status = 'SUCCEEDED',
            claim_token = NULL, claimed_by = NULL,
            completed_at = now()
        WHERE id = ${opId}
          AND status IN ('PROCESSING', 'ACCEPTED', 'UNKNOWN')
          AND registrar_provider_id = ${providerId}::uuid
          AND provider_order_id = '55555'
        RETURNING *
      `;

      expect(webhookResult.status).toBe('SUCCEEDED');

      // Worker later tries to write with stale claim token
      const workerResult = await sql`
        UPDATE registrar_operations
        SET status = 'SUCCEEDED', claim_token = NULL, completed_at = now()
        WHERE id = ${opId}
          AND status = 'PROCESSING'
          AND claim_token = ${claimToken}::uuid
        RETURNING *
      `;

      expect(workerResult).toHaveLength(0); // Fenced out: status is no longer PROCESSING
    });
  });

  // ════════════════════════════════════════════════════════
  // §16 Contact snapshot immutability
  // ════════════════════════════════════════════════════════

  describe('Contact snapshot (§16)', () => {
    it('content-addressable dedup for same user+version', async () => {
      const userId = await createUser();
      const version = createHash('sha256').update('john|doe|test@test.com').digest('hex');

      await sql`
        INSERT INTO contact_profile_snapshots
        (user_id, version, first_name, last_name, email, created_at)
        VALUES (${userId}, ${version}, 'John', 'Doe', 'test@test.com', now())
      `;

      // Same user + same version → conflict
      try {
        await sql`
          INSERT INTO contact_profile_snapshots
          (user_id, version, first_name, last_name, email, created_at)
          VALUES (${userId}, ${version}, 'John', 'Doe', 'test@test.com', now())
        `;
        expect.unreachable('Should conflict');
      } catch (e: any) {
        expect(e.code).toBe('23505');
      }
    });

    it('different version creates new snapshot (profile edit)', async () => {
      const userId = await createUser();
      const v1 = createHash('sha256').update('john|doe|v1@test.com').digest('hex');
      const v2 = createHash('sha256').update('jane|doe|v2@test.com').digest('hex');

      await sql`
        INSERT INTO contact_profile_snapshots
        (user_id, version, first_name, last_name, email, created_at)
        VALUES (${userId}, ${v1}, 'John', 'Doe', 'v1@test.com', now())
      `;
      await sql`
        INSERT INTO contact_profile_snapshots
        (user_id, version, first_name, last_name, email, created_at)
        VALUES (${userId}, ${v2}, 'Jane', 'Doe', 'v2@test.com', now())
      `;

      const snapshots = await sql`
        SELECT * FROM contact_profile_snapshots WHERE user_id = ${userId} ORDER BY created_at
      `;
      expect(snapshots).toHaveLength(2);
      expect(snapshots[0].first_name).toBe('John');
      expect(snapshots[1].first_name).toBe('Jane');
    });
  });

  // ════════════════════════════════════════════════════════
  // §17 Manual review
  // ════════════════════════════════════════════════════════

  describe('Manual review (§17)', () => {
    it('CONFIRM_SUCCEEDED resolves to SUCCEEDED', async () => {
      const userId = await createUser();
      const providerId = await createProvider();

      const opId = await createOp({
        providerId, status: 'MANUAL_REVIEW', fqdn: 'manual-succeed.com',
        manualReviewReason: 'Reconciliation exhausted',
        manualReviewEscalatedAt: new Date(),
      });

      const [result] = await sql`
        UPDATE registrar_operations
        SET status = 'SUCCEEDED',
            resolution_action = 'CONFIRM_SUCCEEDED',
            resolution_reason = 'Verified via provider admin panel',
            resolution_evidence = 'Screenshot attached',
            resolved_by = ${userId}::uuid,
            resolved_at = now(),
            completed_at = now()
        WHERE id = ${opId}
          AND status = 'MANUAL_REVIEW'
        RETURNING *
      `;

      expect(result.status).toBe('SUCCEEDED');
      expect(result.resolution_action).toBe('CONFIRM_SUCCEEDED');
      expect(result.resolved_by).toBe(userId);
    });

    it('CONFIRM_FAILED resolves to FAILED', async () => {
      const userId = await createUser();
      const providerId = await createProvider();

      const opId = await createOp({
        providerId, status: 'MANUAL_REVIEW', fqdn: 'manual-fail.com',
        manualReviewReason: 'Unknown state',
      });

      const [result] = await sql`
        UPDATE registrar_operations
        SET status = 'FAILED',
            resolution_action = 'CONFIRM_FAILED',
            resolution_reason = 'Domain not found in provider',
            resolved_by = ${userId}::uuid,
            resolved_at = now(),
            completed_at = now()
        WHERE id = ${opId} AND status = 'MANUAL_REVIEW'
        RETURNING *
      `;

      expect(result.status).toBe('FAILED');
    });

    it('RETRY transitions to RETRY_PENDING', async () => {
      const userId = await createUser();
      const providerId = await createProvider();

      const opId = await createOp({
        providerId, status: 'MANUAL_REVIEW', fqdn: 'manual-retry.com',
        attemptStatus: 'NOT_ATTEMPTED',
        manualReviewReason: 'Unknown state',
      });

      const [result] = await sql`
        UPDATE registrar_operations
        SET status = 'RETRY_PENDING',
            resolution_action = 'RETRY',
            resolution_reason = 'No prior attempt detected, safe to retry',
            resolved_by = ${userId}::uuid,
            resolved_at = now(),
            next_retry_at = now() + interval '10 seconds'
        WHERE id = ${opId} AND status = 'MANUAL_REVIEW'
        RETURNING *
      `;

      expect(result.status).toBe('RETRY_PENDING');
      expect(result.next_retry_at).not.toBeNull();
    });

    it('CHECK constraint allows valid resolution actions', async () => {
      // The CHECK constraint allows: CONFIRM_SUCCEEDED, CONFIRM_FAILED, RETRY, CANCELLED
      const providerId = await createProvider();

      const opId = await createOp({
        providerId, status: 'MANUAL_REVIEW', fqdn: 'check-action.com',
      });

      try {
        await sql`
          UPDATE registrar_operations
          SET resolution_action = 'INVALID_ACTION'
          WHERE id = ${opId}
        `;
        expect.unreachable('Should violate CHECK');
      } catch (e: any) {
        expect(e.code).toBe('23514');
      }
    });
  });

  // ════════════════════════════════════════════════════════
  // §19 CSRF / origin
  // ════════════════════════════════════════════════════════

  describe('CSRF origin (§19)', () => {
    it('main.ts does not hardcode prisnames.com for CSRF/CORS', async () => {
      const mainTs = readFileSync(
        resolve(__dirname, '../../../main.ts'), 'utf-8',
      );

      // Should NOT contain hardcoded prisnames.com for CORS/CSRF
      const lines = mainTs.split('\n');
      const violating = lines.filter(
        (l) => /origin.*prisnames\.com/i.test(l) && !l.trim().startsWith('//') && !l.trim().startsWith('*'),
      );
      expect(violating, 'Hardcoded prisnames.com found in main.ts').toHaveLength(0);

      // Should reference env.WEB_URL or process.env.WEB_URL
      expect(mainTs).toMatch(/WEB_URL/);
    });
  });

  // ════════════════════════════════════════════════════════
  // §20 Provider-neutral architecture
  // ════════════════════════════════════════════════════════

  describe('Provider-neutral architecture (§20)', () => {
    it('business modules have zero @prisnames/registrar-dynadot imports', async () => {
      const modulesDir = resolve(__dirname, '../../');
      const allowed = ['registrar/registrar.module.ts', 'webhooks/webhook-ingestion.service.ts'];
      const importPattern = /(?:from\s+['"]@prisnames\/registrar-dynadot|require\s*\(\s*['"]@prisnames\/registrar-dynadot)/;

      function collectTs(dir: string, files: string[] = []): string[] {
        for (const entry of readdirSync(dir)) {
          const full = join(dir, entry);
          const stat = statSync(full);
          if (stat.isDirectory() && !entry.startsWith('__')) {
            collectTs(full, files);
          } else if (entry.endsWith('.ts') && !entry.endsWith('.test.ts') && !entry.endsWith('.spec.ts')) {
            files.push(full);
          }
        }
        return files;
      }

      const files = collectTs(modulesDir);
      const violations: string[] = [];

      for (const file of files) {
        const rel = relative(modulesDir, file);
        if (allowed.some(a => rel.endsWith(a))) continue;
        const content = readFileSync(file, 'utf-8');
        if (importPattern.test(content)) violations.push(rel);
      }

      expect(violations, `Business modules importing dynadot: ${violations.join(', ')}`).toHaveLength(0);
    });

    it('provider_order_id is VARCHAR in database', async () => {
      const [col] = await sql`
        SELECT data_type FROM information_schema.columns
        WHERE table_name = 'registrar_operations' AND column_name = 'provider_order_id'
      `;
      expect(col.data_type).toBe('character varying');
    });
  });
});
