/**
 * PrisNames — Capability System Tests
 */

import { describe, it, expect } from 'vitest';
import {
  RegistrarCapability,
  CapabilityStatus,
  VerificationLevel,
} from '../interfaces/capability.js';
import {
  ProviderOperationStatus,
  PROVIDER_TO_REGISTRAR_STATUS_MAP,
} from '../models/operation-result.js';

describe('RegistrarCapability enum', () => {
  it('has all expected capability values', () => {
    expect(RegistrarCapability.DOMAIN_SEARCH).toBe('DOMAIN_SEARCH');
    expect(RegistrarCapability.DOMAIN_REGISTER).toBe('DOMAIN_REGISTER');
    expect(RegistrarCapability.DOMAIN_RENEW).toBe('DOMAIN_RENEW');
    expect(RegistrarCapability.TRANSFER_IN).toBe('TRANSFER_IN');
    expect(RegistrarCapability.TRANSFER_AWAY).toBe('TRANSFER_AWAY');
    expect(RegistrarCapability.DOMAIN_NAMESERVER_CONFIG).toBe('DOMAIN_NAMESERVER_CONFIG');
    expect(RegistrarCapability.GLUE_RECORD_MANAGEMENT).toBe('GLUE_RECORD_MANAGEMENT');
    expect(RegistrarCapability.TRANSFER_LOCK).toBe('TRANSFER_LOCK');
    expect(RegistrarCapability.WEBHOOKS).toBe('WEBHOOKS');
  });
});

describe('CapabilityStatus', () => {
  it('has four distinct levels', () => {
    expect(CapabilityStatus.SUPPORTED).toBe('SUPPORTED');
    expect(CapabilityStatus.PARTIAL).toBe('PARTIAL');
    expect(CapabilityStatus.UNSUPPORTED).toBe('UNSUPPORTED');
    expect(CapabilityStatus.UNKNOWN).toBe('UNKNOWN');
  });
});

describe('VerificationLevel', () => {
  it('has four distinct levels independent of status', () => {
    expect(VerificationLevel.DOCUMENTED).toBe('DOCUMENTED');
    expect(VerificationLevel.MOCK_CONTRACT_VERIFIED).toBe('MOCK_CONTRACT_VERIFIED');
    expect(VerificationLevel.REDIS_VERIFIED).toBe('REDIS_VERIFIED');
    expect(VerificationLevel.SANDBOX_VERIFIED).toBe('SANDBOX_VERIFIED');
  });
});

describe('ProviderOperationStatus → RegistrarOperationStatus mapping', () => {
  it('maps SUCCEEDED → SUCCEEDED', () => {
    expect(PROVIDER_TO_REGISTRAR_STATUS_MAP[ProviderOperationStatus.SUCCEEDED]).toBe('SUCCEEDED');
  });

  it('maps ACCEPTED → ACCEPTED', () => {
    expect(PROVIDER_TO_REGISTRAR_STATUS_MAP[ProviderOperationStatus.ACCEPTED]).toBe('ACCEPTED');
  });

  it('maps UNKNOWN → UNKNOWN', () => {
    expect(PROVIDER_TO_REGISTRAR_STATUS_MAP[ProviderOperationStatus.UNKNOWN]).toBe('UNKNOWN');
  });

  it('maps FAILED → FAILED', () => {
    expect(PROVIDER_TO_REGISTRAR_STATUS_MAP[ProviderOperationStatus.FAILED]).toBe('FAILED');
  });

  it('exhaustively covers all ProviderOperationStatus values', () => {
    const allStatuses = Object.values(ProviderOperationStatus);
    const mappedStatuses = Object.keys(PROVIDER_TO_REGISTRAR_STATUS_MAP);

    // Every ProviderOperationStatus must have a mapping entry
    for (const status of allStatuses) {
      expect(mappedStatuses).toContain(status);
    }

    // Mapping should have exactly the same number of entries
    expect(mappedStatuses.length).toBe(allStatuses.length);
  });
});
