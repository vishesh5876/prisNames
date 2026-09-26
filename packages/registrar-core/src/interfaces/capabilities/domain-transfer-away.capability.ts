/**
 * PrisNames — Domain Transfer-Away Capability
 *
 * Covers: getting auth/EPP code and authorizing/rejecting transfer-away orders.
 * Domain lock/unlock is NOT part of this capability — use DomainLockCapability.
 */

import type { ProviderOperationResult } from '../../models/operation-result.js';
import type {
  AuthCodeResult,
  AuthorizeTransferAwayParams,
} from '../../models/transfer.js';

export interface DomainTransferAwayCapability {
  /** Get the auth/EPP code for a domain. Ephemeral — never log or persist. */
  getTransferAuthCode(domain: string): Promise<AuthCodeResult>;

  /** Authorize or reject a pending outbound transfer order. */
  authorizeTransferAway(params: AuthorizeTransferAwayParams): Promise<ProviderOperationResult>;
}
