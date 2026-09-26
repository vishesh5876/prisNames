/**
 * PrisNames — Search Models
 */

import type { MoneyAmount } from './money.js';

export interface DomainAvailability {
  readonly domain: string;
  readonly available: boolean;
  readonly premium: boolean;
  readonly prices?: DomainAvailabilityPrice[];
}

export interface DomainAvailabilityPrice {
  readonly duration: number;
  readonly registerPrice: MoneyAmount;
  readonly renewPrice?: MoneyAmount;
  readonly currency: string;
}

export interface DomainSuggestion {
  readonly domain: string;
  readonly available: boolean;
  readonly premium: boolean;
  readonly price?: MoneyAmount;
}
