/**
 * PrisNames — RegistrarProvider Interface
 *
 * Base interface for all registrar providers. Uses a type-safe capability map
 * keyed by RegistrarCapability enum for runtime capability acquisition.
 *
 * Providers register only the capability facets they genuinely implement.
 * Application code acquires capabilities via getCapability() — the compiler
 * knows which interface corresponds to each capability enum value.
 *
 * Reference: REGISTRAR_ARCHITECTURE.md
 */

import {
  RegistrarCapability,
  type CapabilityInfo,
  type CapabilityStatus,
} from './capability.js';

import type { DomainSearchCapability } from './capabilities/domain-search.capability.js';
import type { DomainRegistrationCapability } from './capabilities/domain-registration.capability.js';
import type { DomainRenewalCapability } from './capabilities/domain-renewal.capability.js';
import type { DomainRestoreCapability } from './capabilities/domain-restore.capability.js';
import type { DomainTransferInCapability } from './capabilities/domain-transfer-in.capability.js';
import type { DomainTransferAwayCapability } from './capabilities/domain-transfer-away.capability.js';
import type { DomainInfoCapability } from './capabilities/domain-info.capability.js';
import type { DomainNameserverConfigCapability } from './capabilities/domain-nameserver-config.capability.js';
import type { GlueRecordManagementCapability } from './capabilities/glue-record-management.capability.js';
import type { DomainDnsCapability } from './capabilities/domain-dns.capability.js';
import type { DomainDnssecCapability } from './capabilities/domain-dnssec.capability.js';
import type { DomainContactCapability } from './capabilities/domain-contact.capability.js';
import type { DomainPrivacyCapability } from './capabilities/domain-privacy.capability.js';
import type { DomainLockCapability } from './capabilities/domain-lock.capability.js';
import type { DomainPricingCapability } from './capabilities/domain-pricing.capability.js';
import type { DomainRenewOptionCapability } from './capabilities/domain-renew-option.capability.js';
import type { DomainGraceDeleteCapability } from './capabilities/domain-grace-delete.capability.js';
import type { DomainForwardingCapability } from './capabilities/domain-forwarding.capability.js';
import type { RegistrarAccountCapability } from './capabilities/registrar-account.capability.js';
import type { RegistrarOrdersCapability } from './capabilities/registrar-orders.capability.js';
import type { ProviderHealthStatus } from '../models/account.js';

// ──────────────────────────────────────────────
// CAPABILITY MAP — Compile-time enum → interface mapping
// ──────────────────────────────────────────────

/**
 * Maps each RegistrarCapability enum value to its corresponding interface type.
 * This enables type-safe runtime capability acquisition:
 *
 *   const search = provider.getCapability(RegistrarCapability.DOMAIN_SEARCH);
 *   // search is typed as DomainSearchCapability | null
 */
export interface RegistrarCapabilityMap {
  [RegistrarCapability.DOMAIN_SEARCH]: DomainSearchCapability;
  [RegistrarCapability.DOMAIN_REGISTER]: DomainRegistrationCapability;
  [RegistrarCapability.DOMAIN_RENEW]: DomainRenewalCapability;
  [RegistrarCapability.DOMAIN_RESTORE]: DomainRestoreCapability;
  [RegistrarCapability.TRANSFER_IN]: DomainTransferInCapability;
  [RegistrarCapability.TRANSFER_AWAY]: DomainTransferAwayCapability;
  [RegistrarCapability.DOMAIN_INFO]: DomainInfoCapability;
  [RegistrarCapability.CONTACT_MANAGEMENT]: DomainContactCapability;
  [RegistrarCapability.DOMAIN_NAMESERVER_CONFIG]: DomainNameserverConfigCapability;
  [RegistrarCapability.GLUE_RECORD_MANAGEMENT]: GlueRecordManagementCapability;
  [RegistrarCapability.DNS_MANAGEMENT]: DomainDnsCapability;
  [RegistrarCapability.DNSSEC]: DomainDnssecCapability;
  [RegistrarCapability.WHOIS_PRIVACY]: DomainPrivacyCapability;
  [RegistrarCapability.TRANSFER_LOCK]: DomainLockCapability;
  [RegistrarCapability.TLD_PRICING]: DomainPricingCapability;
  [RegistrarCapability.AUTO_RENEW]: DomainRenewOptionCapability;
  [RegistrarCapability.GRACE_DELETE]: DomainGraceDeleteCapability;
  [RegistrarCapability.DOMAIN_FORWARDING]: DomainForwardingCapability;
  [RegistrarCapability.ACCOUNT_INFO]: RegistrarAccountCapability;
  [RegistrarCapability.ORDER_MANAGEMENT]: RegistrarOrdersCapability;
  // WEBHOOKS capability is infrastructure, not a callable interface
}

// ──────────────────────────────────────────────
// BASE REGISTRAR PROVIDER INTERFACE
// ──────────────────────────────────────────────

export interface RegistrarProvider {
  /** Unique provider identifier, e.g. "dynadot" */
  readonly providerId: string;

  /** Human-readable provider name, e.g. "Dynadot (GDG)" */
  readonly providerName: string;

  /**
   * Type-safe runtime capability acquisition.
   * Returns the capability facet if registered, or null if the provider
   * does not support or has not registered this capability.
   *
   * @example
   *   const search = provider.getCapability(RegistrarCapability.DOMAIN_SEARCH);
   *   if (!search) throw new CapabilityUnsupportedError('DOMAIN_SEARCH', provider.providerId);
   *   const result = await search.checkAvailability('example.com');
   */
  getCapability<K extends keyof RegistrarCapabilityMap>(
    capability: K
  ): RegistrarCapabilityMap[K] | null;

  /** Check if a capability is supported (has a registered facet). */
  supports(capability: RegistrarCapability): boolean;

  /** Get the detailed status of a capability. */
  getCapabilityStatus(capability: RegistrarCapability): CapabilityStatus;

  /** List all capabilities with their status and verification evidence. */
  listCapabilities(): CapabilityInfo[];

  /**
   * Get local per-process health telemetry.
   * Does NOT call the upstream provider — no rate-limit consumption.
   * This is local telemetry, not globally authoritative.
   */
  getHealthStatus(): ProviderHealthStatus;
}
