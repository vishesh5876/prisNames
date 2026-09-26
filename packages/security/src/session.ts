/**
 * PrisNames — Session Token Generation
 *
 * Cryptographically random opaque session tokens.
 * The raw token goes in the HttpOnly cookie.
 * Only the SHA-256 hash is stored in sessions.token_hash.
 *
 * NEVER log: raw session tokens, session token hashes.
 */

import { randomBytes, createHash } from 'node:crypto';

/**
 * Generate a cryptographically random opaque session token.
 * 48 bytes = 384 bits of entropy, base64url-encoded.
 *
 * @returns Base64url-encoded session token (64 characters)
 */
export function generateSessionToken(): string {
  return randomBytes(48).toString('base64url');
}

/**
 * Hash a session token using SHA-256.
 * The hash is stored in sessions.token_hash for lookup.
 *
 * @returns Hex-encoded SHA-256 digest (64 characters, matches token_hash varchar(64))
 */
export function hashSessionToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
