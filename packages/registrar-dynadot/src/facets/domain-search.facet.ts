/**
 * PrisNames — Dynadot Domain Search Capability Facet
 *
 * Search endpoints (all unsigned GETs):
 * - Single: GET /restful/v2/domains/{domain_name}/search
 * - Bulk:   GET /restful/v2/domains/bulk_search
 * - Suggest: GET /restful/v2/domains/{domain_name}/suggestion_search
 */

import type {
  DomainSearchCapability,
  DomainAvailability,
  DomainSuggestion,
} from '@prisnames/registrar-core';
import { parseMoneyFromDecimal } from '@prisnames/registrar-core';
import type { DynadotHttpClient } from '../http-client.js';
import { ENDPOINTS } from '../endpoints.js';

/**
 * Normalize Dynadot's `available` field.
 * Sandbox returns string "Yes"/"No", docs may return boolean.
 */
function normalizeAvailable(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return value.toLowerCase() === 'yes';
  return false;
}

export class DynadotDomainSearchFacet implements DomainSearchCapability {
  private readonly client: DynadotHttpClient;

  constructor(client: DynadotHttpClient) {
    this.client = client;
  }

  async checkAvailability(domain: string, currency = 'USD'): Promise<DomainAvailability> {
    const response = await this.client.request<DynadotSearchResponse>(
      ENDPOINTS.DOMAIN_SEARCH,
      {
        path: `domains/${encodeURIComponent(domain)}/search`,
        params: { show_price: 'yes', currency },
      },
    );

    return this.mapSearchResult(response.data, currency);
  }

  async bulkCheckAvailability(domains: string[], currency = 'USD'): Promise<DomainAvailability[]> {
    // Dynadot REST v2 bulk_search uses domain_name_list body/params
    const response = await this.client.request<DynadotBulkSearchResponse>(
      ENDPOINTS.DOMAIN_BULK_SEARCH,
      {
        path: 'domains/bulk_search',
        params: {
          domain_name_list: domains.join(','),
          show_price: 'yes',
          currency,
        },
      },
    );

    const results = Array.isArray(response.data?.domain_result_list)
      ? response.data.domain_result_list
      : [];

    return results.map((r) => this.mapSearchResult(r, currency));
  }

  async suggestDomains(keyword: string, tlds?: string[], currency = 'USD'): Promise<DomainSuggestion[]> {
    const params: Record<string, string> = { currency };
    if (tlds?.length) {
      params.tlds = tlds.join(',');
    }

    const response = await this.client.request<DynadotSuggestionResponse>(
      ENDPOINTS.DOMAIN_SUGGESTION_SEARCH,
      {
        path: `domains/${encodeURIComponent(keyword)}/suggestion_search`,
        params,
      },
    );

    const suggestions = Array.isArray(response.data?.domain_list)
      ? response.data.domain_list
      : [];

    return suggestions.map((s) => ({
      domain: s.domain_name ?? '',
      available: normalizeAvailable(s.available),
      premium: s.premium === 'premium',
      price: s.price_list?.[0]?.register_price
        ? parseMoneyFromDecimal(String(s.price_list[0].register_price), currency)
        : undefined,
    }));
  }

  private mapSearchResult(data: DynadotSearchResponse, currency: string): DomainAvailability {
    const firstPrice = data.price_list?.[0];
    return {
      domain: data.domain_name ?? '',
      available: normalizeAvailable(data.available),
      premium: data.premium === 'premium',
      prices: firstPrice
        ? [{
            duration: 1,
            registerPrice: parseMoneyFromDecimal(
              String(firstPrice.register_price ?? '0'),
              currency,
            ),
            renewPrice: firstPrice.renew_price
              ? parseMoneyFromDecimal(String(firstPrice.renew_price), currency)
              : undefined,
            currency,
          }]
        : undefined,
    };
  }
}

// ── Response Types (internal — NOT exported from package root) ──

interface DynadotSearchResponse {
  domain_name?: string;
  available?: boolean | string; // Sandbox returns "Yes"/"No" strings
  premium?: string; // "premium" | "standard"
  price_list?: Array<{
    register_price?: number | string;
    renew_price?: number | string;
  }>;
}

interface DynadotBulkSearchResponse {
  domain_result_list?: DynadotSearchResponse[];
}

interface DynadotSuggestionResponse {
  domain_list?: Array<{
    domain_name?: string;
    available?: boolean;
    premium?: string;
    price_list?: Array<{
      register_price?: number | string;
    }>;
  }>;
}
