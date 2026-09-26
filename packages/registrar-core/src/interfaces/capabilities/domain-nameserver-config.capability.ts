/**
 * PrisNames — Domain Nameserver Configuration Capability
 *
 * Domain-level nameserver assignment (which nameservers serve this domain).
 * Separate from GlueRecordManagementCapability (managing nameserver objects themselves).
 */

import type { NameserverConfig } from '../../models/domain.js';

export interface DomainNameserverConfigCapability {
  /** Get the current nameservers for a domain. */
  getNameservers(domain: string): Promise<NameserverConfig>;

  /** Set nameservers for a domain. */
  setNameservers(domain: string, nameservers: string[]): Promise<void>;
}
