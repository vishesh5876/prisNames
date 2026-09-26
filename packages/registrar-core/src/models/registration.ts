/**
 * PrisNames — Registration Models
 */

import type { OperationContext } from './operation-result.js';

export interface RegisterDomainParams {
  readonly domain: string;
  readonly duration: number;
  readonly currency?: string;
  readonly registerPremium?: boolean;
  readonly couponCode?: string;
  /** WHOIS privacy level: 'full' | 'partial' | 'none'. Dynadot REST v2 requires this. */
  readonly privacy?: string;
  /** Contact IDs to assign during registration. */
  readonly registrantContactId?: number;
  readonly adminContactId?: number;
  readonly technicalContactId?: number;
  readonly billingContactId?: number;
  readonly context?: OperationContext;
}

export interface RenewDomainParams {
  readonly domain: string;
  readonly duration?: number;
  readonly year?: number;
  readonly currency?: string;
  readonly couponCode?: string;
  readonly noRenewIfLateFee?: boolean;
  readonly context?: OperationContext;
}

export interface RestoreDomainParams {
  readonly domain: string;
  readonly currency?: string;
  readonly couponCode?: string;
  readonly context?: OperationContext;
}

export interface GraceDeleteParams {
  readonly domain: string;
  readonly context?: OperationContext;
}

/**
 * Post-grace-period delete. A separate, more destructive operation
 * than grace delete. May incur additional fees and is typically irreversible.
 */
export interface PostGraceDeleteParams {
  readonly domain: string;
  readonly context?: OperationContext;
}
