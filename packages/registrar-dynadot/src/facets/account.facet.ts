/**
 * PrisNames — Dynadot Account Info Capability Facet
 *
 * Uses ENDPOINTS.ACCOUNT_INFO (signed: true) — account info requires X-Signature.
 */

import type { RegistrarAccountCapability, AccountInfo } from '@prisnames/registrar-core';
import { parseMoneyFromDecimal } from '@prisnames/registrar-core';
import type { DynadotHttpClient } from '../http-client.js';
import { ENDPOINTS } from '../endpoints.js';

export class DynadotAccountFacet implements RegistrarAccountCapability {
  private readonly client: DynadotHttpClient;

  constructor(client: DynadotHttpClient) {
    this.client = client;
  }

  async getAccountInfo(): Promise<AccountInfo> {
    const response = await this.client.request<DynadotAccountInfoWrapper>(
      ENDPOINTS.ACCOUNT_INFO,
      { path: 'accounts/info' },
    );

    // Sandbox returns { account_info: { ... } }, normalize to flat access
    const info = response.data.account_info ?? response.data;

    return {
      balance: info.account_balance != null
        ? parseMoneyFromDecimal(
            String(info.account_balance),
            info.default_currency ?? 'USD',
          )
        : undefined,
      currency: info.default_currency,
      accountId: info.account_id != null ? String(info.account_id) : undefined,
    };
  }
}

// Internal — NOT exported from package root
interface DynadotAccountInfoFields {
  account_balance?: number | string;
  default_currency?: string;
  account_id?: number | string;
}

interface DynadotAccountInfoWrapper extends DynadotAccountInfoFields {
  /** Real sandbox nests fields inside account_info */
  account_info?: DynadotAccountInfoFields;
}
