/**
 * PrisNames — Registrar Capability Definitions
 *
 * Defines the canonical set of registrar capabilities, their status levels,
 * and verification evidence tracking.
 *
 * Capability status represents provider support level.
 * Verification level represents how the capability has been validated.
 * These are independent dimensions — do not conflate them.
 *
 * Reference: REGISTRAR_ARCHITECTURE.md
 */

// ──────────────────────────────────────────────
// REGISTRAR CAPABILITIES
// ──────────────────────────────────────────────

export enum RegistrarCapability {
  DOMAIN_SEARCH = 'DOMAIN_SEARCH',
  DOMAIN_REGISTER = 'DOMAIN_REGISTER',
  DOMAIN_RENEW = 'DOMAIN_RENEW',
  DOMAIN_RESTORE = 'DOMAIN_RESTORE',
  TRANSFER_IN = 'TRANSFER_IN',
  TRANSFER_AWAY = 'TRANSFER_AWAY',
  DOMAIN_INFO = 'DOMAIN_INFO',
  CONTACT_MANAGEMENT = 'CONTACT_MANAGEMENT',
  DOMAIN_NAMESERVER_CONFIG = 'DOMAIN_NAMESERVER_CONFIG',
  GLUE_RECORD_MANAGEMENT = 'GLUE_RECORD_MANAGEMENT',
  DNS_MANAGEMENT = 'DNS_MANAGEMENT',
  DNSSEC = 'DNSSEC',
  WHOIS_PRIVACY = 'WHOIS_PRIVACY',
  TRANSFER_LOCK = 'TRANSFER_LOCK',
  TLD_PRICING = 'TLD_PRICING',
  AUTO_RENEW = 'AUTO_RENEW',
  GRACE_DELETE = 'GRACE_DELETE',
  ACCOUNT_INFO = 'ACCOUNT_INFO',
  ORDER_MANAGEMENT = 'ORDER_MANAGEMENT',
  WEBHOOKS = 'WEBHOOKS',
  DOMAIN_FORWARDING = 'DOMAIN_FORWARDING',
}

// ──────────────────────────────────────────────
// CAPABILITY STATUS — Provider support level
// ──────────────────────────────────────────────

/**
 * Describes how well a provider supports a given capability.
 *
 * SUPPORTED  — Endpoint documented, DTO defined, mapper implemented,
 *              every method in the capability interface is genuinely functional.
 * PARTIAL    — Endpoint/operation implemented and callable, but response
 *              shape or edge-case knowledge is incomplete. Every method in the
 *              capability interface IS implemented, but some fields may be
 *              incomplete or untested edge cases exist.
 * UNSUPPORTED — Provider does not offer this capability at all.
 * UNKNOWN     — Not yet verified. Capability is NOT registered or callable.
 */
export enum CapabilityStatus {
  SUPPORTED = 'SUPPORTED',
  PARTIAL = 'PARTIAL',
  UNSUPPORTED = 'UNSUPPORTED',
  UNKNOWN = 'UNKNOWN',
}

// ──────────────────────────────────────────────
// VERIFICATION LEVEL — Independent evidence dimension
// ──────────────────────────────────────────────

/**
 * How a capability's correctness has been validated.
 * Multiple levels can apply simultaneously (cumulative evidence).
 */
export enum VerificationLevel {
  /** Endpoint exists in provider REST API docs */
  DOCUMENTED = 'DOCUMENTED',
  /** Unit/contract tests pass with mock HTTP fixtures */
  MOCK_CONTRACT_VERIFIED = 'MOCK_CONTRACT_VERIFIED',
  /** Rate limiter/concurrency tested against real Redis */
  REDIS_VERIFIED = 'REDIS_VERIFIED',
  /** Actually tested against provider sandbox API */
  SANDBOX_VERIFIED = 'SANDBOX_VERIFIED',
}

// ──────────────────────────────────────────────
// CAPABILITY INFO
// ──────────────────────────────────────────────

export interface CapabilityInfo {
  readonly capability: RegistrarCapability;
  readonly status: CapabilityStatus;
  readonly evidence: readonly VerificationLevel[];
  readonly notes?: string;
}
