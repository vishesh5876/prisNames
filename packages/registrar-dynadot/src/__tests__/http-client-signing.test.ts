/**
 * PrisNames — HTTP Client Signing Integration Test
 *
 * Mocks the transport boundary (global fetch) and inspects the actual
 * request sent by DynadotHttpClient to verify:
 * - X-Request-ID matches the request ID used during signing
 * - X-Signature matches the signature calculated over the exact
 *   fullPathAndQuery and outgoing body
 * - The body sent over HTTP is the exact body that was signed
 * - Query parameters are NOT reordered after signing
 * - JSON.stringify is called exactly once
 *
 * This test should fail if someone later changes serialization or
 * query construction without updating signing.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createHmac } from 'node:crypto';
import { DynadotHttpClient } from '../http-client.js';
import type { DynadotConfig } from '../config.js';
import type { EndpointDescriptor } from '../endpoints.js';
import type { DynadotRateLimiter } from '../rate-limiter.js';
import type { CircuitBreaker, ProviderHealthTracker } from '@prisnames/registrar-core';

// ── Test Constants ──

const API_KEY = 'integration_test_api_key';
const API_SECRET = 'integration_test_api_secret';
const BASE_URL = 'https://api-sandbox.dynadot.com/restful/v2';

// ── Mock Infrastructure ──

function createMockConfig(): DynadotConfig {
  return {
    apiKey: API_KEY,
    apiSecret: API_SECRET,
    baseUrl: BASE_URL,
    environment: 'sandbox',
    appEnv: 'development',
    webhookKey: 'unused',
    webhookSecret: 'unused',
    accountTier: 'regular',
  } as DynadotConfig;
}

function createMockRateLimiter(): DynadotRateLimiter {
  return {
    acquireLease: vi.fn().mockResolvedValue({ acquired: true, leaseId: 'test-lease' }),
    releaseLease: vi.fn().mockResolvedValue(undefined),
    setCooldown: vi.fn().mockResolvedValue(undefined),
  } as unknown as DynadotRateLimiter;
}

function createMockCircuitBreaker(): CircuitBreaker {
  return {
    canExecute: vi.fn().mockReturnValue(true),
    recordSuccess: vi.fn(),
    recordFailure: vi.fn(),
  } as unknown as CircuitBreaker;
}

function createMockHealthTracker(): ProviderHealthTracker {
  return {
    recordSuccess: vi.fn(),
    recordFailure: vi.fn(),
  } as unknown as ProviderHealthTracker;
}

// ── Tests ──

describe('DynadotHttpClient signing integration', () => {
  let originalFetch: typeof globalThis.fetch;
  let capturedRequest: { url: string; init: RequestInit } | null = null;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    capturedRequest = null;

    // Mock fetch at the transport boundary
    globalThis.fetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      capturedRequest = { url: url.toString(), init: init ?? {} };
      return new Response(JSON.stringify({ status: 'ok' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }) as unknown as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('signed GET: X-Signature matches independently computed HMAC over exact fullPathAndQuery', async () => {
    const client = new DynadotHttpClient(
      createMockConfig(),
      createMockRateLimiter(),
      createMockCircuitBreaker(),
      createMockHealthTracker(),
    );

    const endpoint: EndpointDescriptor = {
      method: 'GET',
      pathTemplate: '/restful/v2/accounts/info',
      signed: true,
      sandboxSupport: 'SUPPORTED',
      expectedSuccessCodes: [200],
      description: 'test endpoint',
    };

    await client.request(endpoint, { path: 'accounts/info' });

    expect(capturedRequest).not.toBeNull();
    const headers = capturedRequest!.init.headers as Record<string, string>;

    // Extract the exact URL path+query that was sent
    const sentUrl = new URL(capturedRequest!.url);
    const fullPathAndQuery = sentUrl.pathname + sentUrl.search;

    // Extract the request ID from the header
    const xRequestId = headers['X-Request-ID'];
    expect(xRequestId).toBeDefined();
    expect(xRequestId.length).toBeGreaterThan(0);

    // GET has no body
    const body = '';

    // Independently compute the expected signature
    const stringToSign = API_KEY + '\n' + fullPathAndQuery + '\n' + xRequestId + '\n' + body;
    const expectedSig = createHmac('sha256', API_SECRET).update(stringToSign).digest('base64');

    // Assert X-Signature matches
    expect(headers['X-Signature']).toBe(expectedSig);
  });

  it('signed POST: X-Signature matches HMAC over exact body sent over HTTP', async () => {
    const client = new DynadotHttpClient(
      createMockConfig(),
      createMockRateLimiter(),
      createMockCircuitBreaker(),
      createMockHealthTracker(),
    );

    const endpoint: EndpointDescriptor = {
      method: 'POST',
      pathTemplate: '/restful/v2/domains/{domain_name}/register',
      signed: true,
      sandboxSupport: 'SUPPORTED',
      expectedSuccessCodes: [200],
      description: 'test registration',
    };

    const requestBody = { domain: 'example.com', years: 1 };

    await client.request(endpoint, {
      path: 'domains/example.com/register',
      body: requestBody,
    });

    expect(capturedRequest).not.toBeNull();
    const headers = capturedRequest!.init.headers as Record<string, string>;

    // The exact body string sent over HTTP
    const sentBody = capturedRequest!.init.body as string;
    expect(sentBody).toBe(JSON.stringify(requestBody));

    // Verify body was NOT double-stringified
    expect(sentBody).not.toContain('\\"domain\\"');

    // Extract path+query
    const sentUrl = new URL(capturedRequest!.url);
    const fullPathAndQuery = sentUrl.pathname + sentUrl.search;
    const xRequestId = headers['X-Request-ID'];

    // Independently compute expected signature
    const stringToSign = API_KEY + '\n' + fullPathAndQuery + '\n' + xRequestId + '\n' + sentBody;
    const expectedSig = createHmac('sha256', API_SECRET).update(stringToSign).digest('base64');

    expect(headers['X-Signature']).toBe(expectedSig);
  });

  it('signed GET with query params: signature uses exact query string order', async () => {
    const client = new DynadotHttpClient(
      createMockConfig(),
      createMockRateLimiter(),
      createMockCircuitBreaker(),
      createMockHealthTracker(),
    );

    const endpoint: EndpointDescriptor = {
      method: 'GET',
      pathTemplate: '/restful/v2/domains/search',
      signed: true,
      sandboxSupport: 'SUPPORTED',
      expectedSuccessCodes: [200],
      description: 'test search',
    };

    await client.request(endpoint, {
      path: 'domains/search',
      params: { show_price: 'true', currency: 'USD' },
    });

    expect(capturedRequest).not.toBeNull();
    const headers = capturedRequest!.init.headers as Record<string, string>;

    const sentUrl = new URL(capturedRequest!.url);
    const fullPathAndQuery = sentUrl.pathname + sentUrl.search;
    const xRequestId = headers['X-Request-ID'];

    // Independently compute expected signature
    const stringToSign = API_KEY + '\n' + fullPathAndQuery + '\n' + xRequestId + '\n' + '';
    const expectedSig = createHmac('sha256', API_SECRET).update(stringToSign).digest('base64');

    expect(headers['X-Signature']).toBe(expectedSig);

    // Verify query params are in URL
    expect(fullPathAndQuery).toContain('show_price=true');
    expect(fullPathAndQuery).toContain('currency=USD');
  });

  it('unsigned endpoint: no X-Signature header', async () => {
    const client = new DynadotHttpClient(
      createMockConfig(),
      createMockRateLimiter(),
      createMockCircuitBreaker(),
      createMockHealthTracker(),
    );

    const endpoint: EndpointDescriptor = {
      method: 'GET',
      pathTemplate: '/restful/v2/domains/search',
      signed: false,
      sandboxSupport: 'SUPPORTED',
      expectedSuccessCodes: [200],
      description: 'unsigned search',
    };

    await client.request(endpoint, { path: 'domains/search' });

    expect(capturedRequest).not.toBeNull();
    const headers = capturedRequest!.init.headers as Record<string, string>;

    expect(headers['X-Signature']).toBeUndefined();
    expect(headers['X-Request-ID']).toBeDefined();
    expect(headers['Authorization']).toBe(`Bearer ${API_KEY}`);
  });

  it('X-Request-ID in header matches the value used during signing', async () => {
    const client = new DynadotHttpClient(
      createMockConfig(),
      createMockRateLimiter(),
      createMockCircuitBreaker(),
      createMockHealthTracker(),
    );

    const endpoint: EndpointDescriptor = {
      method: 'GET',
      pathTemplate: '/restful/v2/accounts/info',
      signed: true,
      sandboxSupport: 'SUPPORTED',
      expectedSuccessCodes: [200],
      description: 'test',
    };

    await client.request(endpoint, { path: 'accounts/info' });

    const headers = capturedRequest!.init.headers as Record<string, string>;
    const xRequestId = headers['X-Request-ID'];
    const xSignature = headers['X-Signature'];

    // Recompute signature with the SAME request ID from the header
    const sentUrl = new URL(capturedRequest!.url);
    const fullPathAndQuery = sentUrl.pathname + sentUrl.search;
    const stringToSign = API_KEY + '\n' + fullPathAndQuery + '\n' + xRequestId + '\n' + '';
    const expectedSig = createHmac('sha256', API_SECRET).update(stringToSign).digest('base64');

    expect(xSignature).toBe(expectedSig);

    // Use a DIFFERENT request ID — should NOT match
    const wrongStringToSign = API_KEY + '\n' + fullPathAndQuery + '\n' + 'wrong-id' + '\n' + '';
    const wrongSig = createHmac('sha256', API_SECRET).update(wrongStringToSign).digest('base64');
    expect(xSignature).not.toBe(wrongSig);
  });
});
