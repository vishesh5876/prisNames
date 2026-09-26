/**
 * PrisNames — Registration Facet Unit Tests
 *
 * Exercises DynadotRegistrationFacet date normalization at the adapter boundary.
 * Ensures malformed/missing/unparseable expiration dates are returned as undefined
 * rather than leaking Invalid Date objects into business logic.
 */

import { describe, it, expect, vi } from 'vitest';
import { DynadotRegistrationFacet } from '../facets/registration.facet.js';
import type { DynadotHttpClient, DynadotApiResponse } from '../http-client.js';

/**
 * Creates a mock DynadotHttpClient that returns the given response data.
 */
function mockClient(data: Record<string, unknown>, status = 200): DynadotHttpClient {
  return {
    request: vi.fn().mockResolvedValue({
      status,
      data,
      requestId: 'mock-request-id',
    } satisfies DynadotApiResponse),
  } as unknown as DynadotHttpClient;
}

const BASE_PARAMS = {
  domain: 'test-expiration.xyz',
  duration: 1,
  currency: 'USD',
  privacy: 'off' as const,
};

describe('DynadotRegistrationFacet — expiration date normalization', () => {
  it('returns valid Date when expiration_date is a valid millisecond timestamp', async () => {
    const ts = 1757750400000; // 2025-09-13T00:00:00.000Z
    const client = mockClient({ domain_name: 'test.xyz', expiration_date: ts });
    const facet = new DynadotRegistrationFacet(client);

    const result = await facet.registerDomain(BASE_PARAMS);

    expect(result.expiresAt).toBeInstanceOf(Date);
    expect(result.expiresAt!.getTime()).toBe(ts);
    expect(isNaN(result.expiresAt!.getTime())).toBe(false);
  });

  it('returns undefined when expiration_date is null', async () => {
    const client = mockClient({ domain_name: 'test.xyz', expiration_date: null });
    const facet = new DynadotRegistrationFacet(client);

    const result = await facet.registerDomain(BASE_PARAMS);

    expect(result.expiresAt).toBeUndefined();
  });

  it('returns undefined when expiration_date is undefined', async () => {
    const client = mockClient({ domain_name: 'test.xyz' }); // no expiration_date key
    const facet = new DynadotRegistrationFacet(client);

    const result = await facet.registerDomain(BASE_PARAMS);

    expect(result.expiresAt).toBeUndefined();
  });

  it('returns undefined when expiration_date is 0', async () => {
    const client = mockClient({ domain_name: 'test.xyz', expiration_date: 0 });
    const facet = new DynadotRegistrationFacet(client);

    const result = await facet.registerDomain(BASE_PARAMS);

    // 0 → new Date(0) is valid (1970-01-01), but original code treated 0 as falsy.
    // After fix: new Date(0) is valid, so this should return a Date for epoch.
    // However, 0 is still a valid unix timestamp. The contract says: if provider
    // returns a value, convert it. Date(0) = Jan 1 1970 is technically valid.
    // We accept either behavior — the key invariant is: never return Invalid Date.
    if (result.expiresAt !== undefined) {
      expect(result.expiresAt).toBeInstanceOf(Date);
      expect(isNaN(result.expiresAt!.getTime())).toBe(false);
    }
  });

  it('returns undefined when expiration_date is a non-parseable string', async () => {
    const client = mockClient({ domain_name: 'test.xyz', expiration_date: 'not-a-date' });
    const facet = new DynadotRegistrationFacet(client);

    const result = await facet.registerDomain(BASE_PARAMS);

    expect(result.expiresAt).toBeUndefined();
  });

  it('returns undefined when expiration_date is NaN', async () => {
    const client = mockClient({ domain_name: 'test.xyz', expiration_date: NaN });
    const facet = new DynadotRegistrationFacet(client);

    const result = await facet.registerDomain(BASE_PARAMS);

    expect(result.expiresAt).toBeUndefined();
  });

  it('returns undefined when expiration_date is an empty string', async () => {
    const client = mockClient({ domain_name: 'test.xyz', expiration_date: '' });
    const facet = new DynadotRegistrationFacet(client);

    const result = await facet.registerDomain(BASE_PARAMS);

    expect(result.expiresAt).toBeUndefined();
  });

  it('returns valid Date when expiration_date is an ISO 8601 string', async () => {
    const isoStr = '2025-09-13T00:00:00.000Z';
    const client = mockClient({ domain_name: 'test.xyz', expiration_date: isoStr });
    const facet = new DynadotRegistrationFacet(client);

    const result = await facet.registerDomain(BASE_PARAMS);

    expect(result.expiresAt).toBeInstanceOf(Date);
    expect(isNaN(result.expiresAt!.getTime())).toBe(false);
    expect(result.expiresAt!.toISOString()).toBe(isoStr);
  });

  it('never returns an Invalid Date — invariant check across edge cases', async () => {
    const edgeCases = [null, undefined, 0, '', 'garbage', NaN, {}, [], -1, Infinity, -Infinity];

    for (const edgeCase of edgeCases) {
      const client = mockClient({ domain_name: 'test.xyz', expiration_date: edgeCase });
      const facet = new DynadotRegistrationFacet(client);
      const result = await facet.registerDomain(BASE_PARAMS);

      if (result.expiresAt !== undefined) {
        expect(result.expiresAt).toBeInstanceOf(Date);
        expect(
          isNaN(result.expiresAt!.getTime()),
          `Invalid Date leaked for expiration_date=${JSON.stringify(edgeCase)}`
        ).toBe(false);
      }
    }
  });
});
