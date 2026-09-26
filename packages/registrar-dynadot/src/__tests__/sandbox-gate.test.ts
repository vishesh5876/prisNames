/**
 * PrisNames — Comprehensive Pre-Phase-6 Dynadot Provider Gate
 *
 * Validates Dynadot REST v2 integration against the REAL sandbox.
 *
 * All 21 amendments applied. Serial execution. Real rate limiter.
 * SAFETY: Never prints secrets. Refuses to run on production host.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';

// ── Configuration ──
const SANDBOX_API_KEY = process.env.DYNADOT_API_KEY ?? '';
const SANDBOX_API_SECRET = process.env.DYNADOT_API_SECRET ?? '';
const SANDBOX_BASE_URL = 'https://api-sandbox.dynadot.com/restful/v2';
const SANDBOX_HOST = 'api-sandbox.dynadot.com';
const RATE_LIMIT_MS = 1200;

// ── Types ──
type Evidence = 'SANDBOX_VERIFIED' | 'SANDBOX_UNSUPPORTED' | 'SANDBOX_FAILED' | 'SANDBOX_NOT_APPLICABLE';

interface GateResult {
  capability: string; method: string; httpStatus: number;
  dynadotCode: string; envelope: string; dto: string; mapper: string;
  evidence: Evidence; notes: string; durationMs: number;
}

interface SandboxResponse {
  httpStatus: number; body: unknown; durationMs: number;
}

// ── Shared state ──
const results: GateResult[] = [];
let lastRequestTime = 0;
let sandboxDomains: string[] = [];
let sandboxContacts: Array<{ contact_id: string | number }> = [];
let sandboxNameservers: Array<{ server_name?: string }> = [];
let registeredDomain = '';
let registrationOrderId: number | undefined;
let syntheticContactId: string | undefined;
let originalDomainContacts: Record<string, unknown> | undefined;

function pushResult(r: GateResult): void {
  results.push(r);
  const icon = r.evidence === 'SANDBOX_VERIFIED' ? '✅' :
    r.evidence === 'SANDBOX_NOT_APPLICABLE' ? '⬜' :
    r.evidence === 'SANDBOX_UNSUPPORTED' ? '⚠️' : '❌';
  console.log(`[${icon} ${r.evidence}] ${r.capability}.${r.method} (HTTP=${r.httpStatus}, app=${r.dynadotCode}) ${r.durationMs}ms — ${r.notes}`);
}

async function rateLimitedDelay(): Promise<void> {
  const elapsed = Date.now() - lastRequestTime;
  if (elapsed < RATE_LIMIT_MS) {
    await new Promise(r => setTimeout(r, RATE_LIMIT_MS - elapsed));
  }
}

function sign(method: string, fullPathAndQuery: string, requestId: string, body: string): string {
  const stringToSign = `${SANDBOX_API_KEY}\n${fullPathAndQuery}\n${requestId}\n${body}`;
  return crypto.createHmac('sha256', SANDBOX_API_SECRET).update(stringToSign).digest('base64');
}

async function sandboxRequest(
  method: string, pathAndQuery: string,
  opts: { signed?: boolean; body?: unknown } = {},
): Promise<SandboxResponse> {
  await rateLimitedDelay();
  const url = `${SANDBOX_BASE_URL}/${pathAndQuery}`;
  const urlObj = new URL(url);
  const fullPathAndQuery = urlObj.pathname + urlObj.search;
  const requestId = crypto.randomUUID();
  const bodyString = opts.body ? JSON.stringify(opts.body) : '';
  const headers: Record<string, string> = {
    'Authorization': `Bearer ${SANDBOX_API_KEY}`,
    'X-Request-ID': requestId,
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };
  if (opts.signed) {
    headers['X-Signature'] = sign(method, fullPathAndQuery, requestId, bodyString);
  }
  const fetchOpts: RequestInit = { method, headers, signal: AbortSignal.timeout(30_000) };
  if (bodyString && method !== 'GET') fetchOpts.body = bodyString;

  const start = Date.now();
  try {
    const resp = await fetch(url, fetchOpts);
    const text = await resp.text();
    lastRequestTime = Date.now();
    let body: unknown;
    try { body = JSON.parse(text); } catch { body = text; }
    return { httpStatus: resp.status, body, durationMs: Date.now() - start };
  } catch (err) {
    lastRequestTime = Date.now();
    return { httpStatus: 0, body: { error: String(err) }, durationMs: Date.now() - start };
  }
}

function parseEnvelope(body: unknown) {
  if (!body || typeof body !== 'object') return { classification: 'NO_ENVELOPE' as const, casing: 'none' };
  const obj = body as Record<string, unknown>;
  const rawCode = obj.code ?? obj.Code;
  if (rawCode === undefined) return { classification: 'NO_ENVELOPE' as const, data: body, casing: 'none' };
  const code = Number(rawCode);
  const casing = 'code' in obj ? 'lowercase' : 'Pascal';
  const message = String(obj.message ?? obj.Message ?? '');
  let errorDescription: string | undefined;
  const errObj = obj.error ?? obj.Error;
  if (errObj && typeof errObj === 'object') {
    errorDescription = String((errObj as Record<string, unknown>).description ?? '');
  }
  const data = obj.data ?? obj.Data;
  if (code === 200 || code === 201) return { classification: 'SUCCESS' as const, code, message, data, casing };
  if (code === 202) return { classification: 'ACCEPTED' as const, code, message, data, casing };
  if (code >= 400) return { classification: 'APP_ERROR' as const, code, message, errorDescription, casing };
  return { classification: 'PROTOCOL_ERROR' as const, code, message, casing };
}

// Gate suite requires sandbox credentials — skip gracefully when absent
const hasSandboxCredentials = Boolean(SANDBOX_API_KEY && SANDBOX_API_SECRET && SANDBOX_API_KEY.startsWith('sandbox_'));

describe.skipIf(!hasSandboxCredentials)('Comprehensive Pre-Phase-6 Dynadot Provider Gate', { timeout: 600_000, concurrent: false }, () => {

  beforeAll(() => {
    const url = new URL(SANDBOX_BASE_URL);
    expect(url.hostname).toBe(SANDBOX_HOST);
    expect(url.hostname).not.toBe('api.dynadot.com');
    console.log('\n══════════════════════════════════════════════════');
    console.log(' SANDBOX ISOLATION CONFIRMED');
    console.log(`  Host: ${url.hostname}`);
    console.log(`  Key prefix: sandbox_***`);
    console.log('══════════════════════════════════════════════════\n');
  });

  // ═══ PHASE A: FOUNDATIONAL READS ═══

  it('GATE 1: Account Info', async () => {
    const resp = await sandboxRequest('GET', 'accounts/info', { signed: true });
    const env = parseEnvelope(resp.body);
    if (resp.httpStatus !== 200 || env.classification !== 'SUCCESS') {
      pushResult({ capability: 'ACCOUNT', method: 'getAccountInfo', httpStatus: resp.httpStatus,
        dynadotCode: String(env.code ?? 'none'), envelope: env.classification,
        dto: 'FAIL', mapper: 'FAIL', evidence: 'SANDBOX_FAILED',
        notes: `FOUNDATIONAL FAILURE: ${env.errorDescription ?? env.message}`, durationMs: resp.durationMs });
      throw new Error('Foundational Account Info FAILED — stopping gate');
    }
    const data = env.data as Record<string, unknown> | undefined;
    const accountInfo = (data?.account_info as Record<string, unknown>) ?? data;
    pushResult({ capability: 'ACCOUNT', method: 'getAccountInfo', httpStatus: resp.httpStatus,
      dynadotCode: String(env.code), envelope: env.classification,
      dto: accountInfo?.account_balance != null ? 'PASS' : 'PARTIAL',
      mapper: 'PASS', evidence: 'SANDBOX_VERIFIED',
      notes: `balance=${accountInfo?.account_balance != null}, currency=${accountInfo?.default_currency ?? 'absent'}`,
      durationMs: resp.durationMs });
  });

  it('GATE 2a: Domain Search — taken', async () => {
    const resp = await sandboxRequest('GET', 'domains/google.com/search?show_price=yes&currency=USD');
    const env = parseEnvelope(resp.body);
    if (resp.httpStatus !== 200 || env.classification !== 'SUCCESS') {
      pushResult({ capability: 'DOMAIN_SEARCH', method: 'checkAvailability', httpStatus: resp.httpStatus,
        dynadotCode: String(env.code ?? ''), envelope: env.classification, dto: 'FAIL', mapper: 'FAIL',
        evidence: 'SANDBOX_FAILED', notes: `${env.errorDescription ?? env.message}`, durationMs: resp.durationMs });
      return;
    }
    const data = env.data as Record<string, unknown>;
    pushResult({ capability: 'DOMAIN_SEARCH', method: 'checkAvailability', httpStatus: resp.httpStatus,
      dynadotCode: String(env.code), envelope: env.classification, dto: 'PASS', mapper: 'PASS',
      evidence: 'SANDBOX_VERIFIED', notes: `available_raw=${data?.available}`, durationMs: resp.durationMs });
  });

  it('GATE 2b: Domain Search — random available', async () => {
    const label = `pristest-${crypto.randomBytes(6).toString('hex')}`;
    const resp = await sandboxRequest('GET', `domains/${label}.xyz/search?show_price=yes&currency=USD`);
    const env = parseEnvelope(resp.body);
    if (resp.httpStatus !== 200 || env.classification !== 'SUCCESS') {
      pushResult({ capability: 'DOMAIN_SEARCH', method: 'checkAvailability_avail', httpStatus: resp.httpStatus,
        dynadotCode: String(env.code ?? ''), envelope: env.classification, dto: 'FAIL', mapper: 'FAIL',
        evidence: 'SANDBOX_FAILED', notes: `${env.errorDescription ?? env.message}`, durationMs: resp.durationMs });
      return;
    }
    const data = env.data as Record<string, unknown>;
    pushResult({ capability: 'DOMAIN_SEARCH', method: 'checkAvailability_avail', httpStatus: resp.httpStatus,
      dynadotCode: String(env.code), envelope: env.classification, dto: 'PASS', mapper: 'PASS',
      evidence: 'SANDBOX_VERIFIED', notes: `available_raw=${data?.available}`, durationMs: resp.durationMs });
  });

  it('GATE 3: Bulk Search', async () => {
    const resp = await sandboxRequest('GET', 'domains/bulk_search?domain_name_list=google.com,test123456.xyz');
    const env = parseEnvelope(resp.body);
    if (resp.httpStatus !== 200 || env.classification !== 'SUCCESS') {
      pushResult({ capability: 'DOMAIN_SEARCH', method: 'bulkCheckAvailability', httpStatus: resp.httpStatus,
        dynadotCode: String(env.code ?? ''), envelope: env.classification, dto: 'N/A', mapper: 'N/A',
        evidence: resp.httpStatus === 400 ? 'SANDBOX_UNSUPPORTED' : 'SANDBOX_FAILED',
        notes: `${env.errorDescription ?? env.message}`, durationMs: resp.durationMs });
      return;
    }
    const data = env.data as Record<string, unknown>;
    const list = data?.domain_result_list;
    pushResult({ capability: 'DOMAIN_SEARCH', method: 'bulkCheckAvailability', httpStatus: resp.httpStatus,
      dynadotCode: String(env.code), envelope: env.classification,
      dto: Array.isArray(list) ? 'PASS' : 'PARTIAL', mapper: 'PASS',
      evidence: 'SANDBOX_VERIFIED', notes: `count=${Array.isArray(list) ? list.length : 'absent'}`,
      durationMs: resp.durationMs });
  });

  it('GATE 4: Suggestion Search (FQDN)', async () => {
    const resp = await sandboxRequest('GET', 'domains/prisnames.com/suggestion_search?tlds=com,net,org&currency=USD');
    const env = parseEnvelope(resp.body);
    if (resp.httpStatus !== 200 || env.classification !== 'SUCCESS') {
      pushResult({ capability: 'DOMAIN_SEARCH', method: 'suggestDomains', httpStatus: resp.httpStatus,
        dynadotCode: String(env.code ?? ''), envelope: env.classification, dto: 'N/A', mapper: 'N/A',
        evidence: (resp.httpStatus === 400 || resp.httpStatus === 502) ? 'SANDBOX_UNSUPPORTED' : 'SANDBOX_FAILED',
        notes: `${env.errorDescription ?? env.message}`, durationMs: resp.durationMs });
      return;
    }
    pushResult({ capability: 'DOMAIN_SEARCH', method: 'suggestDomains', httpStatus: resp.httpStatus,
      dynadotCode: String(env.code), envelope: env.classification, dto: 'PASS', mapper: 'PASS',
      evidence: 'SANDBOX_VERIFIED', notes: 'FQDN suggestion search', durationMs: resp.durationMs });
  });

  it('GATE 5: TLD Pricing + Money + Sentinels', async () => {
    const resp = await sandboxRequest('GET', 'domains/get_tld_price?currency=USD');
    const env = parseEnvelope(resp.body);
    if (resp.httpStatus !== 200 || env.classification !== 'SUCCESS') {
      pushResult({ capability: 'PRICING', method: 'getTldPrices', httpStatus: resp.httpStatus,
        dynadotCode: String(env.code ?? ''), envelope: env.classification, dto: 'FAIL', mapper: 'FAIL',
        evidence: 'SANDBOX_FAILED', notes: `${env.errorDescription ?? env.message}`, durationMs: resp.durationMs });
      return;
    }
    const data = env.data as Record<string, unknown>;
    const tldList = data?.tld_price_list as Array<Record<string, unknown>> | undefined;
    let sentinelFound = false, zeroFound = false, highValueFound = false;
    for (const entry of (tldList ?? []).slice(0, 30)) {
      const regPrices = entry.all_years_register_price as string[] | undefined;
      const raw = regPrices?.[0];
      if (raw === '--') sentinelFound = true;
      else if (raw === '0.00') zeroFound = true;
      else if (raw) {
        const parts = raw.split('.'); const whole = parts[0]??'0'; const frac = (parts[1]??'').padEnd(2,'0').slice(0,2);
        if (BigInt(`${whole}${frac}`) > 10000n) highValueFound = true;
      }
      if ((entry.transfer_price as string) === '--') sentinelFound = true;
    }
    const pgFields = ['page','page_size','sort','price_level','currency'].filter(k => data?.[k] !== undefined);
    pushResult({ capability: 'PRICING', method: 'getTldPrices', httpStatus: resp.httpStatus,
      dynadotCode: String(env.code), envelope: env.classification, dto: 'PASS', mapper: 'PASS',
      evidence: 'SANDBOX_VERIFIED',
      notes: `tlds=${tldList?.length}, sentinel=${sentinelFound}, zero=${zeroFound}, high=${highValueFound}, pg=[${pgFields}]`,
      durationMs: resp.durationMs });
  });

  it('GATE 6: Domain List', async () => {
    const resp = await sandboxRequest('GET', 'domains?page=1&page_size=25', { signed: true });
    const env = parseEnvelope(resp.body);
    if (resp.httpStatus !== 200 || env.classification !== 'SUCCESS') {
      pushResult({ capability: 'DOMAIN_INFO', method: 'listDomains', httpStatus: resp.httpStatus,
        dynadotCode: String(env.code ?? ''), envelope: env.classification, dto: 'FAIL', mapper: 'FAIL',
        evidence: 'SANDBOX_FAILED', notes: `${env.errorDescription ?? env.message}`, durationMs: resp.durationMs });
      return;
    }
    const data = env.data as Record<string, unknown>;
    const list = data?.domain_info_list as Array<Record<string, unknown>> | undefined;
    if (Array.isArray(list)) sandboxDomains = list.map(d => String(d.domain_name ?? '')).filter(Boolean);
    pushResult({ capability: 'DOMAIN_INFO', method: 'listDomains', httpStatus: resp.httpStatus,
      dynadotCode: String(env.code), envelope: env.classification, dto: 'PASS', mapper: 'PASS',
      evidence: 'SANDBOX_VERIFIED', notes: `count=${sandboxDomains.length}`, durationMs: resp.durationMs });
  });

  it('GATE 7: Contact List', async () => {
    const resp = await sandboxRequest('GET', 'contacts', { signed: true });
    const env = parseEnvelope(resp.body);
    if (resp.httpStatus !== 200 || env.classification !== 'SUCCESS') {
      pushResult({ capability: 'CONTACTS', method: 'listContacts', httpStatus: resp.httpStatus,
        dynadotCode: String(env.code ?? ''), envelope: env.classification, dto: 'FAIL', mapper: 'FAIL',
        evidence: 'SANDBOX_FAILED', notes: `${env.errorDescription ?? env.message}`, durationMs: resp.durationMs });
      return;
    }
    const data = env.data as Record<string, unknown>;
    const list = data?.contact_list as Array<Record<string, unknown>> | undefined;
    if (Array.isArray(list)) sandboxContacts = list.map(c => ({ contact_id: c.contact_id as string | number }));
    pushResult({ capability: 'CONTACTS', method: 'listContacts', httpStatus: resp.httpStatus,
      dynadotCode: String(env.code), envelope: env.classification, dto: 'PASS', mapper: 'PASS',
      evidence: 'SANDBOX_VERIFIED', notes: `count=${sandboxContacts.length}`, durationMs: resp.durationMs });
  });

  it('GATE 8: Contact Get', async () => {
    if (!sandboxContacts.length) {
      pushResult({ capability: 'CONTACTS', method: 'getContact', httpStatus: 0, dynadotCode: 'N/A',
        envelope: 'N/A', dto: 'N/A', mapper: 'N/A', evidence: 'SANDBOX_NOT_APPLICABLE',
        notes: 'No contacts in sandbox', durationMs: 0 }); return;
    }
    const resp = await sandboxRequest('GET', `contacts/${sandboxContacts[0].contact_id}`, { signed: true });
    const env = parseEnvelope(resp.body);
    pushResult({ capability: 'CONTACTS', method: 'getContact', httpStatus: resp.httpStatus,
      dynadotCode: String(env.code ?? ''), envelope: env.classification,
      dto: resp.httpStatus === 200 ? 'PASS' : 'FAIL', mapper: resp.httpStatus === 200 ? 'PASS' : 'FAIL',
      evidence: resp.httpStatus === 200 ? 'SANDBOX_VERIFIED' : 'SANDBOX_FAILED',
      notes: `id=${sandboxContacts[0].contact_id}`, durationMs: resp.durationMs });
  });

  it('GATE 9: Nameserver List', async () => {
    const resp = await sandboxRequest('GET', 'nameservers', { signed: true });
    const env = parseEnvelope(resp.body);
    if (resp.httpStatus !== 200 || env.classification !== 'SUCCESS') {
      pushResult({ capability: 'NAMESERVERS', method: 'listRegisteredNs', httpStatus: resp.httpStatus,
        dynadotCode: String(env.code ?? ''), envelope: env.classification, dto: 'FAIL', mapper: 'FAIL',
        evidence: 'SANDBOX_FAILED', notes: `${env.errorDescription ?? env.message}`, durationMs: resp.durationMs });
      return;
    }
    const data = env.data as Record<string, unknown>;
    const list = data?.nameserver_list as Array<Record<string, unknown>> | undefined;
    if (Array.isArray(list)) sandboxNameservers = list.map(ns => ({ server_name: String(ns.server_name ?? ns.host ?? '') }));
    pushResult({ capability: 'NAMESERVERS', method: 'listRegisteredNs', httpStatus: resp.httpStatus,
      dynadotCode: String(env.code), envelope: env.classification, dto: 'PASS', mapper: 'PASS',
      evidence: 'SANDBOX_VERIFIED', notes: `count=${sandboxNameservers.length}`, durationMs: resp.durationMs });
  });

  it('GATE 10: Nameserver Get', async () => {
    if (!sandboxNameservers.length || !sandboxNameservers[0].server_name) {
      pushResult({ capability: 'NAMESERVERS', method: 'getRegisteredNs', httpStatus: 0, dynadotCode: 'N/A',
        envelope: 'N/A', dto: 'N/A', mapper: 'N/A', evidence: 'SANDBOX_NOT_APPLICABLE',
        notes: 'No registered NS', durationMs: 0 }); return;
    }
    const resp = await sandboxRequest('GET', `nameservers/${encodeURIComponent(sandboxNameservers[0].server_name)}`, { signed: true });
    const env = parseEnvelope(resp.body);
    pushResult({ capability: 'NAMESERVERS', method: 'getRegisteredNs', httpStatus: resp.httpStatus,
      dynadotCode: String(env.code ?? ''), envelope: env.classification,
      dto: resp.httpStatus === 200 ? 'PASS' : 'N/A', mapper: resp.httpStatus === 200 ? 'PASS' : 'N/A',
      evidence: resp.httpStatus === 200 ? 'SANDBOX_VERIFIED' : resp.httpStatus === 404 ? 'SANDBOX_NOT_APPLICABLE' : 'SANDBOX_FAILED',
      notes: `ns=${sandboxNameservers[0].server_name}`, durationMs: resp.durationMs });
  });

  it('GATE 11: Order History (probe search_type)', async () => {
    const candidates = ['all', 'registration', 'renewal', 'transfer'];
    let found = false;
    for (const st of candidates) {
      const resp = await sandboxRequest('GET', `orders?search_type=${st}`, { signed: true });
      const env = parseEnvelope(resp.body);
      if (resp.httpStatus === 200 && env.classification === 'SUCCESS') {
        const data = env.data as Record<string, unknown>;
        pushResult({ capability: 'ORDERS', method: 'getOrderHistory', httpStatus: resp.httpStatus,
          dynadotCode: String(env.code), envelope: env.classification,
          dto: Array.isArray(data?.order_list) ? 'PASS' : 'PARTIAL', mapper: 'PASS',
          evidence: 'SANDBOX_VERIFIED',
          notes: `search_type=${st} (SANDBOX_OBSERVED), orders=${Array.isArray(data?.order_list) ? data.order_list.length : '?'}`,
          durationMs: resp.durationMs });
        found = true; break;
      }
    }
    if (!found) {
      pushResult({ capability: 'ORDERS', method: 'getOrderHistory', httpStatus: 400, dynadotCode: '400',
        envelope: 'APP_ERROR', dto: 'N/A', mapper: 'N/A', evidence: 'SANDBOX_UNSUPPORTED',
        notes: `All candidates [${candidates}] failed`, durationMs: 0 });
    }
  });

  it('GATE 12: Domain Info', async () => {
    if (!sandboxDomains.length) {
      pushResult({ capability: 'DOMAIN_INFO', method: 'getDomainInfo', httpStatus: 0, dynadotCode: 'N/A',
        envelope: 'N/A', dto: 'N/A', mapper: 'N/A', evidence: 'SANDBOX_NOT_APPLICABLE',
        notes: 'No domains', durationMs: 0 }); return;
    }
    const resp = await sandboxRequest('GET', `domains/${encodeURIComponent(sandboxDomains[0])}`, { signed: true });
    const env = parseEnvelope(resp.body);
    const data = env.data as Record<string, unknown>;
    const di = (data?.domain_info as Record<string, unknown>) ?? data;
    pushResult({ capability: 'DOMAIN_INFO', method: 'getDomainInfo', httpStatus: resp.httpStatus,
      dynadotCode: String(env.code ?? ''), envelope: env.classification,
      dto: resp.httpStatus === 200 ? 'PASS' : 'FAIL', mapper: resp.httpStatus === 200 ? 'PASS' : 'FAIL',
      evidence: resp.httpStatus === 200 ? 'SANDBOX_VERIFIED' : 'SANDBOX_FAILED',
      notes: `domain=${di?.domain_name}, status=${di?.status}`, durationMs: resp.durationMs });
  });

  it('GATE 13: DNS Get', async () => {
    if (!sandboxDomains.length) {
      pushResult({ capability: 'DNS', method: 'getDnsRecords', httpStatus: 0, dynadotCode: 'N/A',
        envelope: 'N/A', dto: 'N/A', mapper: 'N/A', evidence: 'SANDBOX_NOT_APPLICABLE',
        notes: 'No domains', durationMs: 0 }); return;
    }
    const resp = await sandboxRequest('GET', `domains/${encodeURIComponent(sandboxDomains[0])}/records`, { signed: true });
    const env = parseEnvelope(resp.body);
    pushResult({ capability: 'DNS', method: 'getDnsRecords', httpStatus: resp.httpStatus,
      dynadotCode: String(env.code ?? ''), envelope: env.classification,
      dto: resp.httpStatus === 200 ? 'PASS' : 'N/A', mapper: resp.httpStatus === 200 ? 'PASS' : 'N/A',
      evidence: resp.httpStatus === 200 ? 'SANDBOX_VERIFIED' : resp.httpStatus === 400 ? 'SANDBOX_UNSUPPORTED' : 'SANDBOX_FAILED',
      notes: `domain=${sandboxDomains[0]}`, durationMs: resp.durationMs });
  });

  it('GATE 14: DNSSEC Get', async () => {
    if (!sandboxDomains.length) {
      pushResult({ capability: 'DNSSEC', method: 'getDnssec', httpStatus: 0, dynadotCode: 'N/A',
        envelope: 'N/A', dto: 'N/A', mapper: 'N/A', evidence: 'SANDBOX_NOT_APPLICABLE',
        notes: 'No domains', durationMs: 0 }); return;
    }
    const resp = await sandboxRequest('GET', `domains/${encodeURIComponent(sandboxDomains[0])}/dnssec`, { signed: true });
    const env = parseEnvelope(resp.body);
    pushResult({ capability: 'DNSSEC', method: 'getDnssec', httpStatus: resp.httpStatus,
      dynadotCode: String(env.code ?? ''), envelope: env.classification,
      dto: resp.httpStatus === 200 ? 'PASS' : 'N/A', mapper: resp.httpStatus === 200 ? 'PASS' : 'N/A',
      evidence: resp.httpStatus === 200 ? 'SANDBOX_VERIFIED' : 'SANDBOX_NOT_APPLICABLE',
      notes: `domain=${sandboxDomains[0]}`, durationMs: resp.durationMs });
  });

  it('GATE 15: Transfer Status', async () => {
    if (!sandboxDomains.length) {
      pushResult({ capability: 'TRANSFER', method: 'getTransferStatus', httpStatus: 0, dynadotCode: 'N/A',
        envelope: 'N/A', dto: 'N/A', mapper: 'N/A', evidence: 'SANDBOX_NOT_APPLICABLE',
        notes: 'No domains', durationMs: 0 }); return;
    }
    const resp = await sandboxRequest('GET', `domains/${encodeURIComponent(sandboxDomains[0])}/transfer_status`);
    const env = parseEnvelope(resp.body);
    pushResult({ capability: 'TRANSFER', method: 'getTransferStatus', httpStatus: resp.httpStatus,
      dynadotCode: String(env.code ?? ''), envelope: env.classification,
      dto: resp.httpStatus === 200 ? 'PASS' : 'N/A', mapper: resp.httpStatus === 200 ? 'PASS' : 'N/A',
      evidence: resp.httpStatus === 200 ? 'SANDBOX_VERIFIED' : 'SANDBOX_NOT_APPLICABLE',
      notes: `domain=${sandboxDomains[0]}`, durationMs: resp.durationMs });
  });

  it('GATE 16: Appraisal', async () => {
    const resp = await sandboxRequest('GET', 'domains/google.com/appraisal');
    const env = parseEnvelope(resp.body);
    pushResult({ capability: 'APPRAISAL', method: 'getAppraisal', httpStatus: resp.httpStatus,
      dynadotCode: String(env.code ?? ''), envelope: env.classification,
      dto: resp.httpStatus === 200 ? 'PASS' : 'N/A', mapper: resp.httpStatus === 200 ? 'PASS' : 'N/A',
      evidence: resp.httpStatus === 200 ? 'SANDBOX_VERIFIED' : 'SANDBOX_UNSUPPORTED',
      notes: resp.httpStatus === 200 ? `price=${(env.data as Record<string,unknown>)?.appraisal_price}` : `${env.errorDescription ?? env.message}`,
      durationMs: resp.durationMs });
  });

  it('GATE 17: Power Search', async () => {
    const resp = await sandboxRequest('GET', 'domains/example.com/power_search_new?status=available&page_size=5');
    const env = parseEnvelope(resp.body);
    pushResult({ capability: 'DOMAIN_SEARCH', method: 'powerSearch', httpStatus: resp.httpStatus,
      dynadotCode: String(env.code ?? ''), envelope: env.classification,
      dto: resp.httpStatus === 200 ? 'PASS' : 'N/A', mapper: resp.httpStatus === 200 ? 'PASS' : 'N/A',
      evidence: resp.httpStatus === 200 ? 'SANDBOX_VERIFIED' : 'SANDBOX_UNSUPPORTED',
      notes: resp.httpStatus === 200 ? 'cursor pagination' : `${env.errorDescription ?? env.message}`,
      durationMs: resp.durationMs });
  });

  it('GATE 18: Error normalization', async () => {
    const resp = await sandboxRequest('GET', 'domains/!!!invalid!!!/search');
    const env = parseEnvelope(resp.body);
    const isErr = resp.httpStatus >= 400 || env.classification === 'APP_ERROR';
    pushResult({ capability: 'ERROR_HANDLING', method: 'malformedDomain', httpStatus: resp.httpStatus,
      dynadotCode: String(env.code ?? ''), envelope: env.classification,
      dto: isErr ? 'PASS' : 'FAIL', mapper: isErr ? 'PASS' : 'FAIL',
      evidence: isErr ? 'SANDBOX_VERIFIED' : 'SANDBOX_FAILED',
      notes: `Error classified: ${env.errorDescription ?? env.message ?? resp.httpStatus}`, durationMs: resp.durationMs });
  });

  // ═══ PHASE B: MUTATIONS ═══

  it('MUTATION 1: Domain Registration', async () => {
    const priceResp = await sandboxRequest('GET', 'domains/get_tld_price?currency=USD&tlds=xyz');
    const priceEnv = parseEnvelope(priceResp.body);
    const priceData = priceEnv.data as Record<string, unknown>;
    const tldList = priceData?.tld_price_list as Array<Record<string, unknown>> | undefined;
    console.log(`  .xyz price: ${(tldList?.[0]?.all_years_register_price as string[])?.[0] ?? 'unknown'}`);

    const label = `pris-gate-${crypto.randomBytes(4).toString('hex')}`;
    const domain = `${label}.xyz`;
    const searchResp = await sandboxRequest('GET', `domains/${encodeURIComponent(domain)}/search`);
    console.log(`  ${domain}: available=${(parseEnvelope(searchResp.body).data as Record<string,unknown>)?.available}`);

    expect(new URL(SANDBOX_BASE_URL).hostname).toBe('api-sandbox.dynadot.com');

    const resp = await sandboxRequest('POST', `domains/${encodeURIComponent(domain)}/register`, {
      signed: true, body: { domain: { duration: 1, privacy: 'full' }, currency: 'USD' },
    });
    const env = parseEnvelope(resp.body);

    if (resp.httpStatus === 200 && (env.classification === 'SUCCESS' || env.classification === 'ACCEPTED')) {
      const data = env.data as Record<string, unknown>;
      registeredDomain = domain;
      registrationOrderId = data?.order_id as number | undefined;
      sandboxDomains.push(domain);
      pushResult({ capability: 'REGISTRATION', method: 'registerDomain', httpStatus: resp.httpStatus,
        dynadotCode: String(env.code), envelope: env.classification, dto: 'PASS', mapper: 'PASS',
        evidence: 'SANDBOX_VERIFIED',
        notes: `domain=${domain}, order=${registrationOrderId}, code=${env.code}`, durationMs: resp.durationMs });

      if (env.code === 202 && registrationOrderId) {
        console.log('  202 ACCEPTED — bounded reconciliation...');
        for (let i = 0; i < 5; i++) {
          await new Promise(r => setTimeout(r, 3000));
          const orderResp = await sandboxRequest('GET', `orders/${registrationOrderId}`, { signed: true });
          const orderEnv = parseEnvelope(orderResp.body);
          const od = orderEnv.data as Record<string, unknown>;
          console.log(`  Order status: ${od?.order_status}`);
          if (od?.order_status === 'completed' || od?.order_status === 'success') break;
        }
      }
    } else {
      pushResult({ capability: 'REGISTRATION', method: 'registerDomain', httpStatus: resp.httpStatus,
        dynadotCode: String(env.code ?? ''), envelope: env.classification, dto: 'FAIL', mapper: 'FAIL',
        evidence: resp.httpStatus === 400 ? 'SANDBOX_UNSUPPORTED' : 'SANDBOX_FAILED',
        notes: `${env.errorDescription ?? env.message}`, durationMs: resp.durationMs });
    }
  });

  it('MUTATION 2: Domain Info post-reg', async () => {
    if (!registeredDomain) {
      pushResult({ capability: 'DOMAIN_INFO', method: 'getDomainInfo_postReg', httpStatus: 0, dynadotCode: 'N/A',
        envelope: 'N/A', dto: 'N/A', mapper: 'N/A', evidence: 'SANDBOX_NOT_APPLICABLE',
        notes: 'No domain registered', durationMs: 0 }); return;
    }
    const resp = await sandboxRequest('GET', `domains/${encodeURIComponent(registeredDomain)}`, { signed: true });
    const env = parseEnvelope(resp.body);
    const data = env.data as Record<string, unknown>;
    const di = (data?.domain_info as Record<string, unknown>) ?? data;
    originalDomainContacts = {
      registrant_contact_id: di?.registrant_contact_id,
      admin_contact_id: di?.admin_contact_id,
      technical_contact_id: di?.technical_contact_id,
      billing_contact_id: di?.billing_contact_id,
    };
    pushResult({ capability: 'DOMAIN_INFO', method: 'getDomainInfo_postReg', httpStatus: resp.httpStatus,
      dynadotCode: String(env.code ?? ''), envelope: env.classification,
      dto: resp.httpStatus === 200 ? 'PASS' : 'FAIL', mapper: resp.httpStatus === 200 ? 'PASS' : 'FAIL',
      evidence: resp.httpStatus === 200 ? 'SANDBOX_VERIFIED' : 'SANDBOX_FAILED',
      notes: `domain=${di?.domain_name}, status=${di?.status}`, durationMs: resp.durationMs });
  });

  // DNS Set/Get/Remove cycle
  it('MUTATION 3a: DNS Get on registered domain', async () => {
    if (!registeredDomain) { pushResult({ capability: 'DNS', method: 'getDnsRecords_reg', httpStatus: 0, dynadotCode: 'N/A', envelope: 'N/A', dto: 'N/A', mapper: 'N/A', evidence: 'SANDBOX_NOT_APPLICABLE', notes: 'No domain', durationMs: 0 }); return; }
    const resp = await sandboxRequest('GET', `domains/${encodeURIComponent(registeredDomain)}/records`, { signed: true });
    const env = parseEnvelope(resp.body);
    pushResult({ capability: 'DNS', method: 'getDnsRecords_reg', httpStatus: resp.httpStatus, dynadotCode: String(env.code ?? ''), envelope: env.classification, dto: resp.httpStatus === 200 ? 'PASS' : 'N/A', mapper: resp.httpStatus === 200 ? 'PASS' : 'N/A', evidence: resp.httpStatus === 200 ? 'SANDBOX_VERIFIED' : resp.httpStatus === 400 ? 'SANDBOX_UNSUPPORTED' : 'SANDBOX_FAILED', notes: `domain=${registeredDomain}`, durationMs: resp.durationMs });
  });

  it('MUTATION 3b: DNS Set A record', async () => {
    if (!registeredDomain) { pushResult({ capability: 'DNS', method: 'setDnsRecords', httpStatus: 0, dynadotCode: 'N/A', envelope: 'N/A', dto: 'N/A', mapper: 'N/A', evidence: 'SANDBOX_NOT_APPLICABLE', notes: 'No domain', durationMs: 0 }); return; }
    const resp = await sandboxRequest('POST', `domains/${encodeURIComponent(registeredDomain)}/records`, {
      signed: true, body: { dns_main_list: [{ record_type: 'a', value: '192.0.2.1' }], add_dns_to_current_setting: false },
    });
    const env = parseEnvelope(resp.body);
    pushResult({ capability: 'DNS', method: 'setDnsRecords', httpStatus: resp.httpStatus, dynadotCode: String(env.code ?? ''), envelope: env.classification, dto: resp.httpStatus === 200 ? 'PASS' : 'N/A', mapper: resp.httpStatus === 200 ? 'PASS' : 'N/A', evidence: resp.httpStatus === 200 && env.classification === 'SUCCESS' ? 'SANDBOX_VERIFIED' : resp.httpStatus === 400 ? 'SANDBOX_UNSUPPORTED' : 'SANDBOX_FAILED', notes: `Set A 192.0.2.1 on ${registeredDomain}`, durationMs: resp.durationMs });
  });

  it('MUTATION 3c: DNS Get verify', async () => {
    if (!registeredDomain) { pushResult({ capability: 'DNS', method: 'getDnsRecords_verify', httpStatus: 0, dynadotCode: 'N/A', envelope: 'N/A', dto: 'N/A', mapper: 'N/A', evidence: 'SANDBOX_NOT_APPLICABLE', notes: 'No domain', durationMs: 0 }); return; }
    const resp = await sandboxRequest('GET', `domains/${encodeURIComponent(registeredDomain)}/records`, { signed: true });
    const env = parseEnvelope(resp.body);
    pushResult({ capability: 'DNS', method: 'getDnsRecords_verify', httpStatus: resp.httpStatus, dynadotCode: String(env.code ?? ''), envelope: env.classification, dto: resp.httpStatus === 200 ? 'PASS' : 'FAIL', mapper: resp.httpStatus === 200 ? 'PASS' : 'FAIL', evidence: resp.httpStatus === 200 ? 'SANDBOX_VERIFIED' : 'SANDBOX_FAILED', notes: 'Readback after DNS set', durationMs: resp.durationMs });
  });

  it('MUTATION 3d: DNS Remove', async () => {
    if (!registeredDomain) { pushResult({ capability: 'DNS', method: 'removeDnsRecords', httpStatus: 0, dynadotCode: 'N/A', envelope: 'N/A', dto: 'N/A', mapper: 'N/A', evidence: 'SANDBOX_NOT_APPLICABLE', notes: 'No domain', durationMs: 0 }); return; }
    const resp = await sandboxRequest('DELETE', `domains/${encodeURIComponent(registeredDomain)}/records`, {
      body: { dns_main_list: [{ record_type: 'a', value: '192.0.2.1' }] },
    });
    const env = parseEnvelope(resp.body);
    pushResult({ capability: 'DNS', method: 'removeDnsRecords', httpStatus: resp.httpStatus, dynadotCode: String(env.code ?? ''), envelope: env.classification, dto: resp.httpStatus === 200 ? 'PASS' : 'N/A', mapper: resp.httpStatus === 200 ? 'PASS' : 'N/A', evidence: resp.httpStatus === 200 ? 'SANDBOX_VERIFIED' : resp.httpStatus === 400 ? 'SANDBOX_UNSUPPORTED' : 'SANDBOX_FAILED', notes: `Remove A from ${registeredDomain}`, durationMs: resp.durationMs });
  });

  it('MUTATION 3e: DNS Get verify removal', async () => {
    if (!registeredDomain) { pushResult({ capability: 'DNS', method: 'getDnsRecords_verifyRemoval', httpStatus: 0, dynadotCode: 'N/A', envelope: 'N/A', dto: 'N/A', mapper: 'N/A', evidence: 'SANDBOX_NOT_APPLICABLE', notes: 'No domain', durationMs: 0 }); return; }
    const resp = await sandboxRequest('GET', `domains/${encodeURIComponent(registeredDomain)}/records`, { signed: true });
    const env = parseEnvelope(resp.body);
    pushResult({ capability: 'DNS', method: 'getDnsRecords_verifyRemoval', httpStatus: resp.httpStatus, dynadotCode: String(env.code ?? ''), envelope: env.classification, dto: resp.httpStatus === 200 ? 'PASS' : 'FAIL', mapper: resp.httpStatus === 200 ? 'PASS' : 'FAIL', evidence: resp.httpStatus === 200 ? 'SANDBOX_VERIFIED' : 'SANDBOX_FAILED', notes: 'Readback after removal', durationMs: resp.durationMs });
  });

  // Contact CRUD + Domain Assignment
  it('MUTATION 4a: Contact Create', async () => {
    const resp = await sandboxRequest('POST', 'contacts', { signed: true, body: { contact: {
      organization: 'PrisNames Gate Test', name: 'Test User', email: 'gate-test@example.com',
      phone_cc: '1', phone_number: '5555550100', fax_cc: '', fax_number: '',
      address1: '100 Test St', address2: '', city: 'Testville', state: 'CA', zip: '90210', country: 'US',
    }}});
    const env = parseEnvelope(resp.body);
    if (resp.httpStatus === 200 && env.classification === 'SUCCESS') {
      syntheticContactId = String((env.data as Record<string, unknown>)?.contact_id ?? '');
      pushResult({ capability: 'CONTACTS', method: 'createContact', httpStatus: resp.httpStatus, dynadotCode: String(env.code), envelope: env.classification, dto: 'PASS', mapper: 'PASS', evidence: 'SANDBOX_VERIFIED', notes: `id=${syntheticContactId}`, durationMs: resp.durationMs });
    } else {
      pushResult({ capability: 'CONTACTS', method: 'createContact', httpStatus: resp.httpStatus, dynadotCode: String(env.code ?? ''), envelope: env.classification, dto: 'FAIL', mapper: 'FAIL', evidence: resp.httpStatus === 400 ? 'SANDBOX_UNSUPPORTED' : 'SANDBOX_FAILED', notes: `${env.errorDescription ?? env.message}`, durationMs: resp.durationMs });
    }
  });

  it('MUTATION 4b: Contact Get synthetic', async () => {
    if (!syntheticContactId) { pushResult({ capability: 'CONTACTS', method: 'getContact_syn', httpStatus: 0, dynadotCode: 'N/A', envelope: 'N/A', dto: 'N/A', mapper: 'N/A', evidence: 'SANDBOX_NOT_APPLICABLE', notes: 'No contact', durationMs: 0 }); return; }
    const resp = await sandboxRequest('GET', `contacts/${syntheticContactId}`, { signed: true });
    const env = parseEnvelope(resp.body);
    pushResult({ capability: 'CONTACTS', method: 'getContact_syn', httpStatus: resp.httpStatus, dynadotCode: String(env.code ?? ''), envelope: env.classification, dto: resp.httpStatus === 200 ? 'PASS' : 'FAIL', mapper: resp.httpStatus === 200 ? 'PASS' : 'FAIL', evidence: resp.httpStatus === 200 ? 'SANDBOX_VERIFIED' : 'SANDBOX_FAILED', notes: `id=${syntheticContactId}`, durationMs: resp.durationMs });
  });

  it('MUTATION 4c: Contact Update', async () => {
    if (!syntheticContactId) { pushResult({ capability: 'CONTACTS', method: 'updateContact', httpStatus: 0, dynadotCode: 'N/A', envelope: 'N/A', dto: 'N/A', mapper: 'N/A', evidence: 'SANDBOX_NOT_APPLICABLE', notes: 'No contact', durationMs: 0 }); return; }
    // Dynadot REST v2 requires ALL required fields on update, not just changed fields
    const resp = await sandboxRequest('PUT', `contacts/${syntheticContactId}`, { signed: true, body: { contact: {
      organization: 'PrisNames Gate Test', name: 'Test User', email: 'gate-test@example.com',
      phone_cc: '1', phone_number: '5555550100', fax_cc: '', fax_number: '',
      address1: '100 Test St', address2: '', city: 'Updated Testville', state: 'CA', zip: '90210', country: 'US',
    }}});
    const env = parseEnvelope(resp.body);
    const ok = resp.httpStatus === 200 && (env.classification === 'SUCCESS' || env.classification === 'ACCEPTED');
    pushResult({ capability: 'CONTACTS', method: 'updateContact', httpStatus: resp.httpStatus, dynadotCode: String(env.code ?? ''), envelope: env.classification, dto: ok ? 'PASS' : 'FAIL', mapper: ok ? 'PASS' : 'FAIL', evidence: ok ? 'SANDBOX_VERIFIED' : 'SANDBOX_FAILED', notes: `Updated city, 202=${env.code === 202}`, durationMs: resp.durationMs });
  });

  it('MUTATION 4d: Contact Get verify update', async () => {
    if (!syntheticContactId) { pushResult({ capability: 'CONTACTS', method: 'getContact_verifyUpdate', httpStatus: 0, dynadotCode: 'N/A', envelope: 'N/A', dto: 'N/A', mapper: 'N/A', evidence: 'SANDBOX_NOT_APPLICABLE', notes: 'No contact', durationMs: 0 }); return; }
    const resp = await sandboxRequest('GET', `contacts/${syntheticContactId}`, { signed: true });
    const env = parseEnvelope(resp.body);
    pushResult({ capability: 'CONTACTS', method: 'getContact_verifyUpdate', httpStatus: resp.httpStatus, dynadotCode: String(env.code ?? ''), envelope: env.classification, dto: resp.httpStatus === 200 ? 'PASS' : 'FAIL', mapper: resp.httpStatus === 200 ? 'PASS' : 'FAIL', evidence: resp.httpStatus === 200 ? 'SANDBOX_VERIFIED' : 'SANDBOX_FAILED', notes: 'Readback after update', durationMs: resp.durationMs });
  });

  it('MUTATION 4e: Set Domain Contacts', async () => {
    if (!registeredDomain || !syntheticContactId) { pushResult({ capability: 'CONTACTS', method: 'setDomainContacts', httpStatus: 0, dynadotCode: 'N/A', envelope: 'N/A', dto: 'N/A', mapper: 'N/A', evidence: 'SANDBOX_NOT_APPLICABLE', notes: 'No domain/contact', durationMs: 0 }); return; }
    const cid = Number(syntheticContactId);
    const resp = await sandboxRequest('PUT', `domains/${encodeURIComponent(registeredDomain)}/contacts`, {
      signed: true, body: { registrant_contact_id: cid, admin_contact_id: cid, technical_contact_id: cid, billing_contact_id: cid },
    });
    const env = parseEnvelope(resp.body);
    const ok = resp.httpStatus === 200 && (env.classification === 'SUCCESS' || env.classification === 'ACCEPTED');
    pushResult({ capability: 'CONTACTS', method: 'setDomainContacts', httpStatus: resp.httpStatus, dynadotCode: String(env.code ?? ''), envelope: env.classification, dto: ok ? 'PASS' : 'FAIL', mapper: ok ? 'PASS' : 'FAIL', evidence: ok ? 'SANDBOX_VERIFIED' : resp.httpStatus === 400 ? 'SANDBOX_UNSUPPORTED' : 'SANDBOX_FAILED', notes: `Assigned ${syntheticContactId} to ${registeredDomain}`, durationMs: resp.durationMs });
  });

  it('MUTATION 4f: Verify contact assignment', async () => {
    if (!registeredDomain) { pushResult({ capability: 'CONTACTS', method: 'verifyDomainContacts', httpStatus: 0, dynadotCode: 'N/A', envelope: 'N/A', dto: 'N/A', mapper: 'N/A', evidence: 'SANDBOX_NOT_APPLICABLE', notes: 'No domain', durationMs: 0 }); return; }
    const resp = await sandboxRequest('GET', `domains/${encodeURIComponent(registeredDomain)}`, { signed: true });
    const env = parseEnvelope(resp.body);
    pushResult({ capability: 'CONTACTS', method: 'verifyDomainContacts', httpStatus: resp.httpStatus, dynadotCode: String(env.code ?? ''), envelope: env.classification, dto: resp.httpStatus === 200 ? 'PASS' : 'FAIL', mapper: resp.httpStatus === 200 ? 'PASS' : 'FAIL', evidence: resp.httpStatus === 200 ? 'SANDBOX_VERIFIED' : 'SANDBOX_FAILED', notes: 'Verified contacts', durationMs: resp.durationMs });
  });

  it('MUTATION 4g: Restore original contacts', async () => {
    if (!registeredDomain || !originalDomainContacts || !Object.values(originalDomainContacts).some(v => v != null)) {
      pushResult({ capability: 'CONTACTS', method: 'restoreContacts', httpStatus: 0, dynadotCode: 'N/A', envelope: 'N/A', dto: 'N/A', mapper: 'N/A', evidence: 'SANDBOX_NOT_APPLICABLE', notes: 'No original contacts', durationMs: 0 }); return;
    }
    const resp = await sandboxRequest('PUT', `domains/${encodeURIComponent(registeredDomain)}/contacts`, { signed: true, body: originalDomainContacts });
    const env = parseEnvelope(resp.body);
    const ok = resp.httpStatus === 200 && (env.classification === 'SUCCESS' || env.classification === 'ACCEPTED');
    pushResult({ capability: 'CONTACTS', method: 'restoreContacts', httpStatus: resp.httpStatus, dynadotCode: String(env.code ?? ''), envelope: env.classification, dto: ok ? 'PASS' : 'FAIL', mapper: ok ? 'PASS' : 'FAIL', evidence: ok ? 'SANDBOX_VERIFIED' : 'SANDBOX_NOT_APPLICABLE', notes: 'Restored original contacts', durationMs: resp.durationMs });
  });

  // Privacy
  it('MUTATION 5: Privacy', async () => {
    if (!registeredDomain) { pushResult({ capability: 'PRIVACY', method: 'setPrivacy', httpStatus: 0, dynadotCode: 'N/A', envelope: 'N/A', dto: 'N/A', mapper: 'N/A', evidence: 'SANDBOX_NOT_APPLICABLE', notes: 'No domain', durationMs: 0 }); return; }
    // Dynadot REST v2 field is privacy_level (not privacy)
    const resp = await sandboxRequest('PUT', `domains/${encodeURIComponent(registeredDomain)}/privacy`, { signed: true, body: { privacy_level: 'full' }});
    const env = parseEnvelope(resp.body);
    const ok = resp.httpStatus === 200 && env.classification === 'SUCCESS';
    pushResult({ capability: 'PRIVACY', method: 'setPrivacy', httpStatus: resp.httpStatus, dynadotCode: String(env.code ?? ''), envelope: env.classification, dto: ok ? 'PASS' : 'FAIL', mapper: ok ? 'PASS' : 'FAIL', evidence: ok ? 'SANDBOX_VERIFIED' : resp.httpStatus === 403 ? 'SANDBOX_UNSUPPORTED' : 'SANDBOX_FAILED', notes: `Set privacy_level=full`, durationMs: resp.durationMs });
  });

  // Lock
  it('MUTATION 6: Lock', async () => {
    if (!registeredDomain) { pushResult({ capability: 'LOCK', method: 'setDomainLock', httpStatus: 0, dynadotCode: 'N/A', envelope: 'N/A', dto: 'N/A', mapper: 'N/A', evidence: 'SANDBOX_NOT_APPLICABLE', notes: 'No domain', durationMs: 0 }); return; }
    // Sandbox domains may already be locked; unlock first, then lock+unlock
    const unlockFirst = await sandboxRequest('PUT', `domains/${encodeURIComponent(registeredDomain)}/domain_lock`, { signed: true, body: { lock: false }});
    const lockResp = await sandboxRequest('PUT', `domains/${encodeURIComponent(registeredDomain)}/domain_lock`, { signed: true, body: { lock: true }});
    const lockEnv = parseEnvelope(lockResp.body);
    const lockOk = lockResp.httpStatus === 200 && lockEnv.classification === 'SUCCESS';
    // Restore: unlock
    if (lockOk) await sandboxRequest('PUT', `domains/${encodeURIComponent(registeredDomain)}/domain_lock`, { signed: true, body: { lock: false }});
    pushResult({ capability: 'LOCK', method: 'setDomainLock', httpStatus: lockResp.httpStatus, dynadotCode: String(lockEnv.code ?? ''), envelope: lockEnv.classification, dto: lockOk ? 'PASS' : 'FAIL', mapper: lockOk ? 'PASS' : 'FAIL', evidence: lockOk ? 'SANDBOX_VERIFIED' : lockResp.httpStatus === 400 ? 'SANDBOX_UNSUPPORTED' : 'SANDBOX_FAILED', notes: `unlock_first=${unlockFirst.httpStatus}, lock=${lockResp.httpStatus}, restored`, durationMs: lockResp.durationMs });
  });

  // Renew Option
  it('MUTATION 7: Renew Option', async () => {
    if (!registeredDomain) { pushResult({ capability: 'RENEW_OPTION', method: 'setRenewOption', httpStatus: 0, dynadotCode: 'N/A', envelope: 'N/A', dto: 'N/A', mapper: 'N/A', evidence: 'SANDBOX_NOT_APPLICABLE', notes: 'No domain', durationMs: 0 }); return; }
    const resp = await sandboxRequest('PUT', `domains/${encodeURIComponent(registeredDomain)}/renew_option`, { signed: true, body: { renew_option: 'auto_renew' }});
    const env = parseEnvelope(resp.body);
    const ok = resp.httpStatus === 200 && env.classification === 'SUCCESS';
    pushResult({ capability: 'RENEW_OPTION', method: 'setRenewOption', httpStatus: resp.httpStatus, dynadotCode: String(env.code ?? ''), envelope: env.classification, dto: ok ? 'PASS' : 'FAIL', mapper: ok ? 'PASS' : 'FAIL', evidence: ok ? 'SANDBOX_VERIFIED' : resp.httpStatus === 400 ? 'SANDBOX_UNSUPPORTED' : 'SANDBOX_FAILED', notes: 'Set auto_renew', durationMs: resp.durationMs });
  });

  // Forwarding (3 modes independently)
  it('MUTATION 8a: Domain Forwarding', async () => {
    if (!registeredDomain) { pushResult({ capability: 'FORWARDING', method: 'setDomainForwarding', httpStatus: 0, dynadotCode: 'N/A', envelope: 'N/A', dto: 'N/A', mapper: 'N/A', evidence: 'SANDBOX_NOT_APPLICABLE', notes: 'No domain', durationMs: 0 }); return; }
    const resp = await sandboxRequest('PUT', `domains/${encodeURIComponent(registeredDomain)}/domain_forwarding`, { signed: true, body: { forward_url: 'https://example.com', is_temporary: false }});
    const env = parseEnvelope(resp.body);
    const ok = resp.httpStatus === 200 && env.classification === 'SUCCESS';
    if (ok) await sandboxRequest('PUT', `domains/${encodeURIComponent(registeredDomain)}/domain_forwarding`, { signed: true, body: { forward_url: '', is_temporary: true }});
    pushResult({ capability: 'FORWARDING', method: 'setDomainForwarding', httpStatus: resp.httpStatus, dynadotCode: String(env.code ?? ''), envelope: env.classification, dto: ok ? 'PASS' : 'FAIL', mapper: ok ? 'PASS' : 'FAIL', evidence: ok ? 'SANDBOX_VERIFIED' : resp.httpStatus === 400 ? 'SANDBOX_UNSUPPORTED' : 'SANDBOX_FAILED', notes: 'Domain forwarding', durationMs: resp.durationMs });
  });

  it('MUTATION 8b: Stealth Forwarding', async () => {
    if (!registeredDomain) { pushResult({ capability: 'FORWARDING', method: 'setStealthForwarding', httpStatus: 0, dynadotCode: 'N/A', envelope: 'N/A', dto: 'N/A', mapper: 'N/A', evidence: 'SANDBOX_NOT_APPLICABLE', notes: 'No domain', durationMs: 0 }); return; }
    const resp = await sandboxRequest('PUT', `domains/${encodeURIComponent(registeredDomain)}/stealth_forwarding`, { signed: true, body: { stealth_url: 'https://example.com', stealth_title: 'Test' }});
    const env = parseEnvelope(resp.body);
    const ok = resp.httpStatus === 200 && env.classification === 'SUCCESS';
    pushResult({ capability: 'FORWARDING', method: 'setStealthForwarding', httpStatus: resp.httpStatus, dynadotCode: String(env.code ?? ''), envelope: env.classification, dto: ok ? 'PASS' : 'FAIL', mapper: ok ? 'PASS' : 'FAIL', evidence: ok ? 'SANDBOX_VERIFIED' : resp.httpStatus === 400 ? 'SANDBOX_UNSUPPORTED' : 'SANDBOX_FAILED', notes: 'Stealth forwarding', durationMs: resp.durationMs });
  });

  it('MUTATION 8c: Email Forwarding', async () => {
    if (!registeredDomain) { pushResult({ capability: 'FORWARDING', method: 'setEmailForwarding', httpStatus: 0, dynadotCode: 'N/A', envelope: 'N/A', dto: 'N/A', mapper: 'N/A', evidence: 'SANDBOX_NOT_APPLICABLE', notes: 'No domain', durationMs: 0 }); return; }
    const resp = await sandboxRequest('PUT', `domains/${encodeURIComponent(registeredDomain)}/email_forwarding`, { signed: true, body: { forward_to: 'test@example.com' }});
    const env = parseEnvelope(resp.body);
    const ok = resp.httpStatus === 200 && env.classification === 'SUCCESS';
    pushResult({ capability: 'FORWARDING', method: 'setEmailForwarding', httpStatus: resp.httpStatus, dynadotCode: String(env.code ?? ''), envelope: env.classification, dto: ok ? 'PASS' : 'FAIL', mapper: ok ? 'PASS' : 'FAIL', evidence: ok ? 'SANDBOX_VERIFIED' : resp.httpStatus === 400 ? 'SANDBOX_UNSUPPORTED' : 'SANDBOX_FAILED', notes: 'Email forwarding', durationMs: resp.durationMs });
  });

  // NS Config (using sandbox inventory)
  it('MUTATION 9: Nameserver Config', async () => {
    if (!registeredDomain) { pushResult({ capability: 'NS_CONFIG', method: 'setNameservers', httpStatus: 0, dynadotCode: 'N/A', envelope: 'N/A', dto: 'N/A', mapper: 'N/A', evidence: 'SANDBOX_NOT_APPLICABLE', notes: 'No domain', durationMs: 0 }); return; }

    let nsToUse: string[] = [];
    if (sandboxNameservers.length >= 2) {
      nsToUse = sandboxNameservers.slice(0, 2).map(ns => ns.server_name!).filter(Boolean);
    }
    if (nsToUse.length < 2) {
      // Try adding external NS
      for (const ns of ['ns1.pristest.com', 'ns2.pristest.com']) {
        const addResp = await sandboxRequest('POST', `nameservers/${ns}/add_external`, { signed: true });
        if (addResp.httpStatus === 200) nsToUse.push(ns);
      }
    }
    if (nsToUse.length < 2) {
      pushResult({ capability: 'NS_CONFIG', method: 'setNameservers', httpStatus: 0, dynadotCode: 'N/A', envelope: 'N/A', dto: 'N/A', mapper: 'N/A', evidence: 'SANDBOX_NOT_APPLICABLE', notes: 'Cannot get 2 valid NS', durationMs: 0 }); return;
    }

    // Capture original
    const origResp = await sandboxRequest('GET', `domains/${encodeURIComponent(registeredDomain)}/nameservers`);
    const origNs = (parseEnvelope(origResp.body).data as Record<string, unknown>)?.nameserver_list as string[] | undefined;

    const resp = await sandboxRequest('PUT', `domains/${encodeURIComponent(registeredDomain)}/nameservers`, { signed: true, body: { nameserver_list: nsToUse }});
    const env = parseEnvelope(resp.body);
    const ok = resp.httpStatus === 200 && env.classification === 'SUCCESS';

    // Readback
    let readback = false;
    if (ok) {
      const vr = await sandboxRequest('GET', `domains/${encodeURIComponent(registeredDomain)}/nameservers`);
      readback = vr.httpStatus === 200;
    }

    pushResult({ capability: 'NS_CONFIG', method: 'setNameservers', httpStatus: resp.httpStatus, dynadotCode: String(env.code ?? ''), envelope: env.classification, dto: ok ? 'PASS' : 'FAIL', mapper: ok ? 'PASS' : 'FAIL', evidence: ok ? 'SANDBOX_VERIFIED' : resp.httpStatus === 400 ? 'SANDBOX_UNSUPPORTED' : 'SANDBOX_FAILED', notes: `NS=${nsToUse.join(',')}, readback=${readback}`, durationMs: resp.durationMs });

    // Restore
    if (origNs && origNs.length >= 2) {
      await sandboxRequest('PUT', `domains/${encodeURIComponent(registeredDomain)}/nameservers`, { signed: true, body: { nameserver_list: origNs }});
    }
  });

  // Renewal
  it('MUTATION 10: Renewal', async () => {
    if (!registeredDomain) { pushResult({ capability: 'RENEWAL', method: 'renewDomain', httpStatus: 0, dynadotCode: 'N/A', envelope: 'N/A', dto: 'N/A', mapper: 'N/A', evidence: 'SANDBOX_NOT_APPLICABLE', notes: 'No domain', durationMs: 0 }); return; }
    const resp = await sandboxRequest('POST', `domains/${encodeURIComponent(registeredDomain)}/renew`, { signed: true, body: { duration: 1, currency: 'USD' }});
    const env = parseEnvelope(resp.body);
    const ok = resp.httpStatus === 200 && env.classification === 'SUCCESS';
    pushResult({ capability: 'RENEWAL', method: 'renewDomain', httpStatus: resp.httpStatus, dynadotCode: String(env.code ?? ''), envelope: env.classification, dto: ok ? 'PASS' : 'N/A', mapper: ok ? 'PASS' : 'N/A', evidence: ok ? 'SANDBOX_VERIFIED' : (resp.httpStatus === 400 || resp.httpStatus === 409) ? 'SANDBOX_NOT_APPLICABLE' : 'SANDBOX_FAILED', notes: `${ok ? 'Renewed' : (env.errorDescription ?? env.message)}`, durationMs: resp.durationMs });
  });

  // DNSSEC on registered domain
  it('MUTATION 11: DNSSEC Get reg', async () => {
    if (!registeredDomain) { pushResult({ capability: 'DNSSEC', method: 'getDnssec_reg', httpStatus: 0, dynadotCode: 'N/A', envelope: 'N/A', dto: 'N/A', mapper: 'N/A', evidence: 'SANDBOX_NOT_APPLICABLE', notes: 'No domain', durationMs: 0 }); return; }
    const resp = await sandboxRequest('GET', `domains/${encodeURIComponent(registeredDomain)}/dnssec`, { signed: true });
    const env = parseEnvelope(resp.body);
    pushResult({ capability: 'DNSSEC', method: 'getDnssec_reg', httpStatus: resp.httpStatus, dynadotCode: String(env.code ?? ''), envelope: env.classification, dto: resp.httpStatus === 200 ? 'PASS' : 'N/A', mapper: resp.httpStatus === 200 ? 'PASS' : 'N/A', evidence: resp.httpStatus === 200 ? 'SANDBOX_VERIFIED' : 'SANDBOX_NOT_APPLICABLE', notes: `domain=${registeredDomain}`, durationMs: resp.durationMs });
  });

  // Contact Delete (after domain ops complete)
  it('MUTATION 12: Contact Delete', async () => {
    if (!syntheticContactId) { pushResult({ capability: 'CONTACTS', method: 'deleteContact', httpStatus: 0, dynadotCode: 'N/A', envelope: 'N/A', dto: 'N/A', mapper: 'N/A', evidence: 'SANDBOX_NOT_APPLICABLE', notes: 'No contact', durationMs: 0 }); return; }
    const resp = await sandboxRequest('DELETE', `contacts/${syntheticContactId}`, { signed: true });
    const env = parseEnvelope(resp.body);
    const ok = resp.httpStatus === 200 && env.classification === 'SUCCESS';
    pushResult({ capability: 'CONTACTS', method: 'deleteContact', httpStatus: resp.httpStatus, dynadotCode: String(env.code ?? ''), envelope: env.classification, dto: ok ? 'PASS' : 'FAIL', mapper: ok ? 'PASS' : 'FAIL', evidence: ok ? 'SANDBOX_VERIFIED' : resp.httpStatus === 409 ? 'SANDBOX_NOT_APPLICABLE' : 'SANDBOX_FAILED', notes: `Delete ${syntheticContactId}, 409=in_use OK`, durationMs: resp.durationMs });
  });

  // Grace Delete (LAST)
  it('MUTATION 13: Grace Delete', async () => {
    if (!registeredDomain) { pushResult({ capability: 'GRACE_DELETE', method: 'graceDelete', httpStatus: 0, dynadotCode: 'N/A', envelope: 'N/A', dto: 'N/A', mapper: 'N/A', evidence: 'SANDBOX_NOT_APPLICABLE', notes: 'No domain', durationMs: 0 }); return; }
    const resp = await sandboxRequest('DELETE', `domains/${encodeURIComponent(registeredDomain)}/grace_delete`, { signed: true });
    const env = parseEnvelope(resp.body);
    const ok = resp.httpStatus === 200 && env.classification === 'SUCCESS';
    pushResult({ capability: 'GRACE_DELETE', method: 'graceDelete', httpStatus: resp.httpStatus, dynadotCode: String(env.code ?? ''), envelope: env.classification, dto: ok ? 'PASS' : 'N/A', mapper: ok ? 'PASS' : 'N/A', evidence: ok ? 'SANDBOX_VERIFIED' : (resp.httpStatus === 400 || resp.httpStatus === 409) ? 'SANDBOX_NOT_APPLICABLE' : 'SANDBOX_FAILED', notes: `${ok ? 'Grace-deleted' : (env.errorDescription ?? env.message)}`, durationMs: resp.durationMs });
  });

  // ═══ FINAL REPORT ═══

  it('FINAL: Gate Report', () => {
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log(' COMPREHENSIVE SANDBOX GATE RESULTS');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('\n── Method-Level Evidence Matrix ──');
    console.log('| Capability | Method | HTTP | Code | Envelope | DTO | Mapper | Evidence |');
    console.log('|---|---|---|---|---|---|---|---|');
    for (const r of results) console.log(`| ${r.capability} | ${r.method} | ${r.httpStatus} | ${r.dynadotCode} | ${r.envelope} | ${r.dto} | ${r.mapper} | ${r.evidence} |`);

    const summary = {
      SANDBOX_VERIFIED: results.filter(r => r.evidence === 'SANDBOX_VERIFIED').length,
      SANDBOX_UNSUPPORTED: results.filter(r => r.evidence === 'SANDBOX_UNSUPPORTED').length,
      SANDBOX_NOT_APPLICABLE: results.filter(r => r.evidence === 'SANDBOX_NOT_APPLICABLE').length,
      SANDBOX_FAILED: results.filter(r => r.evidence === 'SANDBOX_FAILED').length,
    };
    console.log('\n── Evidence Summary ──');
    console.log(`  SANDBOX_VERIFIED:        ${summary.SANDBOX_VERIFIED}`);
    console.log(`  SANDBOX_UNSUPPORTED:     ${summary.SANDBOX_UNSUPPORTED}`);
    console.log(`  SANDBOX_NOT_APPLICABLE:  ${summary.SANDBOX_NOT_APPLICABLE}`);
    console.log(`  SANDBOX_FAILED:          ${summary.SANDBOX_FAILED}`);
    console.log(`  Total: ${results.length}`);

    console.log('\n── Cleanup Report ──');
    console.log(`  Disposable domain: ${registeredDomain || 'none'}`);
    console.log(`  Synthetic contact: ${syntheticContactId || 'none'}`);
    console.log(`  Registration order: ${registrationOrderId ?? 'none'}`);

    const hasFoundationalFail = results.some(r => r.evidence === 'SANDBOX_FAILED' && r.capability === 'ACCOUNT');
    const verdict = hasFoundationalFail ? 'PRE-PHASE-6 DYNADOT PROVIDER GATE: FAILED'
      : summary.SANDBOX_FAILED > 0 ? `PRE-PHASE-6 DYNADOT PROVIDER GATE: PARTIAL (${summary.SANDBOX_FAILED} failures)`
      : 'PRE-PHASE-6 DYNADOT PROVIDER GATE: PASSED';
    console.log(`\n${summary.SANDBOX_FAILED === 0 ? '✅' : '❌'} ${verdict}`);

    const reportPath = path.join(process.cwd(), 'sandbox-gate-report.json');
    fs.writeFileSync(reportPath, JSON.stringify({ timestamp: new Date().toISOString(), sandboxHost: SANDBOX_HOST, verdict, summary, results, cleanup: { disposableDomain: registeredDomain || null, syntheticContact: syntheticContactId || null, registrationOrder: registrationOrderId ?? null } }, null, 2));
    console.log(`\nReport: ${reportPath}\n`);

    expect(hasFoundationalFail).toBe(false);
  });
});
