/**
 * PrisNames — Domain DNS Management Capability
 */

import type { DnsRecord, SetDnsParams, RemoveDnsParams } from '../../models/dns.js';

export interface DomainDnsCapability {
  /** Get DNS records for a domain. */
  getDnsRecords(domain: string): Promise<DnsRecord[]>;

  /** Set DNS records for a domain (replace). */
  setDnsRecords(params: SetDnsParams): Promise<void>;

  /** Remove specific DNS records from a domain. */
  removeDnsRecords(params: RemoveDnsParams): Promise<void>;
}
