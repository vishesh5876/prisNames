/**
 * PrisNames — Cookie Configuration Tests
 *
 * Verifies session cookie configuration for development and production:
 * - Cookie names (__Host- prefix in production, plain in dev)
 * - HttpOnly flag always set
 * - Secure flag (production only)
 * - SameSite=Lax
 * - Path=/
 * - Max-Age in seconds (not milliseconds)
 * - No Domain attribute (host-only cookie)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// We need to mock getEnv before importing cookie.config
const mockEnv = {
  NODE_ENV: 'development' as 'development' | 'production',
  COOKIE_DOMAIN: 'localhost',
  SESSION_MAX_AGE_SECONDS: 604800,
};

vi.mock('@prisnames/config', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@prisnames/config')>();
  return {
    ...actual,
    getEnv: () => mockEnv,
  };
});

// Import after mock
const { getSessionCookieConfig, getClearCookieConfig } = await import('../cookie.config.js');

describe('Cookie Configuration', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('development mode', () => {
    beforeEach(() => {
      mockEnv.NODE_ENV = 'development';
    });

    it('uses plain cookie name (no __Host- prefix)', () => {
      const config = getSessionCookieConfig();
      expect(config.name).toBe('prisnames_sid');
      expect(config.name).not.toContain('__Host-');
    });

    it('sets HttpOnly=true', () => {
      expect(getSessionCookieConfig().options.httpOnly).toBe(true);
    });

    it('sets Secure=false in dev', () => {
      expect(getSessionCookieConfig().options.secure).toBe(false);
    });

    it('sets SameSite=lax', () => {
      expect(getSessionCookieConfig().options.sameSite).toBe('lax');
    });

    it('sets Path=/', () => {
      expect(getSessionCookieConfig().options.path).toBe('/');
    });

    it('sets Max-Age in seconds', () => {
      const config = getSessionCookieConfig();
      expect(config.options.maxAge).toBe(604800);
      // Verify it's not milliseconds (would be 604800000)
      expect(config.options.maxAge).toBeLessThan(1000000);
    });

    it('does not set Domain attribute (host-only cookie)', () => {
      const config = getSessionCookieConfig();
      expect(config.options.domain).toBeUndefined();
    });
  });

  describe('production mode', () => {
    beforeEach(() => {
      mockEnv.NODE_ENV = 'production';
    });

    it('uses __Host- prefixed cookie name', () => {
      const config = getSessionCookieConfig();
      expect(config.name).toBe('__Host-prisnames_sid');
    });

    it('sets HttpOnly=true', () => {
      expect(getSessionCookieConfig().options.httpOnly).toBe(true);
    });

    it('sets Secure=true', () => {
      expect(getSessionCookieConfig().options.secure).toBe(true);
    });

    it('sets SameSite=lax', () => {
      expect(getSessionCookieConfig().options.sameSite).toBe('lax');
    });

    it('sets Path=/', () => {
      expect(getSessionCookieConfig().options.path).toBe('/');
    });
  });

  describe('clear cookie config', () => {
    beforeEach(() => {
      mockEnv.NODE_ENV = 'development';
    });

    it('sets maxAge to 0', () => {
      const config = getClearCookieConfig();
      expect(config.options.maxAge).toBe(0);
    });

    it('preserves other cookie options', () => {
      const config = getClearCookieConfig();
      expect(config.options.httpOnly).toBe(true);
      expect(config.options.sameSite).toBe('lax');
      expect(config.options.path).toBe('/');
    });
  });
});
