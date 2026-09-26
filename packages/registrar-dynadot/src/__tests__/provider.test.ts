/**
 * PrisNames — Dynadot Provider Contract Tests
 *
 * Verifies capability registration, status reporting, and interface compliance.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import RedisMock from 'ioredis-mock';
import type Redis from 'ioredis';
import { DynadotRegistrarProvider } from '../provider.js';
import { createDynadotConfig } from '../config.js';
import {
  RegistrarCapability,
  CapabilityStatus,
  VerificationLevel,
} from '@prisnames/registrar-core';

describe('DynadotRegistrarProvider', () => {
  let provider: DynadotRegistrarProvider;

  beforeEach(() => {
    const config = createDynadotConfig({
      apiKey: 'test-api-key',
      apiSecret: 'test-api-secret',
    });
    const redis = new RedisMock();
    provider = new DynadotRegistrarProvider(config, redis as unknown as Redis);
  });

  describe('identity', () => {
    it('has correct provider ID', () => {
      expect(provider.providerId).toBe('dynadot');
    });

    it('has descriptive provider name', () => {
      expect(provider.providerName).toBe('Dynadot (GDG)');
    });
  });

  describe('capability registration', () => {
    it('has DOMAIN_SEARCH capability registered', () => {
      expect(provider.supports(RegistrarCapability.DOMAIN_SEARCH)).toBe(true);
    });

    it('has ACCOUNT_INFO capability registered', () => {
      expect(provider.supports(RegistrarCapability.ACCOUNT_INFO)).toBe(true);
    });

    it('has TLD_PRICING capability registered', () => {
      expect(provider.supports(RegistrarCapability.TLD_PRICING)).toBe(true);
    });

    it('has DOMAIN_REGISTER capability registered', () => {
      expect(provider.supports(RegistrarCapability.DOMAIN_REGISTER)).toBe(true);
    });

    it('has DOMAIN_RENEW capability registered', () => {
      expect(provider.supports(RegistrarCapability.DOMAIN_RENEW)).toBe(true);
    });

    it('has TRANSFER_IN capability registered', () => {
      expect(provider.supports(RegistrarCapability.TRANSFER_IN)).toBe(true);
    });

    it('has all 20 callable capability facets registered', () => {
      const callableCapabilities = [
        RegistrarCapability.DOMAIN_SEARCH,
        RegistrarCapability.ACCOUNT_INFO,
        RegistrarCapability.TLD_PRICING,
        RegistrarCapability.DOMAIN_REGISTER,
        RegistrarCapability.DOMAIN_RENEW,
        RegistrarCapability.DOMAIN_RESTORE,
        RegistrarCapability.TRANSFER_IN,
        RegistrarCapability.TRANSFER_AWAY,
        RegistrarCapability.DOMAIN_INFO,
        RegistrarCapability.CONTACT_MANAGEMENT,
        RegistrarCapability.DOMAIN_NAMESERVER_CONFIG,
        RegistrarCapability.GLUE_RECORD_MANAGEMENT,
        RegistrarCapability.DNS_MANAGEMENT,
        RegistrarCapability.DNSSEC,
        RegistrarCapability.WHOIS_PRIVACY,
        RegistrarCapability.TRANSFER_LOCK,
        RegistrarCapability.AUTO_RENEW,
        RegistrarCapability.GRACE_DELETE,
        RegistrarCapability.ORDER_MANAGEMENT,
        RegistrarCapability.DOMAIN_FORWARDING,
      ];
      for (const cap of callableCapabilities) {
        expect(provider.supports(cap)).toBe(true);
      }
    });
  });

  describe('getCapability (type-safe)', () => {
    it('returns search capability facet', () => {
      const search = provider.getCapability(RegistrarCapability.DOMAIN_SEARCH);
      expect(search).not.toBeNull();
      expect(typeof search!.checkAvailability).toBe('function');
      expect(typeof search!.bulkCheckAvailability).toBe('function');
      expect(typeof search!.suggestDomains).toBe('function');
    });

    it('returns account capability facet', () => {
      const account = provider.getCapability(RegistrarCapability.ACCOUNT_INFO);
      expect(account).not.toBeNull();
      expect(typeof account!.getAccountInfo).toBe('function');
    });

    it('returns pricing capability facet', () => {
      const pricing = provider.getCapability(RegistrarCapability.TLD_PRICING);
      expect(pricing).not.toBeNull();
      expect(typeof pricing!.getTldPrices).toBe('function');
    });

    it('returns registration capability facet', () => {
      const register = provider.getCapability(RegistrarCapability.DOMAIN_REGISTER);
      expect(register).not.toBeNull();
      expect(typeof register!.registerDomain).toBe('function');
    });
  });

  describe('capability matrix', () => {
    it('lists all capabilities', () => {
      const caps = provider.listCapabilities();
      expect(caps.length).toBeGreaterThan(10);
    });

    it('registered capabilities have PARTIAL or SUPPORTED status', () => {
      const searchStatus = provider.getCapabilityStatus(RegistrarCapability.DOMAIN_SEARCH);
      expect([CapabilityStatus.SUPPORTED, CapabilityStatus.PARTIAL]).toContain(searchStatus);
    });

    it('all registered capabilities have PARTIAL or SUPPORTED status', () => {
      const allCaps = provider.listCapabilities();
      for (const cap of allCaps) {
        if (cap.capability !== RegistrarCapability.WEBHOOKS) {
          expect([CapabilityStatus.SUPPORTED, CapabilityStatus.PARTIAL]).toContain(cap.status);
        }
      }
    });

    it('WEBHOOKS is PARTIAL (infrastructure, not callable)', () => {
      expect(provider.getCapabilityStatus(RegistrarCapability.WEBHOOKS))
        .toBe(CapabilityStatus.PARTIAL);
      // WEBHOOKS is infrastructure — no callable interface registered
      expect(provider.supports(RegistrarCapability.WEBHOOKS)).toBe(false);
    });

    it('all capabilities have at least DOCUMENTED evidence', () => {
      const caps = provider.listCapabilities();
      for (const cap of caps) {
        expect(cap.evidence).toContain(VerificationLevel.DOCUMENTED);
      }
    });

    it('TRANSFER_LOCK is separate from TRANSFER_AWAY (correction #3)', () => {
      const caps = provider.listCapabilities();
      const lockCap = caps.find(c => c.capability === RegistrarCapability.TRANSFER_LOCK);
      const awayInfo = caps.find(c => c.capability === RegistrarCapability.TRANSFER_AWAY);
      expect(lockCap).toBeDefined();
      expect(awayInfo).toBeDefined();
      // Both exist as separate capabilities
      expect(lockCap!.capability).not.toBe(awayInfo!.capability);
    });
  });

  describe('health status', () => {
    it('returns per-process local health', () => {
      const health = provider.getHealthStatus();
      expect(health.providerId).toBe('dynadot');
      expect(health.isCircuitOpen).toBe(false);
      expect(health.totalRequests).toBe(0);
      expect(health.totalErrors).toBe(0);
    });
  });
});
