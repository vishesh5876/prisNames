/**
 * PrisNames — FQDN Service Tests
 *
 * Tests FQDN canonicalization, validation, and edge cases.
 *
 * Reference: Phase 6 Implementation Plan §9
 */

import { describe, it, expect } from 'vitest';
import { FqdnService, InvalidFqdnError, IdnNotSupportedError } from '../fqdn.service.js';

describe('FqdnService', () => {
  const service = new FqdnService();

  describe('canonicalize', () => {
    it('should lowercase and trim a valid FQDN', () => {
      expect(service.canonicalize('  Example.COM  ')).toBe('example.com');
    });

    it('should strip a single trailing dot', () => {
      expect(service.canonicalize('example.com.')).toBe('example.com');
    });

    it('should handle multi-label domains', () => {
      expect(service.canonicalize('sub.example.co.uk')).toBe('sub.example.co.uk');
    });

    it('should reject empty input', () => {
      expect(() => service.canonicalize('')).toThrow(InvalidFqdnError);
      expect(() => service.canonicalize('   ')).toThrow(InvalidFqdnError);
    });

    // IDN rejection
    it('should reject non-ASCII characters (IDN)', () => {
      expect(() => service.canonicalize('münchen.de')).toThrow(IdnNotSupportedError);
      expect(() => service.canonicalize('例え.jp')).toThrow(IdnNotSupportedError);
    });

    // URL-like syntax rejection
    it('should reject URL syntax with @', () => {
      expect(() => service.canonicalize('user@example.com')).toThrow(InvalidFqdnError);
    });

    it('should reject URL syntax with :', () => {
      expect(() => service.canonicalize('example.com:8080')).toThrow(InvalidFqdnError);
    });

    it('should reject URL syntax with /', () => {
      expect(() => service.canonicalize('example.com/path')).toThrow(InvalidFqdnError);
    });

    it('should reject URL syntax with ?', () => {
      expect(() => service.canonicalize('example.com?query')).toThrow(InvalidFqdnError);
    });

    it('should reject URL syntax with #', () => {
      expect(() => service.canonicalize('example.com#frag')).toThrow(InvalidFqdnError);
    });

    it('should reject brackets', () => {
      expect(() => service.canonicalize('[::1]')).toThrow(InvalidFqdnError);
    });

    // IP literal rejection
    it('should reject IPv4 literals', () => {
      expect(() => service.canonicalize('192.168.1.1')).toThrow(InvalidFqdnError);
      expect(() => service.canonicalize('10.0.0.1')).toThrow(InvalidFqdnError);
    });

    // Label validation
    it('should reject labels starting with hyphen', () => {
      expect(() => service.canonicalize('-example.com')).toThrow(InvalidFqdnError);
    });

    it('should reject labels ending with hyphen', () => {
      expect(() => service.canonicalize('example-.com')).toThrow(InvalidFqdnError);
    });

    it('should accept hyphens in the middle of labels', () => {
      expect(service.canonicalize('my-domain.com')).toBe('my-domain.com');
    });

    it('should reject underscores in labels', () => {
      expect(() => service.canonicalize('my_domain.com')).toThrow(InvalidFqdnError);
    });

    it('should reject single-label names', () => {
      expect(() => service.canonicalize('localhost')).toThrow(InvalidFqdnError);
    });

    it('should reject empty labels (consecutive dots)', () => {
      expect(() => service.canonicalize('example..com')).toThrow(InvalidFqdnError);
    });

    it('should reject labels over 63 characters', () => {
      const longLabel = 'a'.repeat(64);
      expect(() => service.canonicalize(`${longLabel}.com`)).toThrow(InvalidFqdnError);
    });

    it('should accept labels at exactly 63 characters', () => {
      const label63 = 'a'.repeat(63);
      expect(service.canonicalize(`${label63}.com`)).toBe(`${label63}.com`);
    });

    it('should reject FQDNs over 253 characters total', () => {
      // Each label is 63 chars, separated by dots: 63*4 + 3 dots = 255 chars (> 253)
      const label = 'a'.repeat(63);
      const longDomain = `${label}.${label}.${label}.${label}`;
      expect(() => service.canonicalize(longDomain)).toThrow(InvalidFqdnError);
    });
  });

  describe('parseParts', () => {
    it('should split SLD and TLD', () => {
      expect(service.parseParts('example.com')).toEqual({ sld: 'example', tld: 'com' });
    });

    it('should handle multi-level TLDs', () => {
      expect(service.parseParts('example.co.uk')).toEqual({ sld: 'example', tld: 'co.uk' });
    });
  });

  describe('buildIdempotencyKey', () => {
    it('should produce deterministic keys', () => {
      const key1 = service.buildIdempotencyKey('dynadot', 'REGISTER', 'example.com', 'item-123');
      const key2 = service.buildIdempotencyKey('dynadot', 'REGISTER', 'example.com', 'item-123');
      expect(key1).toBe(key2);
      expect(key1).toBe('dynadot:REGISTER:example.com:item-123');
    });

    it('should differentiate by order item', () => {
      const key1 = service.buildIdempotencyKey('dynadot', 'REGISTER', 'example.com', 'item-1');
      const key2 = service.buildIdempotencyKey('dynadot', 'REGISTER', 'example.com', 'item-2');
      expect(key1).not.toBe(key2);
    });
  });
});
