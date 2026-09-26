import { describe, it, expect } from 'vitest';
import { generateSessionToken, hashSessionToken } from '../session.js';

describe('session', () => {
  it('should generate a base64url session token', () => {
    const token = generateSessionToken();
    // 48 bytes → 64 chars in base64url
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(token.length).toBe(64);
  });

  it('should generate unique session tokens', () => {
    const tokens = new Set<string>();
    for (let i = 0; i < 100; i++) {
      tokens.add(generateSessionToken());
    }
    expect(tokens.size).toBe(100);
  });

  it('should hash session token to a 64-char hex SHA-256', () => {
    const token = generateSessionToken();
    const hash = hashSessionToken(token);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash.length).toBe(64);
  });

  it('should produce consistent hashes', () => {
    const token = generateSessionToken();
    expect(hashSessionToken(token)).toBe(hashSessionToken(token));
  });

  it('should produce different hashes for different tokens', () => {
    const t1 = generateSessionToken();
    const t2 = generateSessionToken();
    expect(hashSessionToken(t1)).not.toBe(hashSessionToken(t2));
  });
});
