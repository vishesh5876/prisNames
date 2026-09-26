/**
 * PrisNames — Domain Grace Delete Capability
 *
 * Two distinct deletion operations:
 * - graceDelete: Within the grace period (typically 5 days), reversible, free
 * - postGraceDelete: After grace period, potentially irreversible, may incur fees
 */

import type { GraceDeleteParams, PostGraceDeleteParams } from '../../models/registration.js';
import type { ProviderOperationResult } from '../../models/operation-result.js';

export interface DomainGraceDeleteCapability {
  /** Delete a domain within the grace period. */
  graceDelete(params: GraceDeleteParams): Promise<ProviderOperationResult>;

  /** Delete a domain after the grace period. More destructive — may incur fees and is typically irreversible. */
  postGraceDelete(params: PostGraceDeleteParams): Promise<ProviderOperationResult>;
}
