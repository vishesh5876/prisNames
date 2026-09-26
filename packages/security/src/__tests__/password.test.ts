import { describe, it, expect } from 'vitest';
import {
  hashPassword,
  verifyPassword,
  getDummyHash,
  ARGON2_CONFIG,
} from '../password.js';

describe('password', () => {
  it('should hash a password and return an argon2 encoded string', async () => {
    const hash = await hashPassword('MyStrongP@ssword1');
    expect(hash).toMatch(/^\$argon2id\$/);
  });

  it('should verify a correct password', async () => {
    const hash = await hashPassword('CorrectPassword123');
    const result = await verifyPassword('CorrectPassword123', hash);
    expect(result.valid).toBe(true);
    expect(result.needsRehash).toBe(false);
  });

  it('should reject an incorrect password', async () => {
    const hash = await hashPassword('CorrectPassword123');
    const result = await verifyPassword('WrongPassword456', hash);
    expect(result.valid).toBe(false);
    expect(result.needsRehash).toBe(false);
  });

  it('should produce different hashes for the same password (random salt)', async () => {
    const hash1 = await hashPassword('SamePassword');
    const hash2 = await hashPassword('SamePassword');
    expect(hash1).not.toBe(hash2);
    // Both should still verify
    expect((await verifyPassword('SamePassword', hash1)).valid).toBe(true);
    expect((await verifyPassword('SamePassword', hash2)).valid).toBe(true);
  });

  it('should have correct Argon2id config parameters', () => {
    expect(ARGON2_CONFIG.memoryCost).toBe(65536);
    expect(ARGON2_CONFIG.timeCost).toBe(3);
    expect(ARGON2_CONFIG.parallelism).toBe(4);
    expect(ARGON2_CONFIG.hashLength).toBe(32);
  });

  it('should return a consistent dummy hash for anti-enumeration', async () => {
    const h1 = await getDummyHash();
    const h2 = await getDummyHash();
    expect(h1).toBe(h2);
    expect(h1).toMatch(/^\$argon2id\$/);
  });
});
