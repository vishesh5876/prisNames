/**
 * PrisNames — Dynadot REST v2 Endpoint Descriptors
 *
 * Authoritative endpoint manifest audited against Dynadot REST v2 docs (DYNADOT.md).
 * Last audit: 2026-09-13 (post-sandbox verification)
 *
 * Each entry records:
 * - HTTP method
 * - Path template (exact match with docs — starts with /restful/v2)
 * - Signature requirement (from docs: presence of X-Signature header)
 * - Sandbox support status (documented)
 * - Expected success status codes
 * - Description
 *
 * Placeholder convention: {domain_name}, {contact_id}, {order_id}, {nameserver}
 * These MUST match what the endpoint builder interpolates.
 *
 * DO NOT guess endpoint paths or signature requirements.
 * Every entry here is verified against the REST v2 docs.
 */

// ──────────────────────────────────────────────
// TYPES
// ──────────────────────────────────────────────

/**
 * Sandbox support status — separated from runtime verification evidence.
 *
 * SUPPORTED: Documentation explicitly states sandbox support.
 * UNSUPPORTED: Documentation explicitly states sandbox does NOT support this.
 * UNKNOWN: Documentation does not specify sandbox support.
 */
export type SandboxSupport = 'SUPPORTED' | 'UNSUPPORTED' | 'UNKNOWN';

export interface EndpointDescriptor {
  /** HTTP method */
  readonly method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  /** REST v2 path template (no scheme/host, starts with /restful/v2) */
  readonly pathTemplate: string;
  /** Whether this endpoint requires X-Signature header */
  readonly signed: boolean;
  /** Sandbox support status (documented, not runtime-verified) */
  readonly sandboxSupport: SandboxSupport;
  /** Expected HTTP success status codes */
  readonly expectedSuccessCodes: readonly number[];
  /** Brief description */
  readonly description: string;
}

// ──────────────────────────────────────────────
// ENDPOINT REGISTRY
//
// Audited against Dynadot REST v2 API documentation (DYNADOT.md)
// Post-sandbox audit: 2026-09-13
// ──────────────────────────────────────────────

export const ENDPOINTS = {
  // ── Domain Search & Availability ──
  // Docs: SEARCH Command — GET /restful/v2/domains/{domain_name}/search
  DOMAIN_SEARCH: {
    method: 'GET',
    pathTemplate: '/restful/v2/domains/{domain_name}/search',
    signed: false,
    sandboxSupport: 'SUPPORTED',
    expectedSuccessCodes: [200],
    description: 'Single domain availability search',
  },
  // Docs: BULK_SEARCH Command — GET /restful/v2/domains/bulk_search
  DOMAIN_BULK_SEARCH: {
    method: 'GET',
    pathTemplate: '/restful/v2/domains/bulk_search',
    signed: false,
    sandboxSupport: 'SUPPORTED',
    expectedSuccessCodes: [200],
    description: 'Bulk domain availability search',
  },
  // Docs: POWER_SEARCH Command — GET /restful/v2/domains/{domain_name}/power_search_new
  DOMAIN_POWER_SEARCH: {
    method: 'GET',
    pathTemplate: '/restful/v2/domains/{domain_name}/power_search_new',
    signed: false,
    sandboxSupport: 'SUPPORTED',
    expectedSuccessCodes: [200],
    description: 'Power search with cursor pagination',
  },
  // Docs: SUGGESTION_SEARCH Command — GET /restful/v2/domains/{domain_name}/suggestion_search
  DOMAIN_SUGGESTION_SEARCH: {
    method: 'GET',
    pathTemplate: '/restful/v2/domains/{domain_name}/suggestion_search',
    signed: false,
    sandboxSupport: 'SUPPORTED',
    expectedSuccessCodes: [200],
    description: 'Suggestion-based domain search',
  },

  // ── Domain Registration & Lifecycle ──
  // Docs: REGISTER Command — POST /restful/v2/domains/{domain_name}/register
  DOMAIN_REGISTER: {
    method: 'POST',
    pathTemplate: '/restful/v2/domains/{domain_name}/register',
    signed: true,
    sandboxSupport: 'SUPPORTED',
    expectedSuccessCodes: [200],
    description: 'Register a domain',
  },
  // Docs: RENEW Command — POST /restful/v2/domains/{domain_name}/renew
  DOMAIN_RENEW: {
    method: 'POST',
    pathTemplate: '/restful/v2/domains/{domain_name}/renew',
    signed: true,
    sandboxSupport: 'SUPPORTED',
    expectedSuccessCodes: [200],
    description: 'Renew a domain',
  },
  // Docs: RESTORE Command — POST /restful/v2/domains/{domain_name}/restore
  DOMAIN_RESTORE: {
    method: 'POST',
    pathTemplate: '/restful/v2/domains/{domain_name}/restore',
    signed: true,
    sandboxSupport: 'SUPPORTED',
    expectedSuccessCodes: [200],
    description: 'Restore a domain from redemption',
  },
  // Docs: GRACE_DELETE Command — DELETE /restful/v2/domains/{domain_name}/grace_delete
  DOMAIN_GRACE_DELETE: {
    method: 'DELETE',
    pathTemplate: '/restful/v2/domains/{domain_name}/grace_delete',
    signed: true,
    sandboxSupport: 'SUPPORTED',
    expectedSuccessCodes: [200],
    description: 'Grace-period delete (within 5-day window)',
  },
  // Docs: POST_GRACE_DELETE Command — DELETE /restful/v2/domains/{domain_name}/post_grace_delete
  DOMAIN_POST_GRACE_DELETE: {
    method: 'DELETE',
    pathTemplate: '/restful/v2/domains/{domain_name}/post_grace_delete',
    signed: true,
    sandboxSupport: 'SUPPORTED',
    expectedSuccessCodes: [200],
    description: 'Post-grace-period delete (irreversible)',
  },

  // ── Domain Information & Management ──
  // Docs: DOMAIN_INFO Command — GET /restful/v2/domains/{domain_name}
  // NOTE: No /info suffix — the domain_name IS the resource identifier
  DOMAIN_INFO: {
    method: 'GET',
    pathTemplate: '/restful/v2/domains/{domain_name}',
    signed: true,
    sandboxSupport: 'SUPPORTED',
    expectedSuccessCodes: [200],
    description: 'Get domain info',
  },
  // Docs: DOMAIN_LIST Command — GET /restful/v2/domains
  DOMAIN_LIST: {
    method: 'GET',
    pathTemplate: '/restful/v2/domains',
    signed: true,
    sandboxSupport: 'SUPPORTED',
    expectedSuccessCodes: [200],
    description: 'List domains with pagination',
  },
  // Docs: SET_RENEW_OPTION Command — PUT /restful/v2/domains/{domain_name}/renew_option
  DOMAIN_SET_RENEW_OPTION: {
    method: 'PUT',
    pathTemplate: '/restful/v2/domains/{domain_name}/renew_option',
    signed: true,
    sandboxSupport: 'SUPPORTED',
    expectedSuccessCodes: [200],
    description: 'Set domain renew option (auto/manual/no_renew)',
  },
  // Docs: DOMAIN_APPRAISAL Command — GET /restful/v2/domains/{domain_name}/appraisal
  // NOTE: No X-Signature per docs
  DOMAIN_APPRAISAL: {
    method: 'GET',
    pathTemplate: '/restful/v2/domains/{domain_name}/appraisal',
    signed: false,
    sandboxSupport: 'SUPPORTED',
    expectedSuccessCodes: [200],
    description: 'Get domain appraisal value',
  },

  // ── Nameservers (domain-level) ──
  // Docs: GET_NAMESERVER Command — GET /restful/v2/domains/{domain_name}/nameservers
  // NOTE: No X-Signature per docs
  NAMESERVER_GET: {
    method: 'GET',
    pathTemplate: '/restful/v2/domains/{domain_name}/nameservers',
    signed: false,
    sandboxSupport: 'SUPPORTED',
    expectedSuccessCodes: [200],
    description: 'Get domain nameservers',
  },
  // Docs: SET_NAMESERVER Command — PUT /restful/v2/domains/{domain_name}/nameservers
  NAMESERVER_SET: {
    method: 'PUT',
    pathTemplate: '/restful/v2/domains/{domain_name}/nameservers',
    signed: true,
    sandboxSupport: 'SUPPORTED',
    expectedSuccessCodes: [200],
    description: 'Set domain nameservers',
  },

  // ── Nameservers (glue/registered) ──
  // Docs: GET_NAMESERVER_INFO Command — GET /restful/v2/nameservers/{nameserver}
  NAMESERVER_REGISTERED_GET: {
    method: 'GET',
    pathTemplate: '/restful/v2/nameservers/{nameserver}',
    signed: true,
    sandboxSupport: 'SUPPORTED',
    expectedSuccessCodes: [200],
    description: 'Get a registered nameserver details',
  },
  // Docs: NAMESERVER_LIST Command — GET /restful/v2/nameservers
  NAMESERVER_REGISTERED_LIST: {
    method: 'GET',
    pathTemplate: '/restful/v2/nameservers',
    signed: true,
    sandboxSupport: 'SUPPORTED',
    expectedSuccessCodes: [200],
    description: 'List registered nameservers',
  },
  // Docs: NAMESERVER_REGISTER Command — POST /restful/v2/nameservers/register
  NAMESERVER_REGISTER: {
    method: 'POST',
    pathTemplate: '/restful/v2/nameservers/register',
    signed: true,
    sandboxSupport: 'SUPPORTED',
    expectedSuccessCodes: [200],
    description: 'Register a new nameserver (glue record)',
  },
  // Docs: NAMESERVER_ADD_EXTERNAL Command — POST /restful/v2/nameservers/{nameserver}/add_external
  NAMESERVER_ADD_EXTERNAL: {
    method: 'POST',
    pathTemplate: '/restful/v2/nameservers/{nameserver}/add_external',
    signed: true,
    sandboxSupport: 'SUPPORTED',
    expectedSuccessCodes: [200],
    description: 'Add an external nameserver (no glue IPs)',
  },
  // Docs: NAMESERVER_SET_IP Command — PUT /restful/v2/nameservers/{nameserver}/set_ip
  NAMESERVER_SET_IP: {
    method: 'PUT',
    pathTemplate: '/restful/v2/nameservers/{nameserver}/set_ip',
    signed: true,
    sandboxSupport: 'SUPPORTED',
    expectedSuccessCodes: [200],
    description: 'Set nameserver IP addresses',
  },
  // Docs: NAMESERVER_DELETE Command — DELETE /restful/v2/nameservers/{nameserver}
  NAMESERVER_DELETE: {
    method: 'DELETE',
    pathTemplate: '/restful/v2/nameservers/{nameserver}',
    signed: true,
    sandboxSupport: 'SUPPORTED',
    expectedSuccessCodes: [200],
    description: 'Delete a registered nameserver',
  },

  // ── DNS Records ──
  // Docs: GET_DNS Command — GET /restful/v2/domains/{domain_name}/records
  // NOTE: Path is /records not /dns
  DNS_GET: {
    method: 'GET',
    pathTemplate: '/restful/v2/domains/{domain_name}/records',
    signed: true,
    sandboxSupport: 'SUPPORTED',
    expectedSuccessCodes: [200],
    description: 'Get DNS records for a domain',
  },
  // Docs: SET_DNS Command — POST /restful/v2/domains/{domain_name}/records
  DNS_SET: {
    method: 'POST',
    pathTemplate: '/restful/v2/domains/{domain_name}/records',
    signed: true,
    sandboxSupport: 'SUPPORTED',
    expectedSuccessCodes: [200],
    description: 'Set DNS records for a domain',
  },
  // Docs: REMOVE_DNS Command — DELETE /restful/v2/domains/{domain_name}/records
  // NOTE: No X-Signature per docs
  DNS_REMOVE: {
    method: 'DELETE',
    pathTemplate: '/restful/v2/domains/{domain_name}/records',
    signed: false,
    sandboxSupport: 'SUPPORTED',
    expectedSuccessCodes: [200],
    description: 'Remove DNS records from a domain',
  },

  // ── DNSSEC ──
  // Docs: GET_DNSSEC Command — GET /restful/v2/domains/{domain_name}/dnssec
  DNSSEC_GET: {
    method: 'GET',
    pathTemplate: '/restful/v2/domains/{domain_name}/dnssec',
    signed: true,
    sandboxSupport: 'SUPPORTED',
    expectedSuccessCodes: [200],
    description: 'Get DNSSEC records',
  },
  // Docs: SET_DNSSEC Command — PUT /restful/v2/domains/{domain_name}/dnssec
  DNSSEC_SET: {
    method: 'PUT',
    pathTemplate: '/restful/v2/domains/{domain_name}/dnssec',
    signed: true,
    sandboxSupport: 'SUPPORTED',
    expectedSuccessCodes: [200],
    description: 'Set DNSSEC records',
  },
  // Docs: CLEAR_DNSSEC Command — DELETE /restful/v2/domains/{domain_name}/dnssec
  DNSSEC_CLEAR: {
    method: 'DELETE',
    pathTemplate: '/restful/v2/domains/{domain_name}/dnssec',
    signed: true,
    sandboxSupport: 'SUPPORTED',
    expectedSuccessCodes: [200],
    description: 'Clear DNSSEC records',
  },

  // ── Contacts ──
  // Docs: GET_CONTACT Command — GET /restful/v2/contacts/{contact_id}
  CONTACT_GET: {
    method: 'GET',
    pathTemplate: '/restful/v2/contacts/{contact_id}',
    signed: true,
    sandboxSupport: 'SUPPORTED',
    expectedSuccessCodes: [200],
    description: 'Get contact by ID',
  },
  // Docs: CONTACT_LIST Command — GET /restful/v2/contacts
  CONTACT_LIST: {
    method: 'GET',
    pathTemplate: '/restful/v2/contacts',
    signed: true,
    sandboxSupport: 'SUPPORTED',
    expectedSuccessCodes: [200],
    description: 'List contacts',
  },
  // Docs: CONTACT_CREATE Command — POST /restful/v2/contacts
  CONTACT_CREATE: {
    method: 'POST',
    pathTemplate: '/restful/v2/contacts',
    signed: true,
    sandboxSupport: 'SUPPORTED',
    expectedSuccessCodes: [200],
    description: 'Create a contact',
  },
  // Docs: CONTACT_UPDATE Command — PUT /restful/v2/contacts/{contact_id}
  CONTACT_UPDATE: {
    method: 'PUT',
    pathTemplate: '/restful/v2/contacts/{contact_id}',
    signed: true,
    sandboxSupport: 'SUPPORTED',
    expectedSuccessCodes: [200, 202],
    description: 'Update a contact (may return 202 for async processing)',
  },
  // Docs: CONTACT_DELETE Command — DELETE /restful/v2/contacts/{contact_id}
  CONTACT_DELETE: {
    method: 'DELETE',
    pathTemplate: '/restful/v2/contacts/{contact_id}',
    signed: true,
    sandboxSupport: 'SUPPORTED',
    expectedSuccessCodes: [200],
    description: 'Delete a contact',
  },
  // Docs: SET_CONTACTS Command — PUT /restful/v2/domains/{domain_name}/contacts
  DOMAIN_SET_CONTACTS: {
    method: 'PUT',
    pathTemplate: '/restful/v2/domains/{domain_name}/contacts',
    signed: true,
    sandboxSupport: 'SUPPORTED',
    expectedSuccessCodes: [200, 202],
    description: 'Set domain contacts (may return 202 for async processing)',
  },

  // ── Privacy ──
  // Docs: SET_PRIVACY Command — PUT /restful/v2/domains/{domain_name}/privacy
  PRIVACY_SET: {
    method: 'PUT',
    pathTemplate: '/restful/v2/domains/{domain_name}/privacy',
    signed: true,
    sandboxSupport: 'SUPPORTED',
    expectedSuccessCodes: [200],
    description: 'Set domain privacy level (full/partial/none)',
  },

  // ── Transfer ──
  // Docs: TRANSFER_IN Command — POST /restful/v2/domains/{domain_name}/transfer_in
  // NOTE: Path is under /domains, not /transfers
  TRANSFER_IN: {
    method: 'POST',
    pathTemplate: '/restful/v2/domains/{domain_name}/transfer_in',
    signed: true,
    sandboxSupport: 'SUPPORTED',
    expectedSuccessCodes: [200, 202],
    description: 'Initiate transfer-in',
  },
  // Docs: GET_TRANSFER_STATUS Command — GET /restful/v2/domains/{domain_name}/transfer_status
  // NOTE: No X-Signature per docs
  TRANSFER_STATUS: {
    method: 'GET',
    pathTemplate: '/restful/v2/domains/{domain_name}/transfer_status',
    signed: false,
    sandboxSupport: 'SUPPORTED',
    expectedSuccessCodes: [200],
    description: 'Get transfer status',
  },
  // Docs: CANCEL_TRANSFER Command — POST /restful/v2/orders/{order_id}/cancel_transfer
  // NOTE: This is under /orders, not /transfers or /domains
  TRANSFER_CANCEL: {
    method: 'POST',
    pathTemplate: '/restful/v2/orders/{order_id}/cancel_transfer',
    signed: true,
    sandboxSupport: 'SUPPORTED',
    expectedSuccessCodes: [200],
    description: 'Cancel a pending transfer',
  },
  // Docs: AUTHORIZE_TRANSFER_AWAY Command — POST /restful/v2/orders/{order_id}/authorize_transfer_away
  TRANSFER_AUTHORIZE_AWAY: {
    method: 'POST',
    pathTemplate: '/restful/v2/orders/{order_id}/authorize_transfer_away',
    signed: true,
    sandboxSupport: 'SUPPORTED',
    expectedSuccessCodes: [200],
    description: 'Authorize or reject transfer-away',
  },
  // Docs: SET_TRANSFER_AUTH_CODE Command — POST /restful/v2/orders/{order_id}/update_transfer_auth_code
  TRANSFER_SET_AUTH_CODE: {
    method: 'POST',
    pathTemplate: '/restful/v2/orders/{order_id}/update_transfer_auth_code',
    signed: true,
    sandboxSupport: 'SUPPORTED',
    expectedSuccessCodes: [200],
    description: 'Update transfer auth code',
  },
  // Docs: GET_TRANSFER_AUTH_CODE Command — GET /restful/v2/domains/{domain_name}/transfer_auth_code
  TRANSFER_GET_AUTH_CODE: {
    method: 'GET',
    pathTemplate: '/restful/v2/domains/{domain_name}/transfer_auth_code',
    signed: true,
    sandboxSupport: 'SUPPORTED',
    expectedSuccessCodes: [200],
    description: 'Get domain transfer auth code',
  },

  // ── Domain Lock ──
  // Docs: SET_DOMAIN_LOCK_STATUS Command — PUT /restful/v2/domains/{domain_name}/domain_lock
  // NOTE: Path is /domain_lock not /lock
  DOMAIN_LOCK: {
    method: 'PUT',
    pathTemplate: '/restful/v2/domains/{domain_name}/domain_lock',
    signed: true,
    sandboxSupport: 'SUPPORTED',
    expectedSuccessCodes: [200],
    description: 'Set domain lock status',
  },

  // ── TLD Pricing ──
  // Docs: DOMAIN_GET_TLD_PRICE Command — GET /restful/v2/domains/get_tld_price
  TLD_PRICING: {
    method: 'GET',
    pathTemplate: '/restful/v2/domains/get_tld_price',
    signed: false,
    sandboxSupport: 'SUPPORTED',
    expectedSuccessCodes: [200],
    description: 'Get TLD prices',
  },

  // ── Orders ──
  // Docs: ORDER_GET_STATUS Command — GET /restful/v2/orders/{order_id}
  ORDER_GET_STATUS: {
    method: 'GET',
    pathTemplate: '/restful/v2/orders/{order_id}',
    signed: true,
    sandboxSupport: 'SUPPORTED',
    expectedSuccessCodes: [200],
    description: 'Get order status',
  },
  // Docs: ORDER_GET_HISTORY Command — GET /restful/v2/orders
  ORDER_LIST: {
    method: 'GET',
    pathTemplate: '/restful/v2/orders',
    signed: true,
    sandboxSupport: 'SUPPORTED',
    expectedSuccessCodes: [200],
    description: 'Get order history with pagination',
  },

  // ── Account ──
  // Docs: ACCOUNT_INFO Command — GET /restful/v2/accounts/info
  // NOTE: Path is /accounts (plural) not /account
  ACCOUNT_INFO: {
    method: 'GET',
    pathTemplate: '/restful/v2/accounts/info',
    signed: true,
    sandboxSupport: 'SUPPORTED',
    expectedSuccessCodes: [200],
    description: 'Get account info',
  },

  // ── Forwarding ──
  // Docs: SET_DOMAIN_FORWARDING Command — PUT /restful/v2/domains/{domain_name}/domain_forwarding
  // NOTE: Path is /domain_forwarding not /forwarding
  DOMAIN_FORWARDING_SET: {
    method: 'PUT',
    pathTemplate: '/restful/v2/domains/{domain_name}/domain_forwarding',
    signed: true,
    sandboxSupport: 'SUPPORTED',
    expectedSuccessCodes: [200],
    description: 'Set domain URL forwarding (301/302 redirect)',
  },
  // Docs: SET_STEALTH_FORWARDING Command — PUT /restful/v2/domains/{domain_name}/stealth_forwarding
  STEALTH_FORWARDING_SET: {
    method: 'PUT',
    pathTemplate: '/restful/v2/domains/{domain_name}/stealth_forwarding',
    signed: true,
    sandboxSupport: 'SUPPORTED',
    expectedSuccessCodes: [200],
    description: 'Set stealth/masked forwarding (iframe)',
  },
  // Docs: SET_EMAIL_FORWARDING Command — PUT /restful/v2/domains/{domain_name}/email_forwarding
  EMAIL_FORWARDING_SET: {
    method: 'PUT',
    pathTemplate: '/restful/v2/domains/{domain_name}/email_forwarding',
    signed: true,
    sandboxSupport: 'SUPPORTED',
    expectedSuccessCodes: [200],
    description: 'Set email forwarding',
  },
} as const satisfies Record<string, EndpointDescriptor>;

export type EndpointName = keyof typeof ENDPOINTS;
