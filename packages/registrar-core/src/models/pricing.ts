/**
 * PrisNames — Pricing Models
 */

import type { MoneyAmount } from './money.js';

export interface TldPrice {
  readonly tld: string;
  readonly registerPrice?: MoneyAmount;
  readonly renewPrice?: MoneyAmount;
  readonly transferPrice?: MoneyAmount;
  readonly restorePrice?: MoneyAmount;
  readonly currency: string;
  /** Provider multi-year register schedule (opaque passthrough). Index 0 = year 1. */
  readonly _providerMultiYearRegister?: readonly string[];
  /** Provider multi-year renew schedule (opaque passthrough). Index 0 = year 1. */
  readonly _providerMultiYearRenew?: readonly string[];
}

export interface TldPriceParams {
  readonly tlds?: string[];
  readonly currency?: string;
  readonly page?: number;
  readonly pageSize?: number;
}
