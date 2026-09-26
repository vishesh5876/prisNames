/**
 * PrisNames — Dynadot Forwarding Facet
 *
 * Three separate REST v2 operations:
 * - Domain forwarding: /domains/{domain_name}/domain_forwarding (NOT /forwarding)
 * - Stealth forwarding: /domains/{domain_name}/stealth_forwarding
 * - Email forwarding: /domains/{domain_name}/email_forwarding
 */

import type { DomainForwardingCapability, DomainForwardingParams, StealthForwardingParams, EmailForwardingParams } from '@prisnames/registrar-core';
import type { DynadotHttpClient } from '../http-client.js';
import { ENDPOINTS } from '../endpoints.js';

export class DynadotForwardingFacet implements DomainForwardingCapability {
  constructor(private readonly client: DynadotHttpClient) {}

  async setDomainForwarding(domain: string, params: DomainForwardingParams): Promise<void> {
    const body: Record<string, unknown> = {
      forward_url: params.url,
      is_temporary: params.type !== 'permanent',
    };
    if (params.subdomainForwarding !== undefined) {
      body.enable_wildcard_forwarding = params.subdomainForwarding;
    }

    await this.client.request(ENDPOINTS.DOMAIN_FORWARDING_SET, {
      path: `domains/${encodeURIComponent(domain)}/domain_forwarding`,
      body,
    });
  }

  async setStealthForwarding(domain: string, params: StealthForwardingParams): Promise<void> {
    const body: Record<string, unknown> = {
      stealth_url: params.url,
    };
    if (params.title) body.stealth_title = params.title;

    await this.client.request(ENDPOINTS.STEALTH_FORWARDING_SET, {
      path: `domains/${encodeURIComponent(domain)}/stealth_forwarding`,
      body,
    });
  }

  async setEmailForwarding(domain: string, params: EmailForwardingParams): Promise<void> {
    await this.client.request(ENDPOINTS.EMAIL_FORWARDING_SET, {
      path: `domains/${encodeURIComponent(domain)}/email_forwarding`,
      body: { forward_to: params.forwardTo },
    });
  }

  async removeForwarding(domain: string): Promise<void> {
    // Remove by setting forwarding to empty/none
    await this.client.request(ENDPOINTS.DOMAIN_FORWARDING_SET, {
      path: `domains/${encodeURIComponent(domain)}/domain_forwarding`,
      body: { forward_url: '', is_temporary: true },
    });
  }
}
