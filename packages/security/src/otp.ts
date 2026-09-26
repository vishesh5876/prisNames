/**
 * PrisNames — OTP Generation & Verification
 *
 * Uses HMAC-SHA256 with a dedicated pepper for OTP hashing.
 * Plain SHA-256 is NOT used because a 6-digit OTP has a tiny search space
 * (1M possibilities) and can be brute-forced trivially if the DB is compromised.
 *
 * NEVER log: OTP values, OTP hashes.
 */

import { randomInt } from 'node:crypto';
import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Generate a cryptographically secure 6-digit OTP.
 *
 * Uses crypto.randomInt with exclusive upper bound:
 * randomInt(100000, 1000000) produces values from 100000 to 999999.
 *
 * Always returns exactly 6 digits (zero-padded if needed, though
 * randomInt(100000, 1000000) guarantees 6 digits naturally).
 */
export function generateOtp(): string {
  const num = randomInt(100000, 1000000);
  return num.toString().padStart(6, '0');
}

/**
 * Hash an OTP using HMAC-SHA256 with a dedicated pepper.
 *
 * @param otp - The 6-digit OTP string
 * @param pepper - The AUTH_OTP_PEPPER secret from environment
 * @returns Hex-encoded HMAC-SHA256 digest
 */
export function hashOtp(otp: string, pepper: string): string {
  return createHmac('sha256', pepper).update(otp).digest('hex');
}

/**
 * Verify an OTP against its HMAC-SHA256 hash using constant-time comparison.
 *
 * @param otp - The candidate OTP to verify
 * @param hash - The stored HMAC-SHA256 hex hash
 * @param pepper - The AUTH_OTP_PEPPER secret
 * @returns true if the OTP matches
 */
export function verifyOtp(otp: string, hash: string, pepper: string): boolean {
  const candidateHash = hashOtp(otp, pepper);
  const a = Buffer.from(candidateHash, 'hex');
  const b = Buffer.from(hash, 'hex');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
