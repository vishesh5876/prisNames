/**
 * PrisNames — Dynadot Lock Facet
 *
 * Domain lock uses /restful/v2/domains/{domain_name}/domain_lock (NOT /lock)
 */

import type { DomainLockCapability } from '@prisnames/registrar-core';
import type { DynadotHttpClient } from '../http-client.js';
import { ENDPOINTS } from '../endpoints.js';

export class DynadotLockFacet implements DomainLockCapability {
  constructor(private readonly client: DynadotHttpClient) {}

  async setDomainLock(domain: string, locked: boolean): Promise<void> {
    await this.client.request(ENDPOINTS.DOMAIN_LOCK, {
      path: `domains/${encodeURIComponent(domain)}/domain_lock`,
      body: { lock: locked },
    });
  }
}
