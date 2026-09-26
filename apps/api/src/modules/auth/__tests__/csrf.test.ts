/**
 * PrisNames — CSRF Validation Tests
 *
 * Tests the CSRF origin/referer validation logic from main.ts.
 * Verifies:
 * - Exact origin matching (not prefix)
 * - Evil origin rejection
 * - Valid-domain-prefix attack prevention
 * - Wrong scheme rejection
 * - Wrong port rejection
 * - Missing Origin/Referer → REJECTED for cookie-authenticated mutating requests
 * - Referer fallback behavior
 * - Unauthenticated bypass
 * - Safe method bypass
 */

import { describe, it, expect } from 'vitest';

// Extract CSRF validation logic for testing (mirrors main.ts preHandler)

interface CsrfResult {
  allowed: boolean;
  code?: string;
}

function validateCsrf(
  method: string,
  hasSessionCookie: boolean,
  origin: string | undefined,
  referer: string | undefined,
  allowedOrigins: string[],
): CsrfResult {
  // GET/HEAD/OPTIONS always pass CSRF
  if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    return { allowed: true };
  }

  // Only enforce for cookie-authenticated requests
  if (!hasSessionCookie) {
    return { allowed: true };
  }

  if (origin) {
    // Exact match — not prefix, not substring
    if (!allowedOrigins.includes(origin)) {
      return { allowed: false, code: 'CSRF_ORIGIN_MISMATCH' };
    }
    return { allowed: true };
  }

  // Fall back to Referer
  if (referer) {
    try {
      const refererOrigin = new URL(referer).origin;
      if (!allowedOrigins.includes(refererOrigin)) {
        return { allowed: false, code: 'CSRF_REFERER_MISMATCH' };
      }
      return { allowed: true };
    } catch {
      return { allowed: false, code: 'CSRF_REFERER_INVALID' };
    }
  }

  // CSRF REJECTION: cookie-authenticated mutating request with no Origin AND no Referer.
  // Browsers always send Origin for mutating requests. Missing both = reject.
  return { allowed: false, code: 'CSRF_MISSING_ORIGIN' };
}

const ALLOWED_ORIGINS = ['https://prisnames.com'];

describe('CSRF Origin/Referer Validation', () => {
  describe('safe methods bypass CSRF', () => {
    it('GET requests always pass', () => {
      expect(validateCsrf('GET', true, undefined, undefined, ALLOWED_ORIGINS).allowed).toBe(true);
    });

    it('HEAD requests always pass', () => {
      expect(validateCsrf('HEAD', true, undefined, undefined, ALLOWED_ORIGINS).allowed).toBe(true);
    });

    it('OPTIONS requests always pass', () => {
      expect(validateCsrf('OPTIONS', true, undefined, undefined, ALLOWED_ORIGINS).allowed).toBe(true);
    });
  });

  describe('unauthenticated requests bypass CSRF', () => {
    it('POST without session cookie passes', () => {
      expect(validateCsrf('POST', false, 'https://evil.com', undefined, ALLOWED_ORIGINS).allowed).toBe(true);
    });

    it('POST without session cookie + no Origin/Referer passes', () => {
      expect(validateCsrf('POST', false, undefined, undefined, ALLOWED_ORIGINS).allowed).toBe(true);
    });
  });

  describe('exact origin matching', () => {
    it('valid exact origin is allowed', () => {
      const result = validateCsrf('POST', true, 'https://prisnames.com', undefined, ALLOWED_ORIGINS);
      expect(result.allowed).toBe(true);
    });

    it('evil origin is rejected', () => {
      const result = validateCsrf('POST', true, 'https://evil.com', undefined, ALLOWED_ORIGINS);
      expect(result.allowed).toBe(false);
      expect(result.code).toBe('CSRF_ORIGIN_MISMATCH');
    });

    it('valid-domain-prefix attack is rejected (prisnames.com.evil.com)', () => {
      const result = validateCsrf('POST', true, 'https://prisnames.com.evil.com', undefined, ALLOWED_ORIGINS);
      expect(result.allowed).toBe(false);
      expect(result.code).toBe('CSRF_ORIGIN_MISMATCH');
    });

    it('wrong scheme is rejected (http instead of https)', () => {
      const result = validateCsrf('POST', true, 'http://prisnames.com', undefined, ALLOWED_ORIGINS);
      expect(result.allowed).toBe(false);
      expect(result.code).toBe('CSRF_ORIGIN_MISMATCH');
    });

    it('wrong port is rejected', () => {
      const result = validateCsrf('POST', true, 'https://prisnames.com:8080', undefined, ALLOWED_ORIGINS);
      expect(result.allowed).toBe(false);
      expect(result.code).toBe('CSRF_ORIGIN_MISMATCH');
    });

    it('subdomain is rejected when not in allowed list', () => {
      const result = validateCsrf('POST', true, 'https://api.prisnames.com', undefined, ALLOWED_ORIGINS);
      expect(result.allowed).toBe(false);
      expect(result.code).toBe('CSRF_ORIGIN_MISMATCH');
    });

    it('origin with trailing slash is rejected (not exact match)', () => {
      const result = validateCsrf('POST', true, 'https://prisnames.com/', undefined, ALLOWED_ORIGINS);
      expect(result.allowed).toBe(false);
    });
  });

  describe('referer fallback', () => {
    it('valid referer origin is allowed when Origin is missing', () => {
      const result = validateCsrf('POST', true, undefined, 'https://prisnames.com/auth/login', ALLOWED_ORIGINS);
      expect(result.allowed).toBe(true);
    });

    it('evil referer is rejected', () => {
      const result = validateCsrf('POST', true, undefined, 'https://evil.com/attack', ALLOWED_ORIGINS);
      expect(result.allowed).toBe(false);
      expect(result.code).toBe('CSRF_REFERER_MISMATCH');
    });

    it('invalid referer URL is rejected', () => {
      const result = validateCsrf('POST', true, undefined, 'not-a-url', ALLOWED_ORIGINS);
      expect(result.allowed).toBe(false);
      expect(result.code).toBe('CSRF_REFERER_INVALID');
    });
  });

  describe('missing Origin AND Referer on cookie-authenticated mutating requests', () => {
    it('REJECTS POST with no Origin and no Referer', () => {
      const result = validateCsrf('POST', true, undefined, undefined, ALLOWED_ORIGINS);
      expect(result.allowed).toBe(false);
      expect(result.code).toBe('CSRF_MISSING_ORIGIN');
    });

    it('REJECTS PUT with no Origin and no Referer', () => {
      const result = validateCsrf('PUT', true, undefined, undefined, ALLOWED_ORIGINS);
      expect(result.allowed).toBe(false);
      expect(result.code).toBe('CSRF_MISSING_ORIGIN');
    });

    it('REJECTS PATCH with no Origin and no Referer', () => {
      const result = validateCsrf('PATCH', true, undefined, undefined, ALLOWED_ORIGINS);
      expect(result.allowed).toBe(false);
      expect(result.code).toBe('CSRF_MISSING_ORIGIN');
    });

    it('REJECTS DELETE with no Origin and no Referer', () => {
      const result = validateCsrf('DELETE', true, undefined, undefined, ALLOWED_ORIGINS);
      expect(result.allowed).toBe(false);
      expect(result.code).toBe('CSRF_MISSING_ORIGIN');
    });
  });

  describe('development origins', () => {
    const devOrigins = ['http://localhost:3000'];

    it('localhost with correct port is allowed in dev mode', () => {
      const result = validateCsrf('POST', true, 'http://localhost:3000', undefined, devOrigins);
      expect(result.allowed).toBe(true);
    });

    it('localhost with wrong port is rejected', () => {
      const result = validateCsrf('POST', true, 'http://localhost:4000', undefined, devOrigins);
      expect(result.allowed).toBe(false);
    });
  });
});
