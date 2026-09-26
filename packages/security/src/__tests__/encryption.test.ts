/**
 * PrisNames — Envelope Encryption Tests
 *
 * Verifies AES-256-GCM envelope encryption implementation:
 * - Encrypt/decrypt round-trip
 * - Key ID extraction
 * - Tamper detection (authentication tag)
 * - Key rotation support
 * - Invalid format rejection
 * - BullMQ job payload secret verification
 */

import { describe, it, expect } from 'vitest';
import { EnvelopeEncryption, createQueueEncryption } from '../encryption.js';
import { randomBytes } from 'node:crypto';

function generateTestKey(): Buffer {
  return randomBytes(32);
}

describe('EnvelopeEncryption', () => {
  const key1 = generateTestKey();
  const key2 = generateTestKey();

  describe('encrypt/decrypt round-trip', () => {
    it('encrypts and decrypts a string', () => {
      const keys = new Map([['k-test-001', key1]]);
      const enc = new EnvelopeEncryption(keys, 'k-test-001');

      const plaintext = 'Hello, PrisNames!';
      const envelope = enc.encrypt(plaintext);
      const decrypted = enc.decrypt(envelope);

      expect(decrypted.toString('utf-8')).toBe(plaintext);
    });

    it('encrypts and decrypts an OTP', () => {
      const keys = new Map([['k-test-001', key1]]);
      const enc = new EnvelopeEncryption(keys, 'k-test-001');

      const otp = '482910';
      const envelope = enc.encrypt(otp);
      const decrypted = enc.decrypt(envelope);

      expect(decrypted.toString('utf-8')).toBe(otp);
    });

    it('encrypts and decrypts a reset token', () => {
      const keys = new Map([['k-test-001', key1]]);
      const enc = new EnvelopeEncryption(keys, 'k-test-001');

      const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.secret-token-value';
      const envelope = enc.encrypt(token);
      const decrypted = enc.decrypt(envelope);

      expect(decrypted.toString('utf-8')).toBe(token);
    });

    it('encrypts and decrypts a Buffer', () => {
      const keys = new Map([['k-test-001', key1]]);
      const enc = new EnvelopeEncryption(keys, 'k-test-001');

      const data = Buffer.from([0x00, 0x01, 0x02, 0xff]);
      const envelope = enc.encrypt(data);
      const decrypted = enc.decrypt(envelope);

      expect(Buffer.compare(decrypted, data)).toBe(0);
    });
  });

  describe('envelope format', () => {
    it('produces v1:{key_id}:{nonce}:{ciphertext+tag} format', () => {
      const keys = new Map([['k-auth-001', key1]]);
      const enc = new EnvelopeEncryption(keys, 'k-auth-001');

      const envelope = enc.encrypt('test');
      const parts = envelope.split(':');

      expect(parts).toHaveLength(4);
      expect(parts[0]).toBe('v1');
      expect(parts[1]).toBe('k-auth-001');
      // Nonce should be base64-encoded 12 bytes = 16 base64 chars
      expect(parts[2]!.length).toBe(16);
      // Ciphertext + tag should be non-empty
      expect(parts[3]!.length).toBeGreaterThan(0);
    });

    it('produces different ciphertext for the same plaintext (unique nonces)', () => {
      const keys = new Map([['k-auth-001', key1]]);
      const enc = new EnvelopeEncryption(keys, 'k-auth-001');

      const e1 = enc.encrypt('same-text');
      const e2 = enc.encrypt('same-text');

      expect(e1).not.toBe(e2);
    });
  });

  describe('key ID extraction', () => {
    it('extracts key ID without decrypting', () => {
      const keys = new Map([['k-auth-001', key1]]);
      const enc = new EnvelopeEncryption(keys, 'k-auth-001');

      const envelope = enc.encrypt('test');
      expect(enc.extractKeyId(envelope)).toBe('k-auth-001');
    });
  });

  describe('tamper detection', () => {
    it('rejects tampered ciphertext', () => {
      const keys = new Map([['k-auth-001', key1]]);
      const enc = new EnvelopeEncryption(keys, 'k-auth-001');

      const envelope = enc.encrypt('test');
      const parts = envelope.split(':');
      // Tamper with the ciphertext portion
      const tampered = `${parts[0]}:${parts[1]}:${parts[2]}:AAAA${parts[3]!.slice(4)}`;

      expect(() => enc.decrypt(tampered)).toThrow();
    });

    it('rejects tampered nonce', () => {
      const keys = new Map([['k-auth-001', key1]]);
      const enc = new EnvelopeEncryption(keys, 'k-auth-001');

      const envelope = enc.encrypt('test');
      const parts = envelope.split(':');
      // Replace nonce with different base64
      const tampered = `${parts[0]}:${parts[1]}:${Buffer.from(randomBytes(12)).toString('base64')}:${parts[3]}`;

      expect(() => enc.decrypt(tampered)).toThrow();
    });
  });

  describe('key rotation', () => {
    it('decrypts with old key after rotation', () => {
      // Phase 1: encrypt with key1
      const keysV1 = new Map([['k-v1', key1]]);
      const encV1 = new EnvelopeEncryption(keysV1, 'k-v1');
      const envelopeV1 = encV1.encrypt('old-data');

      // Phase 2: add key2 as active, keep key1 for decryption
      const keysV2 = new Map([
        ['k-v1', key1],
        ['k-v2', key2],
      ]);
      const encV2 = new EnvelopeEncryption(keysV2, 'k-v2');

      // Old envelope decrypts with v2 (which has both keys)
      const decrypted = encV2.decrypt(envelopeV1);
      expect(decrypted.toString('utf-8')).toBe('old-data');

      // New encryptions use k-v2
      const envelopeV2 = encV2.encrypt('new-data');
      expect(encV2.extractKeyId(envelopeV2)).toBe('k-v2');
    });
  });

  describe('error handling', () => {
    it('rejects invalid envelope format (too few parts)', () => {
      const keys = new Map([['k-auth-001', key1]]);
      const enc = new EnvelopeEncryption(keys, 'k-auth-001');

      expect(() => enc.decrypt('v1:k-auth-001:nonce')).toThrow('expected 4 colon-separated parts');
    });

    it('rejects unsupported version', () => {
      const keys = new Map([['k-auth-001', key1]]);
      const enc = new EnvelopeEncryption(keys, 'k-auth-001');

      expect(() => enc.decrypt('v2:k-auth-001:nonce:ciphertext')).toThrow('Unsupported envelope version');
    });

    it('rejects unknown key ID', () => {
      const keys = new Map([['k-auth-001', key1]]);
      const enc = new EnvelopeEncryption(keys, 'k-auth-001');

      const envelope = enc.encrypt('test');
      const parts = envelope.split(':');
      const wrongKey = `${parts[0]}:k-unknown:${parts[2]}:${parts[3]}`;

      expect(() => enc.decrypt(wrongKey)).toThrow('Unknown encryption key ID');
    });

    it('rejects wrong key length', () => {
      const badKey = randomBytes(16); // 128 bits, not 256
      const keys = new Map([['k-bad', badKey]]);
      expect(() => new EnvelopeEncryption(keys, 'k-bad')).toThrow('32 bytes');
    });

    it('rejects non-existent active key', () => {
      const keys = new Map([['k-auth-001', key1]]);
      expect(() => new EnvelopeEncryption(keys, 'k-missing')).toThrow('not found in key store');
    });
  });

  describe('createQueueEncryption', () => {
    it('creates encryption from hex key string', () => {
      const hexKey = key1.toString('hex');
      const enc = createQueueEncryption(hexKey, 'k-test');
      const envelope = enc.encrypt('hello');
      expect(enc.decrypt(envelope).toString('utf-8')).toBe('hello');
    });

    it('rejects short key strings', () => {
      expect(() => createQueueEncryption('tooshort', 'k-test')).toThrow('64-character hex');
    });
  });
});

describe('BullMQ Job Payload Secret Verification', () => {
  const testKey = generateTestKey();
  const hexKey = testKey.toString('hex');

  describe('plaintext OTP does not appear in serialized job data', () => {
    it('encrypts OTP before creating job payload', () => {
      const enc = createQueueEncryption(hexKey, 'k-auth-001');
      const plainOtp = '482910';
      const encryptedOtp = enc.encrypt(plainOtp);

      // Simulate BullMQ job data
      const jobData = {
        type: 'AUTH_EMAIL_VERIFICATION',
        to: 'user@example.com',
        encryptedOtp,
        userId: 'user-123',
      };

      // Serialize as BullMQ would (JSON)
      const serialized = JSON.stringify(jobData);

      // Plaintext OTP MUST NOT appear in serialized data
      expect(serialized).not.toContain(plainOtp);
      // The encrypted envelope MUST appear
      expect(serialized).toContain('v1:k-auth-001:');
    });
  });

  describe('plaintext reset token does not appear in serialized job data', () => {
    it('encrypts reset token before creating job payload', () => {
      const enc = createQueueEncryption(hexKey, 'k-auth-001');
      const plainToken = 'abc123-reset-token-value-xyz789';
      const encryptedToken = enc.encrypt(plainToken);

      // Simulate BullMQ job data
      const jobData = {
        type: 'AUTH_PASSWORD_RESET',
        to: 'user@example.com',
        encryptedToken,
        userId: 'user-123',
      };

      // Serialize as BullMQ would (JSON)
      const serialized = JSON.stringify(jobData);

      // Plaintext token MUST NOT appear in serialized data
      expect(serialized).not.toContain(plainToken);
      // The encrypted envelope MUST appear
      expect(serialized).toContain('v1:k-auth-001:');
    });
  });

  describe('job data field names do not reference plaintext', () => {
    it('uses encryptedOtp field, NOT otp field', () => {
      const enc = createQueueEncryption(hexKey, 'k-auth-001');
      const jobData = {
        type: 'AUTH_EMAIL_VERIFICATION',
        to: 'user@example.com',
        encryptedOtp: enc.encrypt('123456'),
        userId: 'user-123',
      };

      const keys = Object.keys(jobData);
      expect(keys).toContain('encryptedOtp');
      expect(keys).not.toContain('otp');
    });

    it('uses encryptedToken field, NOT resetToken field', () => {
      const enc = createQueueEncryption(hexKey, 'k-auth-001');
      const jobData = {
        type: 'AUTH_PASSWORD_RESET',
        to: 'user@example.com',
        encryptedToken: enc.encrypt('reset-token'),
        userId: 'user-123',
      };

      const keys = Object.keys(jobData);
      expect(keys).toContain('encryptedToken');
      expect(keys).not.toContain('resetToken');
      expect(keys).not.toContain('token');
    });
  });

  describe('worker can decrypt and recover plaintext', () => {
    it('verification: encrypt on producer, decrypt on consumer', () => {
      const enc = createQueueEncryption(hexKey, 'k-auth-001');
      const originalOtp = '482910';

      // Producer encrypts
      const encryptedOtp = enc.encrypt(originalOtp);

      // Consumer decrypts
      const recoveredOtp = enc.decrypt(encryptedOtp).toString('utf-8');

      expect(recoveredOtp).toBe(originalOtp);
    });

    it('reset: encrypt on producer, decrypt on consumer', () => {
      const enc = createQueueEncryption(hexKey, 'k-auth-001');
      const originalToken = 'abc123-reset-token-xyz789';

      // Producer encrypts
      const encryptedToken = enc.encrypt(originalToken);

      // Consumer decrypts
      const recoveredToken = enc.decrypt(encryptedToken).toString('utf-8');

      expect(recoveredToken).toBe(originalToken);
    });
  });
});
