/**
 * PrisNames — Domain DNSSEC Capability
 */

import type { DnssecInfo, DnssecParams } from '../../models/dns.js';

export interface DomainDnssecCapability {
  /** Get DNSSEC information for a domain. */
  getDnssec(domain: string): Promise<DnssecInfo>;

  /** Set DNSSEC records for a domain. */
  setDnssec(params: DnssecParams): Promise<void>;

  /** Clear all DNSSEC records from a domain. */
  clearDnssec(domain: string): Promise<void>;
}
