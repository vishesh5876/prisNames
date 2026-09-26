/**
 * Centralized session cookie name configuration.
 *
 * Used by:
 * - API (auth guard, cookie config)
 * - Web (proxy.ts, auth DAL)
 * - Tests
 *
 * Contains no authentication secrets — safe to share across packages.
 */

/** Production cookie name (__Host- prefix requires Secure, Path=/, no Domain) */
export const SESSION_COOKIE_NAME = '__Host-prisnames_sid';

/** Development cookie name (no __Host- since Secure is not set locally) */
export const SESSION_COOKIE_NAME_DEV = 'prisnames_sid';

/**
 * Get the appropriate session cookie name for the current environment.
 */
export function getSessionCookieName(nodeEnv?: string): string {
  const env = nodeEnv || process.env.NODE_ENV || 'development';
  return env === 'production' ? SESSION_COOKIE_NAME : SESSION_COOKIE_NAME_DEV;
}

/**
 * Get all possible session cookie names for checking existence.
 * Useful when you need to detect any session cookie regardless of environment.
 */
export function getAllSessionCookieNames(): readonly string[] {
  return [SESSION_COOKIE_NAME, SESSION_COOKIE_NAME_DEV] as const;
}
