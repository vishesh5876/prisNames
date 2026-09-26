/**
 * PrisNames — Secure Token Generation
 *
 * For password reset tokens (high-entropy, random).
 * SHA-256 is acceptable for these because the token space is 256 bits (2^256).
 *
 * NEVER log: raw tokens, token hashes.
 */

import { randomBytes, createHash } from 'node:crypto';

/**
 * Generate a cryptographically secure random token.
 *
 * @param bytes - Number of random bytes (default 32 = 256 bits)
 * @returns Base64url-encoded token string
 */
export function generateSecureToken(bytes: number = 32): string {
  return randomBytes(bytes).toString('base64url');
}

/**
 * Hash a token using SHA-256.
 *
 * Safe for high-entropy tokens (password reset tokens, session tokens)
 * where the search space is astronomically large.
 *
 * NOT safe for low-entropy values like OTPs — use HMAC-SHA256 with pepper instead.
 *
 * @returns Hex-encoded SHA-256 digest (64 characters)
 */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
