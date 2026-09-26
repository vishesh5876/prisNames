/**
 * PrisNames — Domain Transfer-In Capability
 *
 * Covers: initiating transfer-in, checking status, cancelling transfer,
 * and setting transfer auth code.
 */

import type { ProviderOperationResult } from '../../models/operation-result.js';
import type {
  TransferInParams,
  TransferStatusResult,
  SetAuthCodeParams,
  CancelTransferParams,
} from '../../models/transfer.js';

export interface DomainTransferInCapability {
  /** Initiate an inbound domain transfer. */
  transferIn(params: TransferInParams): Promise<ProviderOperationResult>;

  /** Get the status of a pending transfer. */
  getTransferStatus(orderId: number): Promise<TransferStatusResult>;

  /** Cancel a pending transfer. */
  cancelTransfer(params: CancelTransferParams): Promise<ProviderOperationResult>;

  /** Set the auth/EPP code for a transfer. */
  setTransferAuthCode(params: SetAuthCodeParams): Promise<ProviderOperationResult>;
}
