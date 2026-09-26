/**
 * API client tests.
 *
 * Covers: structured error handling, credentials included,
 * JSON body serialization, 204 handling, error code parsing.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { apiFetch, ApiError } from '@/lib/api-client';

describe('apiFetch', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = vi.fn();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('makes requests to /api/v1 prefix', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ data: 'ok' }), { status: 200 }),
    );
    await apiFetch('/auth/me');
    expect(globalThis.fetch).toHaveBeenCalledWith(
      '/api/v1/auth/me',
      expect.objectContaining({}),
    );
  });

  it('includes credentials', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({}), { status: 200 }),
    );
    await apiFetch('/auth/me');
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ credentials: 'include' }),
    );
  });

  it('sets Content-Type for JSON body', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({}), { status: 200 }),
    );
    await apiFetch('/auth/login', {
      method: 'POST',
      json: { email: 'a@b.com', password: 'test' },
    });

    const callArgs = vi.mocked(globalThis.fetch).mock.calls[0];
    const headers = callArgs[1]?.headers as Record<string, string>;
    expect(headers['Content-Type']).toBe('application/json');
  });

  it('serializes JSON body', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({}), { status: 200 }),
    );
    const payload = { email: 'a@b.com' };
    await apiFetch('/auth/login', { method: 'POST', json: payload });

    const callArgs = vi.mocked(globalThis.fetch).mock.calls[0];
    expect(callArgs[1]?.body).toBe(JSON.stringify(payload));
  });

  it('handles 204 No Content', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      new Response(null, { status: 204 }),
    );
    const result = await apiFetch('/auth/logout');
    expect(result).toBeUndefined();
  });

  it('throws ApiError on non-ok response', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ error: { code: 'AUTH_INVALID_CREDENTIALS' } }), { status: 401 }),
    );
    await expect(apiFetch('/auth/login')).rejects.toThrow(ApiError);
  });

  it('parses error code from response body', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ error: { code: 'AUTH_INVALID_CREDENTIALS', requestId: 'abc123' } }), { status: 401 }),
    );
    try {
      await apiFetch('/auth/login');
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      const apiErr = err as ApiError;
      expect(apiErr.status).toBe(401);
      expect(apiErr.code).toBe('AUTH_INVALID_CREDENTIALS');
      expect(apiErr.requestId).toBe('abc123');
    }
  });

  it('handles non-JSON error response', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      new Response('Internal Server Error', { status: 500 }),
    );
    try {
      await apiFetch('/auth/me');
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      expect((err as ApiError).code).toBe('UNKNOWN_ERROR');
    }
  });

  it('parses flat code property', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ code: 'RATE_LIMITED' }), { status: 429 }),
    );
    try {
      await apiFetch('/auth/login');
    } catch (err) {
      expect((err as ApiError).code).toBe('RATE_LIMITED');
    }
  });
});
