/**
 * PrisNames — Domain Auto-Renew Option Capability
 */

import type { RenewOption } from '../../models/common.js';

export interface DomainRenewOptionCapability {
  /** Set the auto-renew option for a domain. */
  setRenewOption(domain: string, option: RenewOption): Promise<void>;
}
