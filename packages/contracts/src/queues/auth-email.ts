/**
 * PrisNames — Auth Email Queue Constants
 *
 * Shared between API (producer) and Worker (consumer).
 * Only auth-required email jobs are defined in Phase 3:
 * - AUTH_EMAIL_VERIFICATION
 * - AUTH_PASSWORD_RESET
 *
 * SECURITY:
 * - Sensitive delivery material (OTP, reset token) is encrypted using
 *   the versioned envelope encryption (AES-256-GCM) before being placed
 *   in Redis job payloads.
 * - Plaintext secrets NEVER exist in BullMQ job data.
 * - The encryption key is stored in environment variables, NEVER in Redis.
 * - Encrypted payloads are redacted from logs.
 */

export const AUTH_EMAIL_QUEUE = 'auth-email';

export const AUTH_EMAIL_JOBS = {
  VERIFICATION: 'AUTH_EMAIL_VERIFICATION',
  PASSWORD_RESET: 'AUTH_PASSWORD_RESET',
} as const;

export type AuthEmailJobType = (typeof AUTH_EMAIL_JOBS)[keyof typeof AUTH_EMAIL_JOBS];

/**
 * Verification email job data.
 * `encryptedOtp` contains the AES-256-GCM encrypted envelope — never plaintext.
 */
export interface VerificationEmailJobData {
  type: typeof AUTH_EMAIL_JOBS.VERIFICATION;
  to: string;
  /** AES-256-GCM envelope: "v1:{key_id}:{nonce}:{ciphertext+tag}" */
  encryptedOtp: string;
  userId: string;
}

/**
 * Password reset email job data.
 * `encryptedToken` contains the AES-256-GCM encrypted envelope — never plaintext.
 */
export interface ResetEmailJobData {
  type: typeof AUTH_EMAIL_JOBS.PASSWORD_RESET;
  to: string;
  /** AES-256-GCM envelope: "v1:{key_id}:{nonce}:{ciphertext+tag}" */
  encryptedToken: string;
  userId: string;
}

export type AuthEmailJobData = VerificationEmailJobData | ResetEmailJobData;

/**
 * Auth email job retention policy.
 * Aggressive cleanup since jobs contain encrypted auth material.
 */
export const AUTH_EMAIL_JOB_RETENTION = {
  /** Max completed jobs retained (for debugging) */
  removeOnComplete: { count: 100, age: 3600 },
  /** Max failed jobs retained (for debugging, manual retry) */
  removeOnFail: { count: 500, age: 86400 },
  /** Maximum retry attempts */
  attempts: 3,
  /** Exponential backoff starting at 2s */
  backoff: { type: 'exponential' as const, delay: 2000 },
} as const;
