/**
 * PrisNames — Domain Registration Capability
 */

import type { RegisterDomainParams } from '../../models/registration.js';
import type { ProviderOperationResult } from '../../models/operation-result.js';

export interface DomainRegistrationCapability {
  /** Register a domain name. Returns SUCCEEDED, ACCEPTED, UNKNOWN, or FAILED. */
  registerDomain(params: RegisterDomainParams): Promise<ProviderOperationResult>;
}
