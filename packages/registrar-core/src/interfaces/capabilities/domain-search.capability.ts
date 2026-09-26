/**
 * PrisNames — Domain Search Capability
 *
 * Check domain availability, bulk search, and suggestions.
 */

import type { DomainAvailability, DomainSuggestion } from '../../models/search.js';

export interface DomainSearchCapability {
  /** Check availability of a single domain name */
  checkAvailability(domain: string, currency?: string): Promise<DomainAvailability>;

  /** Check availability of multiple domains (batch) */
  bulkCheckAvailability(domains: string[], currency?: string): Promise<DomainAvailability[]>;

  /** Get domain name suggestions based on a keyword */
  suggestDomains(keyword: string, tlds?: string[], currency?: string): Promise<DomainSuggestion[]>;
}
