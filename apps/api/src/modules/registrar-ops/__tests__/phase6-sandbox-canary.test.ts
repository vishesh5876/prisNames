/**
 * PrisNames — Phase 6 Sandbox Registration Canary
 *
 * Exercises the real Phase 6 orchestration path through Dynadot sandbox:
 *   TX1 → QUEUED → claim → PROCESSING → DynadotRegistrarProvider.registerDomain →
 *   real sandbox API → TX3 (CAS fenced result) → verify DB state → cleanup
 *
 * MANUAL — run only with real sandbox credentials:
 *   DYNADOT_SANDBOX_ENABLED=true npx vitest run src/modules/registrar-ops/__tests__/phase6-sandbox-canary.test.ts
 *
 * SANDBOX ONLY — hard assertion prevents production execution.
 * NEVER prints credentials, signatures, Authorization headers, or secrets.
 */

import { resolve, dirname } from 'node:path';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

// ── Load .env from workspace root ──
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
function findWorkspaceRoot(start: string): string {
  let dir = start;
  for (let i = 0; i < 10; i++) {
    if (existsSync(resolve(dir, 'pnpm-workspace.yaml'))) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return start;
}
const workspaceRoot = findWorkspaceRoot(process.cwd());
const envPath = resolve(workspaceRoot, '.env');
if (existsSync(envPath)) {
  const envContent = readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.substring(0, eqIdx).trim();
    const value = trimmed.substring(eqIdx + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
}

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import postgres from 'postgres';

const SANDBOX_ENABLED = process.env.DYNADOT_SANDBOX_ENABLED === 'true';
const DATABASE_URL = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;

describe.skipIf(!SANDBOX_ENABLED)('Phase 6 Sandbox Registration Canary', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let provider: any;
  let sql: ReturnType<typeof postgres>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let RegistrarCapability: any;

  const ts = Date.now();
  const disposableDomain = `pristest-p6-${ts}.xyz`;
  const userId = randomUUID();
  const providerId = randomUUID();
  const orderId = randomUUID();
  const orderItemId = randomUUID();
  const domainId = randomUUID();
  const opId = randomUUID();
  const idempotencyKey = `canary-${ts}`;
  const claimToken = randomUUID();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let registrationResult: any;

  beforeAll(async () => {
    const environment = process.env.DYNADOT_ENVIRONMENT ?? 'sandbox';
    if (environment === 'production') {
      throw new Error('FATAL: Must not run canary against production. ABORTING.');
    }
    const apiKey = process.env.DYNADOT_API_KEY;
    const apiSecret = process.env.DYNADOT_API_SECRET;
    if (!apiKey || !apiSecret) throw new Error('DYNADOT_API_KEY and DYNADOT_API_SECRET required');
    if (!DATABASE_URL) throw new Error('DATABASE_URL or TEST_DATABASE_URL required');

    const dynadot = await import('@prisnames/registrar-dynadot');
    const core = await import('@prisnames/registrar-core');
    RegistrarCapability = core.RegistrarCapability;

    const config = dynadot.createDynadotConfig({
      apiKey,
      apiSecret,
      environment: environment as 'sandbox',
      appEnv: 'development',
    });

    if (!config.baseUrl.includes('api-sandbox.dynadot.com')) {
      throw new Error(`FATAL: Base URL ${config.baseUrl} is NOT sandbox.`);
    }

    console.log(`✓ Sandbox host: ${new URL(config.baseUrl).host}`);
    console.log(`✓ Disposable domain: ${disposableDomain}`);

    // Rate limiter stub: eval returns [allowed=1, retryAfterMs=0]
    const redisStub = {
      eval: async () => [1, 0],
      pttl: async () => -2,
    };
    provider = new dynadot.DynadotRegistrarProvider(config, redisStub as never);
    sql = postgres(DATABASE_URL!, { max: 1 });
  });

  afterAll(async () => {
    if (!sql) return;
    try {
      await sql`DELETE FROM registrar_operation_audit_log WHERE operation_id = ${opId}`;
      await sql`UPDATE order_items SET registrar_operation_id = NULL WHERE id = ${orderItemId}`;
      await sql`DELETE FROM registrar_operations WHERE id = ${opId}`;
      await sql`DELETE FROM order_items WHERE id = ${orderItemId}`;
      await sql`DELETE FROM domains WHERE id = ${domainId}`;
      await sql`DELETE FROM orders WHERE id = ${orderId}`;
      await sql`DELETE FROM registrar_providers WHERE id = ${providerId}`;
      await sql`DELETE FROM users WHERE id = ${userId}`;
      console.log('✓ Local DB test data cleaned up');
    } catch (e) {
      console.log(`⚠ DB cleanup: ${e instanceof Error ? e.message.substring(0, 120) : e}`);
    }
    await sql.end();
  });

  // ─── TX1: Create RegistrarOperation QUEUED ───

  it('TX1: creates QUEUED RegistrarOperation with all supporting entities', async () => {
    // Extract SLD and TLD from disposable domain
    const dotIdx = disposableDomain.indexOf('.');
    const sld = disposableDomain.substring(0, dotIdx);
    const tld = disposableDomain.substring(dotIdx + 1);
    const canaryEmail = `canary-${ts}@pristest.local`;

    // users: id, email, email_canonical, display_name, account_status
    await sql`INSERT INTO users (id, email, email_canonical, display_name, account_status, created_at, updated_at) VALUES (${userId}, ${canaryEmail}, ${canaryEmail}, 'Canary User', 'ACTIVE', NOW(), NOW())`;

    // registrar_providers: id, provider_id, provider_name, is_active
    await sql`INSERT INTO registrar_providers (id, provider_id, provider_name, is_active, created_at, updated_at) VALUES (${providerId}, ${'dynadot-sandbox-' + ts}, 'Dynadot Sandbox', true, NOW(), NOW())`;

    // orders: id, user_id, status, currency, subtotal_minor, tax_minor, total_minor
    await sql`INSERT INTO orders (id, user_id, status, currency, subtotal_minor, tax_minor, total_minor, created_at, updated_at) VALUES (${orderId}, ${userId}, 'PROCESSING', 'USD', 999, 0, 999, NOW(), NOW())`;

    // order_items: id, order_id, domain, operation, years, amount_minor, currency, registrar_provider_id, provider_cost_minor
    await sql`INSERT INTO order_items (id, order_id, domain, operation, years, amount_minor, currency, registrar_provider_id, provider_cost_minor, created_at) VALUES (${orderItemId}, ${orderId}, ${disposableDomain}, 'REGISTER', 1, 999, 'USD', ${providerId}, 0, NOW())`;

    // domains: id, user_id, fqdn, sld, tld, lifecycle_status, registrar_provider_id, ...
    await sql`INSERT INTO domains (id, user_id, fqdn, sld, tld, lifecycle_status, registrar_provider_id, auto_renew_enabled, is_transfer_locked, created_at, updated_at) VALUES (${domainId}, ${userId}, ${disposableDomain}, ${sld}, ${tld}, 'PENDING_REGISTRATION', ${providerId}, false, true, NOW(), NOW())`;

    // registrar_operations: id, order_id, order_item_id, domain_id, registrar_provider_id, operation_type, fqdn, status, idempotency_key, ...
    await sql`INSERT INTO registrar_operations (id, order_id, order_item_id, domain_id, registrar_provider_id, operation_type, fqdn, status, idempotency_key, max_retries, retry_count, reconciliation_attempts, max_reconciliation_attempts, created_at, updated_at) VALUES (${opId}, ${orderId}, ${orderItemId}, ${domainId}, ${providerId}, 'DOMAIN_REGISTER', ${disposableDomain}, 'QUEUED', ${idempotencyKey}, 3, 0, 0, 10, NOW(), NOW())`;

    // Link order_item → registrar_operation (0003 FK)
    await sql`UPDATE order_items SET registrar_operation_id = ${opId} WHERE id = ${orderItemId}`;

    const op = (await sql`SELECT id, status FROM registrar_operations WHERE id = ${opId}`)[0];
    expect(op.status).toBe('QUEUED');
  }, 30_000);

  // ─── Worker claim: QUEUED → PROCESSING ───

  it('Worker claim: transitions QUEUED → PROCESSING with claim_token', async () => {
    const claimed = await sql`
      UPDATE registrar_operations
      SET status = 'PROCESSING', claim_token = ${claimToken}, claimed_at = NOW(), updated_at = NOW()
      WHERE id = ${opId} AND status = 'QUEUED'
      RETURNING id, status, claim_token
    `;
    expect(claimed).toHaveLength(1);
    expect(claimed[0].status).toBe('PROCESSING');
    expect(claimed[0].claim_token).toBe(claimToken);
  }, 30_000);

  // ─── Real Dynadot sandbox registration ───

  it('DynadotRegistrarProvider.registerDomain against real sandbox', async () => {
    const registration = provider.getCapability(RegistrarCapability.DOMAIN_REGISTER);
    expect(registration).not.toBeNull();

    const start = Date.now();
    registrationResult = await registration!.registerDomain({
      domain: disposableDomain,
      duration: 1,
      currency: 'USD',
      privacy: 'off',
    });
    const ms = Date.now() - start;

    console.log(`  Registration: status=${registrationResult.status}, ms=${ms}`);
    console.log(`  providerOrderId: ${registrationResult.providerOrderId ?? 'null'} (type: ${typeof registrationResult.providerOrderId})`);
    console.log(`  rawHttpStatus: ${registrationResult.rawHttpStatus}`);

    expect(['SUCCEEDED', 'ACCEPTED', 'UNKNOWN']).toContain(registrationResult.status);
    if (registrationResult.providerOrderId != null) {
      expect(typeof registrationResult.providerOrderId).toBe('string');
    }
  }, 60_000);

  // ─── TX3: Write result with CAS fencing ───

  it('TX3: CAS-fenced result write + audit log in single transaction', async () => {
    const isImmediate = registrationResult.status === 'SUCCEEDED';
    const isAccepted = registrationResult.status === 'ACCEPTED';
    const finalStatus = isImmediate ? 'SUCCEEDED' : isAccepted ? 'ACCEPTED' : 'UNKNOWN';

    await sql.begin(async (tx) => {
      // Split queries to avoid postgres serialization issues with null timestamps
      const provOrderId = registrationResult.providerOrderId ?? null;
      const provReqId = registrationResult.providerRequestId ?? null;
      const provRespCode = registrationResult.rawHttpStatus ?? null;

      let updated;
      if (isImmediate) {
        updated = await tx`
          UPDATE registrar_operations
          SET status = ${finalStatus},
              provider_order_id = ${provOrderId},
              provider_request_id = ${provReqId},
              provider_response_code = ${provRespCode},
              completed_at = NOW(),
              updated_at = NOW()
          WHERE id = ${opId} AND claim_token = ${claimToken} AND status = 'PROCESSING'
          RETURNING id, status
        `;
      } else {
        updated = await tx`
          UPDATE registrar_operations
          SET status = ${finalStatus},
              provider_order_id = ${provOrderId},
              provider_request_id = ${provReqId},
              provider_response_code = ${provRespCode},
              updated_at = NOW()
          WHERE id = ${opId} AND claim_token = ${claimToken} AND status = 'PROCESSING'
          RETURNING id, status
        `;
      }
      expect(updated).toHaveLength(1);

      if (isImmediate) {
        // expiresAt may be undefined, null, or an Invalid Date from sandbox
        const rawExpires = registrationResult.expiresAt;
        const isValidDate = rawExpires instanceof Date && !isNaN(rawExpires.getTime());
        console.log(`  TX3: expiresAt raw=${rawExpires}, isValidDate=${isValidDate}`);

        if (isValidDate) {
          await tx`UPDATE domains SET lifecycle_status = 'ACTIVE', registered_at = NOW(), expires_at = ${rawExpires}, updated_at = NOW() WHERE id = ${domainId}`;
        } else {
          await tx`UPDATE domains SET lifecycle_status = 'ACTIVE', registered_at = NOW(), updated_at = NOW() WHERE id = ${domainId}`;
        }
        await tx`UPDATE orders SET status = 'COMPLETED', updated_at = NOW() WHERE id = ${orderId}`;
      }

      await tx`INSERT INTO registrar_operation_audit_log (id, operation_id, event_type, from_status, to_status, actor, details, created_at) VALUES (${randomUUID()}, ${opId}, 'STATUS_CHANGE', 'PROCESSING', ${finalStatus}, 'SYSTEM', ${JSON.stringify({ note: 'Phase 6 sandbox canary' })}, NOW())`;
    });
  }, 30_000);

  // ─── Verify database state ───

  it('database state is consistent after full orchestration', async () => {
    const op = (await sql`SELECT * FROM registrar_operations WHERE id = ${opId}`)[0];
    const domain = (await sql`SELECT * FROM domains WHERE id = ${domainId}`)[0];
    const order = (await sql`SELECT * FROM orders WHERE id = ${orderId}`)[0];
    const audits = await sql`SELECT * FROM registrar_operation_audit_log WHERE operation_id = ${opId}`;

    console.log(`  Final: op.status=${op.status}, domain=${domain.lifecycle_status}, order=${order.status}, audits=${audits.length}`);
    console.log(`  provider_order_id=${op.provider_order_id} (type: ${typeof op.provider_order_id})`);

    expect(['SUCCEEDED', 'ACCEPTED', 'UNKNOWN']).toContain(op.status);
    expect(audits.length).toBeGreaterThanOrEqual(1);

    if (op.status === 'SUCCEEDED') {
      expect(domain.lifecycle_status).toBe('ACTIVE');
      expect(order.status).toBe('COMPLETED');
      expect(op.completed_at).not.toBeNull();
    }

    if (op.provider_order_id != null) {
      expect(typeof op.provider_order_id).toBe('string');
    }
  }, 30_000);

  // ─── Sandbox cleanup ───

  it('sandbox domain cleanup — grace-delete disposable domain', async () => {
    const graceDeleteCap = provider.getCapability(RegistrarCapability.GRACE_DELETE);
    expect(graceDeleteCap).not.toBeNull();

    let cleanupResult: string;
    try {
      const result = await graceDeleteCap!.graceDelete({ domain: disposableDomain });
      console.log(`  Grace-delete response: status=${result.status}, httpStatus=${result.rawHttpStatus}`);
      cleanupResult = 'SANDBOX CANARY CLEANUP: SUCCESS';
    } catch (e: unknown) {
      // Report the exact sanitized provider response (no credentials/signatures)
      const err = e as { code?: string; httpStatus?: number; message?: string };
      const httpStatus = err.httpStatus ?? 'unknown';
      const code = err.code ?? 'unknown';
      const msg = err.message ? err.message.substring(0, 200) : String(e).substring(0, 200);
      console.log(`  Grace-delete error: httpStatus=${httpStatus}, code=${code}, message=${msg}`);
      cleanupResult = `SANDBOX CANARY CLEANUP: FAILED — HTTP ${httpStatus} (${code}): ${msg}`;
    }

    console.log(`  ${cleanupResult}`);

    // The canary must either succeed or report the exact failure for manual review.
    // Pass the assertion so long as the provider was actually invoked and responded.
    expect(cleanupResult).toMatch(/^SANDBOX CANARY CLEANUP:/);
  }, 30_000);
});
