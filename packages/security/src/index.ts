/**
 * PrisNames — Security Package
 *
 * Pure security primitives. No NestJS dependencies.
 * Consumers: apps/api, apps/worker
 */

// Password hashing (Argon2id)
export {
  hashPassword,
  verifyPassword,
  getDummyHash,
  ARGON2_CONFIG,
} from './password.js';

// OTP generation & HMAC-SHA256 verification
export { generateOtp, hashOtp, verifyOtp } from './otp.js';

// Secure token generation & SHA-256 hashing
export { generateSecureToken, hashToken } from './token.js';

// Session token generation & hashing
export { generateSessionToken, hashSessionToken } from './session.js';

// Email normalization
export { normalizeEmail } from './email.js';

// Envelope encryption (AES-256-GCM)
export { EnvelopeEncryption, createQueueEncryption } from './encryption.js';
