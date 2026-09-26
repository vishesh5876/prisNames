/**
 * PrisNames — Domain Pricing Capability
 */

import type { TldPrice, TldPriceParams } from '../../models/pricing.js';
import type { PaginatedResult } from '../../models/common.js';

export interface DomainPricingCapability {
  /** Get TLD pricing information. */
  getTldPrices(params: TldPriceParams): Promise<PaginatedResult<TldPrice>>;
}
