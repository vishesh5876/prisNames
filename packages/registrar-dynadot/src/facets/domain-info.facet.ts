/**
 * PrisNames — Dynadot Domain Info Facet
 */

import type { DomainInfoCapability } from '@prisnames/registrar-core';
import type { DomainInfo, DomainSummary } from '@prisnames/registrar-core';
import type { PaginatedResult } from '@prisnames/registrar-core';
import type { DynadotHttpClient } from '../http-client.js';
import { ENDPOINTS } from '../endpoints.js';

export class DynadotDomainInfoFacet implements DomainInfoCapability {
  constructor(private readonly client: DynadotHttpClient) {}

  async getDomainInfo(domain: string): Promise<DomainInfo> {
    const response = await this.client.request<{
      domain_info?: Record<string, unknown>;
    }>(ENDPOINTS.DOMAIN_INFO, {
      path: `domains/${encodeURIComponent(domain)}`,
    });

    return this.mapDomainInfo(response.data.domain_info ?? {}, domain);
  }

  async listDomains(page = 1, pageSize = 25): Promise<PaginatedResult<DomainSummary>> {
    const response = await this.client.request<{
      domain_info_list?: Array<Record<string, unknown>>;
      pagination_result?: {
        total_count?: number;
        current_page?: number;
        page_size?: number;
      };
    }>(ENDPOINTS.DOMAIN_LIST, {
      path: 'domains',
      params: {
        page: String(page),
        page_size: String(pageSize),
      },
    });

    const list = response.data.domain_info_list ?? [];
    const pagination = response.data.pagination_result ?? {};

    return {
      items: list.map(d => this.mapDomainSummary(d)),
      total: Number(pagination.total_count ?? 0),
      page: Number(pagination.current_page ?? page),
      pageSize: Number(pagination.page_size ?? pageSize),
      hasMore: list.length >= pageSize,
    };
  }

  private mapDomainInfo(raw: Record<string, unknown>, domain: string): DomainInfo {
    return {
      domainName: (raw.domain_name as string) ?? domain,
      status: (raw.status as string) ?? 'unknown',
      expirationDate: raw.expiration_date ? new Date(raw.expiration_date as number) : undefined,
      registrationDate: raw.registration_date ? new Date(raw.registration_date as number) : undefined,
      // Sandbox-verified: renew_option values are 'auto' / 'donot' / 'reset'
      autoRenew: raw.renew_option !== undefined ? raw.renew_option === 'auto' : undefined,
      locked: raw.is_locked !== undefined ? Boolean(raw.is_locked) : undefined,
      privacy: raw.privacy as string | undefined,
      nameservers: raw.nameserver_list as string[] | undefined,
      contactIds: raw.registrant_contact_id ? {
        registrant: String(raw.registrant_contact_id),
        admin: raw.admin_contact_id ? String(raw.admin_contact_id) : undefined,
        tech: raw.technical_contact_id ? String(raw.technical_contact_id) : undefined,
        billing: raw.billing_contact_id ? String(raw.billing_contact_id) : undefined,
      } : undefined,
    };
  }

  private mapDomainSummary(raw: Record<string, unknown>): DomainSummary {
    return {
      domainName: (raw.domain_name as string) ?? '',
      status: (raw.status as string) ?? 'unknown',
      expirationDate: raw.expiration_date ? new Date(raw.expiration_date as number) : undefined,
    };
  }
}
