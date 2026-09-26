/**
 * PrisNames — Dynadot Privacy Facet
 */

import type { DomainPrivacyCapability } from '@prisnames/registrar-core';
import type { PrivacyLevel } from '@prisnames/registrar-core';
import type { DynadotHttpClient } from '../http-client.js';
import { ENDPOINTS } from '../endpoints.js';

const PRIVACY_MAP: Record<PrivacyLevel, string> = {
  full: 'full',
  partial: 'partial',
  none: 'off',
} as const;

export class DynadotPrivacyFacet implements DomainPrivacyCapability {
  constructor(private readonly client: DynadotHttpClient) {}

  async setPrivacy(domain: string, level: PrivacyLevel): Promise<void> {
    await this.client.request(ENDPOINTS.PRIVACY_SET, {
      path: `domains/${encodeURIComponent(domain)}/privacy`,
      // Dynadot REST v2 uses privacy_level (not privacy)
      body: { privacy_level: PRIVACY_MAP[level] },
    });
  }
}
