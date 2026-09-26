/**
 * PrisNames — Cookie Configuration
 *
 * Centralized session cookie configuration.
 * @fastify/cookie uses seconds for maxAge (correction 13).
 * Prefers host-only cookie (no Domain attribute) with __Host- prefix in production (correction 14).
 */

import { getEnv } from '@prisnames/config';
import { SESSION_COOKIE_NAME, SESSION_COOKIE_NAME_DEV } from '@prisnames/config';

export interface CookieConfig {
  name: string;
  options: {
    httpOnly: boolean;
    secure: boolean;
    sameSite: 'lax' | 'strict' | 'none';
    path: string;
    maxAge: number; // seconds (NOT milliseconds — @fastify/cookie uses seconds)
    domain?: string;
  };
}

export function getSessionCookieConfig(): CookieConfig {
  const env = getEnv();
  const isProduction = env.NODE_ENV === 'production';

  return {
    // Use __Host- prefix in production (requires: Secure, Path=/, no Domain)
    name: isProduction ? SESSION_COOKIE_NAME : SESSION_COOKIE_NAME_DEV,
    options: {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
      maxAge: env.SESSION_MAX_AGE_SECONDS, // seconds, NOT ms (correction 13)
      // No Domain attribute → host-only cookie (correction 14)
    },
  };
}

/**
 * Get cookie options for clearing the session cookie.
 */
export function getClearCookieConfig(): CookieConfig {
  const config = getSessionCookieConfig();
  return {
    ...config,
    options: {
      ...config.options,
      maxAge: 0,
    },
  };
}
