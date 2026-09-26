/**
 * PrisNames — Dynadot Registrar Provider
 *
 * Implements the RegistrarProvider interface with capability facets.
 *
 * Phase 5 registers ALL raw provider adapter facets.
 * Every method in each registered capability interface is genuinely implemented.
 */

import {
  RegistrarCapability,
  CapabilityStatus,
  VerificationLevel,
  CircuitBreaker,
  ProviderHealthTracker,
} from '@prisnames/registrar-core';
import type {
  RegistrarProvider,
  RegistrarCapabilityMap,
  CapabilityInfo,
  ProviderHealthStatus,
} from '@prisnames/registrar-core';

import type { DynadotConfig } from './config.js';
import { DynadotRateLimiter } from './rate-limiter.js';
import { DynadotHttpClient } from './http-client.js';
import { DynadotDomainSearchFacet } from './facets/domain-search.facet.js';
import { DynadotAccountFacet } from './facets/account.facet.js';
import { DynadotPricingFacet } from './facets/pricing.facet.js';
import { DynadotRegistrationFacet } from './facets/registration.facet.js';
import { DynadotRenewalFacet } from './facets/renewal.facet.js';
import { DynadotRestoreFacet } from './facets/restore.facet.js';
import { DynadotTransferInFacet } from './facets/transfer-in.facet.js';
import { DynadotTransferAwayFacet } from './facets/transfer-away.facet.js';
import { DynadotDomainInfoFacet } from './facets/domain-info.facet.js';
import { DynadotContactFacet } from './facets/contact.facet.js';
import { DynadotNameserverConfigFacet } from './facets/nameserver-config.facet.js';
import { DynadotGlueRecordFacet } from './facets/glue-record.facet.js';
import { DynadotDnsFacet } from './facets/dns.facet.js';
import { DynadotDnssecFacet } from './facets/dnssec.facet.js';
import { DynadotPrivacyFacet } from './facets/privacy.facet.js';
import { DynadotLockFacet } from './facets/lock.facet.js';
import { DynadotRenewOptionFacet } from './facets/renew-option.facet.js';
import { DynadotGraceDeleteFacet } from './facets/grace-delete.facet.js';
import { DynadotOrdersFacet } from './facets/orders.facet.js';
import { DynadotForwardingFacet } from './facets/forwarding.facet.js';
import type Redis from 'ioredis';

// ──────────────────────────────────────────────
// CAPABILITY MATRIX
// ──────────────────────────────────────────────

function buildCapabilityMatrix(): CapabilityInfo[] {
  return [
    // ── All methods implemented ──
    {
      capability: RegistrarCapability.DOMAIN_SEARCH,
      status: CapabilityStatus.PARTIAL,
      evidence: [VerificationLevel.DOCUMENTED, VerificationLevel.MOCK_CONTRACT_VERIFIED],
      notes: 'Search/availability implemented. Suggestion endpoint shape partially known.',
    },
    {
      capability: RegistrarCapability.ACCOUNT_INFO,
      status: CapabilityStatus.PARTIAL,
      evidence: [VerificationLevel.DOCUMENTED, VerificationLevel.MOCK_CONTRACT_VERIFIED],
      notes: 'Account info implemented. Response shape partially known until sandbox.',
    },
    {
      capability: RegistrarCapability.TLD_PRICING,
      status: CapabilityStatus.PARTIAL,
      evidence: [VerificationLevel.DOCUMENTED, VerificationLevel.MOCK_CONTRACT_VERIFIED],
      notes: 'TLD pricing implemented. Full response coverage pending sandbox.',
    },
    {
      capability: RegistrarCapability.DOMAIN_REGISTER,
      status: CapabilityStatus.PARTIAL,
      evidence: [VerificationLevel.DOCUMENTED, VerificationLevel.MOCK_CONTRACT_VERIFIED],
      notes: 'Registration facet implemented. Transactional sandbox opt-in required.',
    },
    {
      capability: RegistrarCapability.DOMAIN_RENEW,
      status: CapabilityStatus.PARTIAL,
      evidence: [VerificationLevel.DOCUMENTED, VerificationLevel.MOCK_CONTRACT_VERIFIED],
      notes: 'Renewal facet implemented. Transactional sandbox opt-in required.',
    },
    {
      capability: RegistrarCapability.DOMAIN_RESTORE,
      status: CapabilityStatus.PARTIAL,
      evidence: [VerificationLevel.DOCUMENTED, VerificationLevel.MOCK_CONTRACT_VERIFIED],
      notes: 'Restore facet implemented. Transactional sandbox opt-in required.',
    },
    {
      capability: RegistrarCapability.TRANSFER_IN,
      status: CapabilityStatus.PARTIAL,
      evidence: [VerificationLevel.DOCUMENTED, VerificationLevel.MOCK_CONTRACT_VERIFIED],
      notes: 'Transfer-in facet implemented with 202 async support.',
    },
    {
      capability: RegistrarCapability.TRANSFER_AWAY,
      status: CapabilityStatus.PARTIAL,
      evidence: [VerificationLevel.DOCUMENTED, VerificationLevel.MOCK_CONTRACT_VERIFIED],
      notes: 'Transfer-away facet implemented. Auth code is ephemeral.',
    },
    {
      capability: RegistrarCapability.DOMAIN_INFO,
      status: CapabilityStatus.PARTIAL,
      evidence: [VerificationLevel.DOCUMENTED, VerificationLevel.MOCK_CONTRACT_VERIFIED],
      notes: 'Domain info/list implemented. Object shape pending sandbox discovery.',
    },
    {
      capability: RegistrarCapability.CONTACT_MANAGEMENT,
      status: CapabilityStatus.PARTIAL,
      evidence: [VerificationLevel.DOCUMENTED, VerificationLevel.MOCK_CONTRACT_VERIFIED],
      notes: 'Contact CRUD + domain contact assignment implemented.',
    },
    {
      capability: RegistrarCapability.DOMAIN_NAMESERVER_CONFIG,
      status: CapabilityStatus.PARTIAL,
      evidence: [VerificationLevel.DOCUMENTED, VerificationLevel.MOCK_CONTRACT_VERIFIED],
    },
    {
      capability: RegistrarCapability.GLUE_RECORD_MANAGEMENT,
      status: CapabilityStatus.PARTIAL,
      evidence: [VerificationLevel.DOCUMENTED, VerificationLevel.MOCK_CONTRACT_VERIFIED],
    },
    {
      capability: RegistrarCapability.DNS_MANAGEMENT,
      status: CapabilityStatus.PARTIAL,
      evidence: [VerificationLevel.DOCUMENTED, VerificationLevel.MOCK_CONTRACT_VERIFIED],
    },
    {
      capability: RegistrarCapability.DNSSEC,
      status: CapabilityStatus.PARTIAL,
      evidence: [VerificationLevel.DOCUMENTED, VerificationLevel.MOCK_CONTRACT_VERIFIED],
    },
    {
      capability: RegistrarCapability.WHOIS_PRIVACY,
      status: CapabilityStatus.PARTIAL,
      evidence: [VerificationLevel.DOCUMENTED, VerificationLevel.MOCK_CONTRACT_VERIFIED],
    },
    {
      capability: RegistrarCapability.TRANSFER_LOCK,
      status: CapabilityStatus.PARTIAL,
      evidence: [VerificationLevel.DOCUMENTED, VerificationLevel.MOCK_CONTRACT_VERIFIED],
    },
    {
      capability: RegistrarCapability.AUTO_RENEW,
      status: CapabilityStatus.PARTIAL,
      evidence: [VerificationLevel.DOCUMENTED, VerificationLevel.MOCK_CONTRACT_VERIFIED],
    },
    {
      capability: RegistrarCapability.GRACE_DELETE,
      status: CapabilityStatus.PARTIAL,
      evidence: [VerificationLevel.DOCUMENTED, VerificationLevel.MOCK_CONTRACT_VERIFIED],
      notes: 'Grace delete facet implemented. Transactional sandbox opt-in required.',
    },
    {
      capability: RegistrarCapability.ORDER_MANAGEMENT,
      status: CapabilityStatus.PARTIAL,
      evidence: [VerificationLevel.DOCUMENTED, VerificationLevel.MOCK_CONTRACT_VERIFIED],
    },
    {
      capability: RegistrarCapability.DOMAIN_FORWARDING,
      status: CapabilityStatus.PARTIAL,
      evidence: [VerificationLevel.DOCUMENTED, VerificationLevel.MOCK_CONTRACT_VERIFIED],
      notes: 'Domain/stealth/email forwarding — three separate operations.',
    },
    {
      capability: RegistrarCapability.WEBHOOKS,
      status: CapabilityStatus.PARTIAL,
      evidence: [VerificationLevel.DOCUMENTED, VerificationLevel.MOCK_CONTRACT_VERIFIED],
      notes: 'Webhook ingestion infrastructure implemented. Provider retry behavior UNKNOWN.',
    },
  ];
}

// ──────────────────────────────────────────────
// PROVIDER
// ──────────────────────────────────────────────

export class DynadotRegistrarProvider implements RegistrarProvider {
  readonly providerId = 'dynadot';
  readonly providerName = 'Dynadot (GDG)';

  private readonly capabilities = new Map<RegistrarCapability, unknown>();
  private readonly capabilityMatrix: CapabilityInfo[];
  private readonly healthTracker: ProviderHealthTracker;
  private readonly circuitBreaker: CircuitBreaker;

  readonly httpClient: DynadotHttpClient;
  readonly rateLimiter: DynadotRateLimiter;

  constructor(config: DynadotConfig, redis: Redis) {
    this.circuitBreaker = new CircuitBreaker({
      failureThreshold: 5,
      resetTimeoutMs: 30_000,
      halfOpenSuccessThreshold: 2,
    });

    this.healthTracker = new ProviderHealthTracker('dynadot', this.circuitBreaker);

    this.rateLimiter = new DynadotRateLimiter(redis, {
      keyPrefix: `dynadot:ratelimit:${config.environment}`,
    });

    this.httpClient = new DynadotHttpClient(
      config,
      this.rateLimiter,
      this.circuitBreaker,
      this.healthTracker,
    );

    // Build capability matrix
    this.capabilityMatrix = buildCapabilityMatrix();

    // Register all implemented capability facets
    this.registerCapabilities();
  }

  private registerCapabilities(): void {
    const c = this.httpClient;

    // Read-only / informational
    this.capabilities.set(RegistrarCapability.DOMAIN_SEARCH, new DynadotDomainSearchFacet(c));
    this.capabilities.set(RegistrarCapability.ACCOUNT_INFO, new DynadotAccountFacet(c));
    this.capabilities.set(RegistrarCapability.TLD_PRICING, new DynadotPricingFacet(c));
    this.capabilities.set(RegistrarCapability.DOMAIN_INFO, new DynadotDomainInfoFacet(c));
    this.capabilities.set(RegistrarCapability.ORDER_MANAGEMENT, new DynadotOrdersFacet(c));

    // Transactional / lifecycle
    this.capabilities.set(RegistrarCapability.DOMAIN_REGISTER, new DynadotRegistrationFacet(c));
    this.capabilities.set(RegistrarCapability.DOMAIN_RENEW, new DynadotRenewalFacet(c));
    this.capabilities.set(RegistrarCapability.DOMAIN_RESTORE, new DynadotRestoreFacet(c));
    this.capabilities.set(RegistrarCapability.GRACE_DELETE, new DynadotGraceDeleteFacet(c));

    // Transfer
    this.capabilities.set(RegistrarCapability.TRANSFER_IN, new DynadotTransferInFacet(c));
    this.capabilities.set(RegistrarCapability.TRANSFER_AWAY, new DynadotTransferAwayFacet(c));

    // Configuration
    this.capabilities.set(RegistrarCapability.CONTACT_MANAGEMENT, new DynadotContactFacet(c));
    this.capabilities.set(RegistrarCapability.DOMAIN_NAMESERVER_CONFIG, new DynadotNameserverConfigFacet(c));
    this.capabilities.set(RegistrarCapability.GLUE_RECORD_MANAGEMENT, new DynadotGlueRecordFacet(c));
    this.capabilities.set(RegistrarCapability.DNS_MANAGEMENT, new DynadotDnsFacet(c));
    this.capabilities.set(RegistrarCapability.DNSSEC, new DynadotDnssecFacet(c));
    this.capabilities.set(RegistrarCapability.WHOIS_PRIVACY, new DynadotPrivacyFacet(c));
    this.capabilities.set(RegistrarCapability.TRANSFER_LOCK, new DynadotLockFacet(c));
    this.capabilities.set(RegistrarCapability.AUTO_RENEW, new DynadotRenewOptionFacet(c));
    this.capabilities.set(RegistrarCapability.DOMAIN_FORWARDING, new DynadotForwardingFacet(c));
  }

  getCapability<K extends keyof RegistrarCapabilityMap>(
    capability: K,
  ): RegistrarCapabilityMap[K] | null {
    return (this.capabilities.get(capability) as RegistrarCapabilityMap[K]) ?? null;
  }

  supports(capability: RegistrarCapability): boolean {
    return this.capabilities.has(capability);
  }

  getCapabilityStatus(capability: RegistrarCapability): CapabilityStatus {
    const info = this.capabilityMatrix.find((c) => c.capability === capability);
    return info?.status ?? CapabilityStatus.UNKNOWN;
  }

  listCapabilities(): CapabilityInfo[] {
    return [...this.capabilityMatrix];
  }

  getHealthStatus(): ProviderHealthStatus {
    return this.healthTracker.getHealthStatus();
  }
}
