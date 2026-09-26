import { describe, it, expect } from 'vitest';
import { normalizeEmail } from '../email.js';

describe('normalizeEmail', () => {
  it('should lowercase the email', () => {
    expect(normalizeEmail('John@Example.COM')).toBe('john@example.com');
  });

  it('should trim surrounding whitespace', () => {
    expect(normalizeEmail('  user@example.com  ')).toBe('user@example.com');
    expect(normalizeEmail('\tuser@example.com\n')).toBe('user@example.com');
  });

  it('should preserve plus-addressing tags', () => {
    expect(normalizeEmail('john+work@gmail.com')).toBe('john+work@gmail.com');
    expect(normalizeEmail('John+Newsletter@Example.COM')).toBe('john+newsletter@example.com');
  });

  it('should preserve dots in local part', () => {
    expect(normalizeEmail('j.o.h.n@gmail.com')).toBe('j.o.h.n@gmail.com');
  });

  it('should NOT strip +tag to bare address', () => {
    // Explicitly verify that john+work@gmail.com does NOT become john@gmail.com
    const result = normalizeEmail('john+work@gmail.com');
    expect(result).toBe('john+work@gmail.com');
    expect(result).not.toBe('john@gmail.com');
  });

  it('should NOT apply Gmail-specific normalization', () => {
    // Gmail treats dots as insignificant, but we must NOT do this
    expect(normalizeEmail('j.doe@gmail.com')).toBe('j.doe@gmail.com');
    expect(normalizeEmail('jdoe@gmail.com')).toBe('jdoe@gmail.com');
    // These must remain distinct
    expect(normalizeEmail('j.doe@gmail.com')).not.toBe(normalizeEmail('jdoe@gmail.com'));
  });

  it('should handle empty-ish input gracefully', () => {
    expect(normalizeEmail('')).toBe('');
    expect(normalizeEmail('   ')).toBe('');
  });
});
