/**
 * PrisNames — Envelope Encryption
 *
 * Implements the versioned encryption-envelope from ENCRYPTION_ENVELOPE.md.
 * AES-256-GCM with authenticated ciphertext, key rotation support.
 *
 * Envelope format: v1:{key_id}:{nonce_b64}:{ciphertext_and_tag_b64}
 *
 * Usage:
 *   const enc = new EnvelopeEncryption({ 'k-auth-001': keyBuffer }, 'k-auth-001');
 *   const sealed = enc.encrypt('secret');       // → "v1:k-auth-001:..."
 *   const plain  = enc.decrypt(sealed);         // → Buffer<secret>
 *
 * SECURITY:
 * - Keys are NEVER stored in Redis or the database
 * - Keys come from environment variables only
 * - Unique 12-byte nonce per encryption (random)
 * - GCM authentication tag prevents tampering
 * - Key ID in envelope enables transparent rotation
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const NONCE_LENGTH = 12; // 96 bits
const TAG_LENGTH = 16;   // 128 bits
const ENVELOPE_VERSION = 'v1';

export interface EnvelopeEncryptionConfig {
  /** Map of key IDs to 32-byte key buffers */
  keys: Map<string, Buffer>;
  /** Active key ID for new encryptions */
  activeKeyId: string;
}

export class EnvelopeEncryption {
  private readonly keys: Map<string, Buffer>;
  private readonly activeKeyId: string;

  constructor(keys: Map<string, Buffer>, activeKeyId: string) {
    if (!keys.has(activeKeyId)) {
      throw new Error(`Active key ID "${activeKeyId}" not found in key store`);
    }
    const activeKey = keys.get(activeKeyId)!;
    if (activeKey.length !== 32) {
      throw new Error(`Encryption key must be exactly 32 bytes (got ${activeKey.length})`);
    }
    this.keys = keys;
    this.activeKeyId = activeKeyId;
  }

  /**
   * Encrypt plaintext using the active key.
   * Returns envelope string: "v1:{key_id}:{nonce_b64}:{ciphertext+tag_b64}"
   */
  encrypt(plaintext: string | Buffer): string {
    const key = this.keys.get(this.activeKeyId)!;
    const nonce = randomBytes(NONCE_LENGTH);

    const cipher = createCipheriv(ALGORITHM, key, nonce, { authTagLength: TAG_LENGTH });
    const encrypted = Buffer.concat([
      cipher.update(typeof plaintext === 'string' ? Buffer.from(plaintext, 'utf-8') : plaintext),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();

    // Concatenate ciphertext + tag
    const ctAndTag = Buffer.concat([encrypted, tag]);

    return `${ENVELOPE_VERSION}:${this.activeKeyId}:${nonce.toString('base64')}:${ctAndTag.toString('base64')}`;
  }

  /**
   * Decrypt an envelope string.
   * Extracts key_id, fetches the key, authenticates, and decrypts.
   */
  decrypt(envelope: string): Buffer {
    const parts = envelope.split(':');
    if (parts.length !== 4) {
      throw new Error('Invalid envelope format: expected 4 colon-separated parts');
    }

    const [version, keyId, nonceB64, ctAndTagB64] = parts;

    if (version !== ENVELOPE_VERSION) {
      throw new Error(`Unsupported envelope version: ${version}`);
    }

    const key = this.keys.get(keyId!);
    if (!key) {
      throw new Error(`Unknown encryption key ID: ${keyId}`);
    }

    const nonce = Buffer.from(nonceB64!, 'base64');
    if (nonce.length !== NONCE_LENGTH) {
      throw new Error(`Invalid nonce length: ${nonce.length}`);
    }

    const ctAndTag = Buffer.from(ctAndTagB64!, 'base64');
    if (ctAndTag.length < TAG_LENGTH) {
      throw new Error('Ciphertext too short to contain authentication tag');
    }

    const ciphertext = ctAndTag.subarray(0, ctAndTag.length - TAG_LENGTH);
    const tag = ctAndTag.subarray(ctAndTag.length - TAG_LENGTH);

    const decipher = createDecipheriv(ALGORITHM, key, nonce, { authTagLength: TAG_LENGTH });
    decipher.setAuthTag(tag);

    const decrypted = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);

    return decrypted;
  }

  /**
   * Extract key_id from an envelope without decrypting.
   */
  extractKeyId(envelope: string): string {
    const parts = envelope.split(':');
    if (parts.length !== 4 || parts[0] !== ENVELOPE_VERSION) {
      throw new Error('Invalid envelope format');
    }
    return parts[1]!;
  }

  /**
   * Get the active key ID.
   */
  getActiveKeyId(): string {
    return this.activeKeyId;
  }
}

/**
 * Create an EnvelopeEncryption instance from environment variables.
 *
 * Expects:
 * - QUEUE_ENCRYPTION_KEY: hex-encoded 32-byte key for auth email queue
 * - QUEUE_ENCRYPTION_KEY_ID: key identifier (default: 'k-auth-001')
 */
export function createQueueEncryption(
  keyHex: string,
  keyId: string = 'k-auth-001',
): EnvelopeEncryption {
  if (!keyHex || keyHex.length < 64) {
    throw new Error(
      'QUEUE_ENCRYPTION_KEY must be a 64-character hex string (32 bytes). ' +
      'Generate with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    );
  }
  const keyBuffer = Buffer.from(keyHex, 'hex');
  const keys = new Map<string, Buffer>();
  keys.set(keyId, keyBuffer);
  return new EnvelopeEncryption(keys, keyId);
}
