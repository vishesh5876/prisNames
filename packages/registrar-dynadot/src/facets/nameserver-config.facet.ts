/**
 * PrisNames — Dynadot Nameserver Config Facet
 * Domain-level NS assignment (which nameservers serve this domain).
 */

import type { DomainNameserverConfigCapability } from '@prisnames/registrar-core';
import type { NameserverConfig } from '@prisnames/registrar-core';
import type { DynadotHttpClient } from '../http-client.js';
import { ENDPOINTS } from '../endpoints.js';

export class DynadotNameserverConfigFacet implements DomainNameserverConfigCapability {
  constructor(private readonly client: DynadotHttpClient) {}

  async getNameservers(domain: string): Promise<NameserverConfig> {
    const response = await this.client.request<{
      nameserver_list?: string[];
    }>(ENDPOINTS.NAMESERVER_GET, {
      path: `domains/${encodeURIComponent(domain)}/nameservers`,
    });

    return { nameservers: response.data.nameserver_list ?? [] };
  }

  async setNameservers(domain: string, nameservers: string[]): Promise<void> {
    await this.client.request(ENDPOINTS.NAMESERVER_SET, {
      path: `domains/${encodeURIComponent(domain)}/nameservers`,
      body: { nameserver_list: nameservers },
    });
  }
}
