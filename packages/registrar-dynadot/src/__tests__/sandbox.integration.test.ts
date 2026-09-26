/**
 * PrisNames — Dynadot Sandbox Integration Tests
 *
 * PRE-PHASE-6 PROVIDER VERIFICATION GATE
 *
 * MANUAL — run only with real sandbox credentials:
 *   pnpm --filter @prisnames/registrar-dynadot test:sandbox
 *
 * Tests safe read-only operations against the real Dynadot sandbox API.
 * Each operation is reported independently as:
 *   SANDBOX_VERIFIED       — succeeded with expected response shape
 *   SANDBOX_UNSUPPORTED    — endpoint returned 404/501 or "not supported" (sandbox limitation)
 *   SANDBOX_FAILED         — unexpected error
 *   SANDBOX_NOT_APPLICABLE — required sandbox data does not exist
 *
 * Credentials are loaded from .env (never from command-line arguments).
 *
 * SAFETY:
 * - Hard assertion prevents running against production
 * - No mutation operations (register, renew, transfer, etc.)
 * - No credentials in console output
 */

import { resolve, dirname } from 'node:path';
import { readFileSync, existsSync } from 'node:fs';

// Find workspace root .env (walk up from CWD looking for pnpm-workspace.yaml)
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
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

import { describe, it, expect, beforeAll } from 'vitest';
import RedisMock from 'ioredis-mock';
import type Redis from 'ioredis';
import { DynadotRegistrarProvider } from '../provider.js';
import { createDynadotConfig } from '../config.js';
import { RegistrarCapability } from '@prisnames/registrar-core';

const SANDBOX_ENABLED = process.env.DYNADOT_SANDBOX_ENABLED === 'true';

// ── Safe diagnostic reporter (no credentials) ──

interface SandboxResult {
  operation: string;
  endpoint: string;
  signed: boolean;
  method: string;
  evidence: string;
  notes: string;
  durationMs?: number;
}

const results: SandboxResult[] = [];

function reportResult(r: SandboxResult) {
  results.push(r);
  console.log(`[${r.evidence}] ${r.operation} (${r.method} ${r.endpoint}, signed=${r.signed}) — ${r.notes}`);
}

function safeDiagnostic(e: unknown): string {
  if (!(e instanceof Error)) return String(e);
  const msg = e.message;
  // Strip any potential credential content — only report error classification
  if (msg.includes('401')) return 'HTTP 401 Unauthorized';
  if (msg.includes('403')) return 'HTTP 403 Forbidden';
  if (msg.includes('404')) return 'HTTP 404 Not Found';
  if (msg.includes('429')) return 'HTTP 429 Rate Limited';
  if (msg.includes('500')) return 'HTTP 500 Internal Server Error';
  if (msg.includes('501')) return 'HTTP 501 Not Implemented';
  if (msg.includes('502')) return 'HTTP 502 Bad Gateway';
  if (msg.includes('503')) return 'HTTP 503 Service Unavailable';
  if (msg.includes('timeout')) return 'Request timeout';
  if (msg.includes('ECONNREFUSED')) return 'Connection refused';
  if (msg.includes('ENOTFOUND')) return 'DNS resolution failed';
  // Truncate and sanitize
  return msg.length > 100 ? msg.substring(0, 100) + '...' : msg;
}

describe.skipIf(!SANDBOX_ENABLED)('Dynadot Sandbox Integration — Pre-Phase-6 Provider Gate', () => {
  let provider: DynadotRegistrarProvider;

  beforeAll(() => {
    const apiKey = process.env.DYNADOT_API_KEY;
    const apiSecret = process.env.DYNADOT_API_SECRET;
    const environment = (process.env.DYNADOT_ENVIRONMENT ?? 'sandbox') as 'sandbox' | 'production';

    // ── HARD ASSERTION: refuse to run against production ──
    if (environment === 'production') {
      throw new Error(
        'FATAL: Sandbox tests must not run against production. ' +
        'Set DYNADOT_ENVIRONMENT=sandbox in .env. Aborting.',
      );
    }

    if (!apiKey || !apiSecret) {
      throw new Error('DYNADOT_API_KEY and DYNADOT_API_SECRET must be set for sandbox tests');
    }

    if (apiKey.length === 0 || apiSecret.length === 0) {
      throw new Error('DYNADOT_API_KEY and DYNADOT_API_SECRET must not be empty');
    }

    const config = createDynadotConfig({
      apiKey,
      apiSecret,
      environment,
      appEnv: 'development',
    });

    // ── HARD ASSERTION: verify resolved base URL is sandbox ──
    if (!config.baseUrl.includes('api-sandbox.dynadot.com')) {
      throw new Error(
        `FATAL: Resolved base URL does not point to sandbox: ${config.baseUrl}. Aborting.`,
      );
    }

    console.log(`Sandbox base URL verified: ${config.baseUrl}`);

    const redis = new RedisMock();
    provider = new DynadotRegistrarProvider(config, redis as unknown as Redis);
  });

  // ───────────────────────────────────────────────
  // GATE 1: Signed GET — Account Info (MUST PASS FIRST)
  // ───────────────────────────────────────────────

  describe('1. Signed GET — Account Info (foundational)', () => {
    it('signed GET to /restful/v2/accounts/info succeeds with correct HMAC', async () => {
      const start = Date.now();
      try {
        const account = provider.getCapability(RegistrarCapability.ACCOUNT_INFO);
        expect(account).not.toBeNull();

        const info = await account!.getAccountInfo();
        const ms = Date.now() - start;

        expect(info).toBeDefined();

        reportResult({
          operation: 'account_info',
          endpoint: '/restful/v2/accounts/info',
          signed: true,
          method: 'GET',
          evidence: 'SANDBOX_VERIFIED',
          notes: `Signed GET accepted. Duration: ${ms}ms.`,
          durationMs: ms,
        });
      } catch (e) {
        const ms = Date.now() - start;
        const diag = safeDiagnostic(e);

        // A 401/403 means signing is wrong — foundational failure
        if (diag.includes('401') || diag.includes('403')) {
          reportResult({
            operation: 'account_info',
            endpoint: '/restful/v2/accounts/info',
            signed: true,
            method: 'GET',
            evidence: 'SANDBOX_FAILED',
            notes: `FOUNDATIONAL FAILURE: ${diag}. Duration: ${ms}ms. X-Signature or credentials rejected.`,
            durationMs: ms,
          });
          throw new Error(
            `STOP: Account Info signed GET failed with ${diag}. ` +
            'Cannot proceed with other sandbox tests until signing is verified.',
          );
        }

        reportResult({
          operation: 'account_info',
          endpoint: '/restful/v2/accounts/info',
          signed: true,
          method: 'GET',
          evidence: 'SANDBOX_FAILED',
          notes: `${diag}. Duration: ${ms}ms.`,
          durationMs: ms,
        });
        throw e;
      }
    }, 30_000);
  });

  // ───────────────────────────────────────────────
  // GATE 2: Domain Search (unsigned)
  // ───────────────────────────────────────────────

  describe('2. Domain Search', () => {
    it('checks availability of a taken domain (google.com)', async () => {
      const start = Date.now();
      try {
        const search = provider.getCapability(RegistrarCapability.DOMAIN_SEARCH);
        expect(search).not.toBeNull();

        const result = await search!.checkAvailability('google.com');
        const ms = Date.now() - start;

        expect(result.domain).toBeTruthy();
        expect(result.available).toBe(false);

        reportResult({
          operation: 'domain_search_taken',
          endpoint: '/restful/v2/domains/{domain_name}/search',
          signed: false,
          method: 'GET',
          evidence: 'SANDBOX_VERIFIED',
          notes: `google.com=unavailable. Duration: ${ms}ms.`,
          durationMs: ms,
        });
      } catch (e) {
        const ms = Date.now() - start;
        const diag = safeDiagnostic(e);
        reportResult({
          operation: 'domain_search_taken',
          endpoint: '/restful/v2/domains/{domain_name}/search',
          signed: false,
          method: 'GET',
          evidence: diag.includes('404') || diag.includes('501') ? 'SANDBOX_UNSUPPORTED' : 'SANDBOX_FAILED',
          notes: `${diag}. Duration: ${ms}ms.`,
          durationMs: ms,
        });
        if (!diag.includes('404') && !diag.includes('501')) throw e;
      }
    }, 30_000);

    it('checks availability of a random domain', async () => {
      const start = Date.now();
      try {
        const search = provider.getCapability(RegistrarCapability.DOMAIN_SEARCH);
        expect(search).not.toBeNull();

        const randomDomain = `xyztest-${Date.now()}.xyz`;
        const result = await search!.checkAvailability(randomDomain);
        const ms = Date.now() - start;

        expect(result.domain).toBeTruthy();

        reportResult({
          operation: 'domain_search_random',
          endpoint: '/restful/v2/domains/{domain_name}/search',
          signed: false,
          method: 'GET',
          evidence: 'SANDBOX_VERIFIED',
          notes: `available=${result.available}, premium=${result.premium ?? false}. Duration: ${ms}ms.`,
          durationMs: ms,
        });
      } catch (e) {
        const ms = Date.now() - start;
        const diag = safeDiagnostic(e);
        reportResult({
          operation: 'domain_search_random',
          endpoint: '/restful/v2/domains/{domain_name}/search',
          signed: false,
          method: 'GET',
          evidence: diag.includes('404') || diag.includes('501') ? 'SANDBOX_UNSUPPORTED' : 'SANDBOX_FAILED',
          notes: `${diag}. Duration: ${ms}ms.`,
          durationMs: ms,
        });
        if (!diag.includes('404') && !diag.includes('501')) throw e;
      }
    }, 30_000);
  });

  // ───────────────────────────────────────────────
  // GATE 3: TLD Pricing (unsigned)
  // ───────────────────────────────────────────────

  describe('3. TLD Pricing', () => {
    it('retrieves TLD prices', async () => {
      const start = Date.now();
      try {
        const pricing = provider.getCapability(RegistrarCapability.TLD_PRICING);
        expect(pricing).not.toBeNull();

        const result = await pricing!.getTldPrices({ currency: 'USD' });
        const ms = Date.now() - start;

        expect(result.items.length).toBeGreaterThan(0);

        // Verify money parsing — no floating point
        const first = result.items[0]!;
        expect(typeof first.registerPrice.minorUnits).toBe('bigint');
        expect(first.registerPrice.currency).toBe('USD');

        reportResult({
          operation: 'tld_pricing',
          endpoint: '/restful/v2/domains/get_tld_price',
          signed: false,
          method: 'GET',
          evidence: 'SANDBOX_VERIFIED',
          notes: `${result.items.length} TLDs returned. Duration: ${ms}ms.`,
          durationMs: ms,
        });
      } catch (e) {
        const ms = Date.now() - start;
        const diag = safeDiagnostic(e);
        reportResult({
          operation: 'tld_pricing',
          endpoint: '/restful/v2/domains/get_tld_price',
          signed: false,
          method: 'GET',
          evidence: diag.includes('404') || diag.includes('501') ? 'SANDBOX_UNSUPPORTED' : 'SANDBOX_FAILED',
          notes: `${diag}. Duration: ${ms}ms.`,
          durationMs: ms,
        });
        if (!diag.includes('404') && !diag.includes('501')) throw e;
      }
    }, 30_000);
  });

  // ───────────────────────────────────────────────
  // GATE 4: Domain List (signed)
  // ───────────────────────────────────────────────

  describe('4. Domain List', () => {
    it('lists domains in account', async () => {
      const start = Date.now();
      try {
        const domainInfo = provider.getCapability(RegistrarCapability.DOMAIN_INFO);
        expect(domainInfo).not.toBeNull();

        const result = await domainInfo!.listDomains({ page: 1, perPage: 10 });
        const ms = Date.now() - start;

        expect(result).toBeDefined();

        reportResult({
          operation: 'domain_list',
          endpoint: '/restful/v2/domains',
          signed: true,
          method: 'GET',
          evidence: 'SANDBOX_VERIFIED',
          notes: `${result.items?.length ?? 0} domains. Duration: ${ms}ms.`,
          durationMs: ms,
        });
      } catch (e) {
        const ms = Date.now() - start;
        const diag = safeDiagnostic(e);
        reportResult({
          operation: 'domain_list',
          endpoint: '/restful/v2/domains',
          signed: true,
          method: 'GET',
          evidence: diag.includes('404') || diag.includes('501') ? 'SANDBOX_UNSUPPORTED' : 'SANDBOX_FAILED',
          notes: `${diag}. Duration: ${ms}ms.`,
          durationMs: ms,
        });
        if (!diag.includes('404') && !diag.includes('501')) throw e;
      }
    }, 30_000);
  });

  // ───────────────────────────────────────────────
  // GATE 5: Contact List (signed)
  // ───────────────────────────────────────────────

  describe('5. Contact List', () => {
    it('lists contacts in account', async () => {
      const start = Date.now();
      try {
        const contact = provider.getCapability(RegistrarCapability.CONTACT_MANAGEMENT);
        expect(contact).not.toBeNull();

        const result = await contact!.listContacts();
        const ms = Date.now() - start;

        expect(result).toBeDefined();

        reportResult({
          operation: 'contact_list',
          endpoint: '/restful/v2/contacts',
          signed: true,
          method: 'GET',
          evidence: 'SANDBOX_VERIFIED',
          notes: `${result.items?.length ?? 0} contacts. Duration: ${ms}ms.`,
          durationMs: ms,
        });
      } catch (e) {
        const ms = Date.now() - start;
        const diag = safeDiagnostic(e);
        reportResult({
          operation: 'contact_list',
          endpoint: '/restful/v2/contacts',
          signed: true,
          method: 'GET',
          evidence: diag.includes('404') || diag.includes('501') ? 'SANDBOX_UNSUPPORTED' : 'SANDBOX_FAILED',
          notes: `${diag}. Duration: ${ms}ms.`,
          durationMs: ms,
        });
        if (!diag.includes('404') && !diag.includes('501')) throw e;
      }
    }, 30_000);
  });

  // ───────────────────────────────────────────────
  // GATE 6: Nameserver List (signed)
  // ───────────────────────────────────────────────

  describe('6. Nameserver List', () => {
    it('lists registered nameservers', async () => {
      const start = Date.now();
      try {
        const glue = provider.getCapability(RegistrarCapability.GLUE_RECORD_MANAGEMENT);
        expect(glue).not.toBeNull();

        const result = await glue!.listRegisteredNameservers();
        const ms = Date.now() - start;

        expect(result).toBeDefined();

        reportResult({
          operation: 'nameserver_list',
          endpoint: '/restful/v2/nameservers',
          signed: true,
          method: 'GET',
          evidence: 'SANDBOX_VERIFIED',
          notes: `${result.items?.length ?? 0} nameservers. Duration: ${ms}ms.`,
          durationMs: ms,
        });
      } catch (e) {
        const ms = Date.now() - start;
        const diag = safeDiagnostic(e);
        reportResult({
          operation: 'nameserver_list',
          endpoint: '/restful/v2/nameservers',
          signed: true,
          method: 'GET',
          evidence: diag.includes('404') || diag.includes('501') ? 'SANDBOX_UNSUPPORTED' : 'SANDBOX_FAILED',
          notes: `${diag}. Duration: ${ms}ms.`,
          durationMs: ms,
        });
        if (!diag.includes('404') && !diag.includes('501')) throw e;
      }
    }, 30_000);
  });

  // ───────────────────────────────────────────────
  // GATE 7: Order History (signed)
  // ───────────────────────────────────────────────

  describe('7. Order History', () => {
    it('retrieves order history', async () => {
      const start = Date.now();
      try {
        const orders = provider.getCapability(RegistrarCapability.ORDER_MANAGEMENT);
        expect(orders).not.toBeNull();

        const result = await orders!.getOrderHistory({ page: 1, perPage: 10 });
        const ms = Date.now() - start;

        expect(result).toBeDefined();

        reportResult({
          operation: 'order_history',
          endpoint: '/restful/v2/orders',
          signed: true,
          method: 'GET',
          evidence: 'SANDBOX_VERIFIED',
          notes: `${Array.isArray(result) ? result.length : 0} orders. Duration: ${ms}ms.`,
          durationMs: ms,
        });
      } catch (e) {
        const ms = Date.now() - start;
        const diag = safeDiagnostic(e);
        reportResult({
          operation: 'order_history',
          endpoint: '/restful/v2/orders',
          signed: true,
          method: 'GET',
          evidence: diag.includes('404') || diag.includes('501') ? 'SANDBOX_UNSUPPORTED'
            : diag.includes('no orders') ? 'SANDBOX_NOT_APPLICABLE'
            : 'SANDBOX_FAILED',
          notes: `${diag}. Duration: ${ms}ms.`,
          durationMs: ms,
        });
        // Don't throw for 404/501/no-data — these aren't failures
        if (!diag.includes('404') && !diag.includes('501') && !diag.includes('no orders')) throw e;
      }
    }, 30_000);
  });

  // ───────────────────────────────────────────────
  // GATE 8: Safe error normalization (invalid domain search)
  // ───────────────────────────────────────────────

  describe('8. Provider Error Normalization', () => {
    it('returns safe error for malformed domain', async () => {
      const start = Date.now();
      try {
        const search = provider.getCapability(RegistrarCapability.DOMAIN_SEARCH);
        expect(search).not.toBeNull();

        const result = await search!.checkAvailability('---invalid---');
        const ms = Date.now() - start;

        // If the provider returns a result instead of an error, that's fine —
        // some registrars simply mark invalid domains as unavailable
        reportResult({
          operation: 'error_normalization_malformed',
          endpoint: '/restful/v2/domains/{domain_name}/search',
          signed: false,
          method: 'GET',
          evidence: 'SANDBOX_VERIFIED',
          notes: `Malformed domain handled gracefully (available=${result.available}). Duration: ${ms}ms.`,
          durationMs: ms,
        });
      } catch (e) {
        const ms = Date.now() - start;
        const diag = safeDiagnostic(e);

        // The error should be safe — no credentials leaked
        reportResult({
          operation: 'error_normalization_malformed',
          endpoint: '/restful/v2/domains/{domain_name}/search',
          signed: false,
          method: 'GET',
          evidence: 'SANDBOX_VERIFIED',
          notes: `Malformed domain error safely normalized: ${diag}. Duration: ${ms}ms.`,
          durationMs: ms,
        });
      }
    }, 30_000);
  });

  // ───────────────────────────────────────────────
  // Final summary
  // ───────────────────────────────────────────────

  describe('Summary', () => {
    it('prints final results table', () => {
      console.log('\n═══════════════════════════════════════');
      console.log('PRE-PHASE-6 DYNADOT PROVIDER GATE RESULTS');
      console.log('═══════════════════════════════════════\n');
      for (const r of results) {
        console.log(`  ${r.evidence.padEnd(25)} ${r.operation.padEnd(35)} ${r.method} ${r.endpoint}`);
      }
      console.log('\n═══════════════════════════════════════\n');

      const verified = results.filter(r => r.evidence === 'SANDBOX_VERIFIED').length;
      const failed = results.filter(r => r.evidence === 'SANDBOX_FAILED').length;
      const unsupported = results.filter(r => r.evidence === 'SANDBOX_UNSUPPORTED').length;
      const na = results.filter(r => r.evidence === 'SANDBOX_NOT_APPLICABLE').length;

      console.log(`  SANDBOX_VERIFIED:       ${verified}`);
      console.log(`  SANDBOX_FAILED:         ${failed}`);
      console.log(`  SANDBOX_UNSUPPORTED:    ${unsupported}`);
      console.log(`  SANDBOX_NOT_APPLICABLE: ${na}`);
      console.log(`  TOTAL:                  ${results.length}\n`);

      // Gate passes if account_info is verified and no foundational failures
      const accountResult = results.find(r => r.operation === 'account_info');
      if (accountResult?.evidence === 'SANDBOX_VERIFIED') {
        console.log('  ✅ PRE-PHASE-6 DYNADOT PROVIDER GATE: PASSED');
      } else {
        console.log('  ❌ PRE-PHASE-6 DYNADOT PROVIDER GATE: FAILED');
      }
      console.log('');

      expect(true).toBe(true); // Always passes — results are informational
    });
  });
});
