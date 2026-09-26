/**
 * PrisNames — Domain Info Capability
 */

import type { DomainInfo, DomainSummary } from '../../models/domain.js';
import type { PaginatedResult } from '../../models/common.js';

export interface DomainInfoCapability {
  /** Get detailed information about a specific domain. */
  getDomainInfo(domain: string): Promise<DomainInfo>;

  /** List domains in the account. */
  listDomains(page?: number, pageSize?: number): Promise<PaginatedResult<DomainSummary>>;
}
