/**
 * PrisNames — Dynadot TLD Pricing Capability Facet
 *
 * TLD pricing: GET /restful/v2/domains/get_tld_price (NOT /tlds/pricing)
 *
 * Sandbox response shape (verified 2026-09-13):
 *   all_years_register_price: string[]   — index 0 = year-1 price
 *   all_years_renew_price: string[]      — index 0 = year-1 price
 *   transfer_price: string
 *   restore_price: string
 *
 * Sentinel values (real sandbox data):
 *   "--"  → price unavailable (NOT zero, NOT an error)
 *   "0.00" → genuinely free
 *
 * DO NOT pass "--" into parseMoneyFromDecimal.
 * DO NOT silently convert "--" to zero.
 */

import type {
  DomainPricingCapability,
  TldPrice,
  TldPriceParams,
  PaginatedResult,
  MoneyAmount,
} from '@prisnames/registrar-core';
import { parseMoneyFromDecimal } from '@prisnames/registrar-core';
import type { DynadotHttpClient } from '../http-client.js';
import { ENDPOINTS } from '../endpoints.js';

export class DynadotPricingFacet implements DomainPricingCapability {
  private readonly client: DynadotHttpClient;

  constructor(client: DynadotHttpClient) {
    this.client = client;
  }

  async getTldPrices(params: TldPriceParams): Promise<PaginatedResult<TldPrice>> {
    const currency = params.currency ?? 'USD';
    const queryParams: Record<string, string> = { currency };

    if (params.tlds?.length) {
      queryParams.tlds = params.tlds.join(',');
    }
    if (params.page !== undefined) {
      queryParams.page = String(params.page);
    }
    if (params.pageSize !== undefined) {
      queryParams.page_size = String(params.pageSize);
    }

    const response = await this.client.request<DynadotPricingResponse>(
      ENDPOINTS.TLD_PRICING,
      {
        path: 'domains/get_tld_price',
        params: queryParams,
      },
    );

    const tldPrices = Array.isArray(response.data?.tld_price_list)
      ? response.data.tld_price_list
      : [];

    // Pagination fields from real sandbox response
    const responsePage = response.data?.page;
    const responsePageSize = response.data?.page_size;

    const items: TldPrice[] = tldPrices.map((p) => ({
      tld: p.tld ?? '',
      // Year-1 price: all_years_register_price[0] or legacy register_price
      registerPrice: parsePriceSafe(
        p.all_years_register_price?.[0] ?? p.register_price,
        currency,
      ),
      renewPrice: parsePriceSafe(
        p.all_years_renew_price?.[0] ?? p.renew_price,
        currency,
      ),
      transferPrice: parsePriceSafe(p.transfer_price, currency),
      restorePrice: parsePriceSafe(p.restore_price, currency),
      currency,
      // Preserve full multi-year schedules at provider boundary
      _providerMultiYearRegister: p.all_years_register_price,
      _providerMultiYearRenew: p.all_years_renew_price,
    }));

    return {
      items,
      total: items.length,
      page: responsePage ?? params.page ?? 1,
      pageSize: responsePageSize ?? items.length,
      hasMore: false,
    };
  }
}

// ── Price Parsing ──

/**
 * Parse a provider price string to MoneyAmount, handling sentinels.
 *
 * Sentinel values:
 *   "--"  → undefined (unavailable)
 *   null/undefined → undefined
 *   ""   → undefined
 *   "0.00" → zero MoneyAmount (genuinely free)
 *   "12.99" → normal MoneyAmount
 *
 * @returns MoneyAmount or undefined for unavailable/absent prices
 */
function parsePriceSafe(
  value: string | number | null | undefined,
  currency: string,
): MoneyAmount | undefined {
  if (value == null) return undefined;
  const str = String(value).trim();
  // Provider sentinel for unavailable price
  if (str === '' || str === '--') return undefined;
  return parseMoneyFromDecimal(str, currency);
}

// ── Internal Response Types (NOT exported from package root) ──

interface DynadotPricingResponse {
  tld_price_list?: DynadotTldPriceEntry[];
  /** Pagination fields observed in real sandbox */
  page?: number;
  page_size?: number;
  sort?: string;
  price_level?: string;
  currency?: string;
  show_multi_year_price?: boolean;
}

interface DynadotTldPriceEntry {
  tld?: string;
  // Real sandbox shape: multi-year price arrays
  all_years_register_price?: string[];
  all_years_renew_price?: string[];
  // Legacy/simplified fields (may coexist)
  register_price?: string | number;
  renew_price?: string | number;
  // Single-value fields
  transfer_price?: string | number;
  restore_price?: string | number;
}

