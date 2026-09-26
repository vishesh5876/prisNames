/**
 * PrisNames — Endpoint Descriptor Manifest Tests
 *
 * NOT a tautological re-check. This verifies:
 * - Structural consistency of all descriptors
 * - Expected endpoint categories exist
 * - Critical signing requirements for known endpoints
 * - Path template validity
 * - Expected success code plausibility
 *
 * The descriptor manifest is the implementation source of truth,
 * reviewed against Dynadot REST v2 docs on 2026-09-13.
 * Real sandbox calls provide runtime verification where available.
 */

import { describe, it, expect } from 'vitest';
import { ENDPOINTS, type EndpointDescriptor, type SandboxSupport } from '../endpoints.js';

const allEntries = Object.entries(ENDPOINTS) as Array<[string, EndpointDescriptor]>;

describe('ENDPOINTS manifest', () => {
  describe('structural consistency', () => {
    it('all endpoints have valid HTTP methods', () => {
      const validMethods = ['GET', 'POST', 'PUT', 'DELETE'];
      for (const [_name, desc] of allEntries) {
        expect(validMethods).toContain(desc.method);
      }
    });

    it('all endpoints have boolean signed flag', () => {
      for (const [_name, desc] of allEntries) {
        expect(typeof desc.signed).toBe('boolean');
      }
    });

    it('all endpoints have valid sandboxSupport', () => {
      const validValues: SandboxSupport[] = ['SUPPORTED', 'UNSUPPORTED', 'UNKNOWN'];
      for (const [_name, desc] of allEntries) {
        expect(validValues).toContain(desc.sandboxSupport);
      }
    });

    it('all endpoints have non-empty descriptions', () => {
      for (const [_name, desc] of allEntries) {
        expect(desc.description.length).toBeGreaterThan(0);
      }
    });

    it('all endpoints have valid path templates starting with /', () => {
      for (const [_name, desc] of allEntries) {
        expect(desc.pathTemplate.startsWith('/')).toBe(true);
      }
    });

    it('all endpoints have at least one expected success code', () => {
      for (const [_name, desc] of allEntries) {
        expect(desc.expectedSuccessCodes.length).toBeGreaterThan(0);
        for (const code of desc.expectedSuccessCodes) {
          expect(code).toBeGreaterThanOrEqual(200);
          expect(code).toBeLessThan(300);
        }
      }
    });

    it('has expected total endpoint count (48)', () => {
      expect(allEntries.length).toBe(48);
    });
  });

  describe('critical signing requirements', () => {
    // Per correction: do NOT assume GET=unsigned or POST=signed

    it('signed GET endpoints exist (DOMAIN_INFO, ACCOUNT_INFO, DOMAIN_LIST)', () => {
      expect(ENDPOINTS.DOMAIN_INFO.method).toBe('GET');
      expect(ENDPOINTS.DOMAIN_INFO.signed).toBe(true);

      expect(ENDPOINTS.ACCOUNT_INFO.method).toBe('GET');
      expect(ENDPOINTS.ACCOUNT_INFO.signed).toBe(true);

      expect(ENDPOINTS.DOMAIN_LIST.method).toBe('GET');
      expect(ENDPOINTS.DOMAIN_LIST.signed).toBe(true);
    });

    it('unsigned GET endpoints exist (DOMAIN_SEARCH, TLD_PRICING)', () => {
      expect(ENDPOINTS.DOMAIN_SEARCH.method).toBe('GET');
      expect(ENDPOINTS.DOMAIN_SEARCH.signed).toBe(false);

      expect(ENDPOINTS.TLD_PRICING.method).toBe('GET');
      expect(ENDPOINTS.TLD_PRICING.signed).toBe(false);
    });

    it('transactional POST/DELETE endpoints require signature', () => {
      expect(ENDPOINTS.DOMAIN_REGISTER.signed).toBe(true);
      expect(ENDPOINTS.DOMAIN_RENEW.signed).toBe(true);
      expect(ENDPOINTS.DOMAIN_RESTORE.signed).toBe(true);
      expect(ENDPOINTS.TRANSFER_IN.signed).toBe(true);
      expect(ENDPOINTS.DOMAIN_GRACE_DELETE.signed).toBe(true);
      expect(ENDPOINTS.DOMAIN_POST_GRACE_DELETE.signed).toBe(true);
    });
  });

  describe('async/202 semantics', () => {
    it('transfer-in may return 202', () => {
      expect(ENDPOINTS.TRANSFER_IN.expectedSuccessCodes).toContain(202);
    });

    it('contact update may return 202', () => {
      expect(ENDPOINTS.CONTACT_UPDATE.expectedSuccessCodes).toContain(202);
      expect(ENDPOINTS.DOMAIN_SET_CONTACTS.expectedSuccessCodes).toContain(202);
    });
  });

  describe('category coverage', () => {
    it('has search endpoints', () => {
      expect(ENDPOINTS.DOMAIN_SEARCH).toBeDefined();
      expect(ENDPOINTS.DOMAIN_BULK_SEARCH).toBeDefined();
      expect(ENDPOINTS.DOMAIN_POWER_SEARCH).toBeDefined();
      expect(ENDPOINTS.DOMAIN_SUGGESTION_SEARCH).toBeDefined();
    });

    it('has lifecycle endpoints', () => {
      expect(ENDPOINTS.DOMAIN_REGISTER).toBeDefined();
      expect(ENDPOINTS.DOMAIN_RENEW).toBeDefined();
      expect(ENDPOINTS.DOMAIN_RESTORE).toBeDefined();
      expect(ENDPOINTS.DOMAIN_GRACE_DELETE).toBeDefined();
      expect(ENDPOINTS.DOMAIN_POST_GRACE_DELETE).toBeDefined();
    });

    it('has all 6 glue record / nameserver endpoints', () => {
      expect(ENDPOINTS.NAMESERVER_REGISTERED_GET).toBeDefined();
      expect(ENDPOINTS.NAMESERVER_REGISTERED_LIST).toBeDefined();
      expect(ENDPOINTS.NAMESERVER_REGISTER).toBeDefined();
      expect(ENDPOINTS.NAMESERVER_ADD_EXTERNAL).toBeDefined();
      expect(ENDPOINTS.NAMESERVER_SET_IP).toBeDefined();
      expect(ENDPOINTS.NAMESERVER_DELETE).toBeDefined();
    });

    it('has forwarding endpoints', () => {
      expect(ENDPOINTS.DOMAIN_FORWARDING_SET.method).toBe('PUT');
      expect(ENDPOINTS.STEALTH_FORWARDING_SET.method).toBe('PUT');
      expect(ENDPOINTS.EMAIL_FORWARDING_SET.method).toBe('PUT');
    });

    it('has both grace and post-grace delete', () => {
      expect(ENDPOINTS.DOMAIN_GRACE_DELETE.method).toBe('DELETE');
      expect(ENDPOINTS.DOMAIN_POST_GRACE_DELETE.method).toBe('DELETE');
    });
  });
});
