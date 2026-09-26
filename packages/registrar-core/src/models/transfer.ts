/**
 * PrisNames — Transfer Models
 *
 * Covers Dynadot's actual transfer workflow:
 * - Transfer-in: initiate → status → cancel → set auth code
 * - Transfer-away: get auth code → unlock (via DomainLockCapability) → authorize
 *
 * Auth/EPP codes are EPHEMERAL sensitive data.
 * Never log, never persist in metadata, never put in BullMQ payloads unencrypted.
 */

import type { OperationContext } from './operation-result.js';

// ──────────────────────────────────────────────
// TRANSFER-IN
// ──────────────────────────────────────────────

export interface TransferInParams {
  readonly domain: string;
  readonly authCode: string;
  readonly transferPremium?: boolean;
  readonly currency?: string;
  readonly couponCode?: string;
  readonly context?: OperationContext;
}

export interface CancelTransferParams {
  readonly orderId: number;
  readonly domain: string;
  readonly context?: OperationContext;
}

export interface SetAuthCodeParams {
  readonly orderId: number;
  readonly domain: string;
  /** Ephemeral — clear from memory after use */
  readonly authCode: string;
  readonly context?: OperationContext;
}

// ──────────────────────────────────────────────
// TRANSFER STATUS
// ──────────────────────────────────────────────

export interface TransferStatusResult {
  readonly domain: string;
  readonly statusEntries: TransferStatusEntry[];
}

export interface TransferStatusEntry {
  readonly type: string;
  readonly status: string;
  readonly description?: string;
  readonly date?: Date;
}

// ──────────────────────────────────────────────
// TRANSFER-AWAY
// ──────────────────────────────────────────────

/** Auth code result — ephemeral, never log or persist */
export interface AuthCodeResult {
  readonly authCode: string;
}

export interface AuthorizeTransferAwayParams {
  readonly orderId: number;
  readonly domain: string;
  readonly approve: boolean;
  readonly context?: OperationContext;
}
