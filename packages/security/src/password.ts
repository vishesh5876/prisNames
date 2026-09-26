/**
 * PrisNames — Password Hashing (Argon2id)
 *
 * Centralized password hashing parameters per AUTH.md §4.1.
 * Uses Argon2id for hybrid resistance to side-channel + GPU attacks.
 *
 * NEVER log: plaintext passwords, password hashes.
 */

import argon2 from 'argon2';

/**
 * Centralized Argon2id parameters.
 * Change these to trigger automatic rehashing on next verification.
 */
export const ARGON2_CONFIG = {
  type: argon2.argon2id,
  memoryCost: 65536, // 64 MB (OWASP recommended minimum)
  timeCost: 3, // Iterations
  parallelism: 4, // Parallel threads
  hashLength: 32, // Output length in bytes
} as const;

/**
 * Hash a password using Argon2id with centralized parameters.
 * Returns the encoded Argon2 hash string (includes salt, params, hash).
 */
export async function hashPassword(plaintext: string): Promise<string> {
  return argon2.hash(plaintext, ARGON2_CONFIG);
}

/**
 * Verify a password against an Argon2id hash.
 *
 * Returns both the verification result and whether the hash
 * should be rehashed (parameters have changed since it was created).
 */
export async function verifyPassword(
  plaintext: string,
  hash: string,
): Promise<{ valid: boolean; needsRehash: boolean }> {
  const valid = await argon2.verify(hash, plaintext);
  const needsRehash = valid ? argon2.needsRehash(hash, ARGON2_CONFIG) : false;
  return { valid, needsRehash };
}

/**
 * Pre-computed dummy hash for timing-safe login.
 *
 * When an email doesn't exist, we still run Argon2id verification
 * against this dummy hash so the response time is approximately equal
 * to a real password check. This prevents timing-based user enumeration.
 *
 * Generated once at module load. Not a secret — it's just a hash of a
 * random string to provide consistent Argon2 verification cost.
 */
let _dummyHash: string | null = null;

export async function getDummyHash(): Promise<string> {
  if (!_dummyHash) {
    _dummyHash = await hashPassword(
      'dummy-password-for-timing-safe-enumeration-prevention',
    );
  }
  return _dummyHash;
}
