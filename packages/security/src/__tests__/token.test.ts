import { describe, it, expect } from 'vitest';
import { generateSecureToken, hashToken } from '../token.js';

describe('token', () => {
  it('should generate a base64url token of appropriate length', () => {
    const token = generateSecureToken();
    // 32 bytes → 43 chars in base64url (no padding)
    expect(token.length).toBeGreaterThanOrEqual(40);
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('should generate unique tokens', () => {
    const tokens = new Set<string>();
    for (let i = 0; i < 100; i++) {
      tokens.add(generateSecureToken());
    }
    expect(tokens.size).toBe(100);
  });

  it('should accept custom byte length', () => {
    const short = generateSecureToken(16);
    const long = generateSecureToken(64);
    expect(short.length).toBeLessThan(long.length);
  });

  it('should hash token to a 64-char hex string (SHA-256)', () => {
    const token = generateSecureToken();
    const hash = hashToken(token);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('should produce consistent hashes for the same token', () => {
    const token = 'test-token-value';
    expect(hashToken(token)).toBe(hashToken(token));
  });

  it('should produce different hashes for different tokens', () => {
    const h1 = hashToken('token-a');
    const h2 = hashToken('token-b');
    expect(h1).not.toBe(h2);
  });
});
