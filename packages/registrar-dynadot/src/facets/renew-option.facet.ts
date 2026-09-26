/**
 * PrisNames — Dynadot Renew Option Facet
 */

import type { DomainRenewOptionCapability } from '@prisnames/registrar-core';
import type { RenewOption } from '@prisnames/registrar-core';
import type { DynadotHttpClient } from '../http-client.js';
import { ENDPOINTS } from '../endpoints.js';

// Sandbox-verified REST v2 enum values (2026-09-13):
//   "auto"   → auto-renew enabled
//   "donot"  → do not renew
//   "reset"  → reset to default
const RENEW_OPTION_MAP: Record<RenewOption, string> = {
  auto: 'auto',
  manual: 'donot',
  no_renew: 'reset',
} as const;

export class DynadotRenewOptionFacet implements DomainRenewOptionCapability {
  constructor(private readonly client: DynadotHttpClient) {}

  async setRenewOption(domain: string, option: RenewOption): Promise<void> {
    await this.client.request(ENDPOINTS.DOMAIN_SET_RENEW_OPTION, {
      path: `domains/${encodeURIComponent(domain)}/renew_option`,
      body: { renew_option: RENEW_OPTION_MAP[option] },
    });
  }
}
