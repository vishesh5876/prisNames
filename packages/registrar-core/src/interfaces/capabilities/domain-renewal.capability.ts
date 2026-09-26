/**
 * PrisNames — Domain Renewal Capability
 */

import type { RenewDomainParams } from '../../models/registration.js';
import type { ProviderOperationResult } from '../../models/operation-result.js';

export interface DomainRenewalCapability {
  /** Renew a domain name. Returns SUCCEEDED, ACCEPTED, UNKNOWN, or FAILED. */
  renewDomain(params: RenewDomainParams): Promise<ProviderOperationResult>;
}
