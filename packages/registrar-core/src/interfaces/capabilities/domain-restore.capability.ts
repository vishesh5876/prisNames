/**
 * PrisNames — Domain Restore Capability
 */

import type { RestoreDomainParams } from '../../models/registration.js';
import type { ProviderOperationResult } from '../../models/operation-result.js';

export interface DomainRestoreCapability {
  /** Restore a domain from redemption grace period. */
  restoreDomain(params: RestoreDomainParams): Promise<ProviderOperationResult>;
}
