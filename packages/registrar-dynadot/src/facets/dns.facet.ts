/**
 * PrisNames — Dynadot DNS Management Facet
 *
 * DNS records use /restful/v2/domains/{domain_name}/records (NOT /dns)
 *
 * Body shape (SET_DNS, verified by sandbox 2026-09-13):
 *   dns_main_list: [{ type, content, distance? }]
 *   dns_sub_list: [{ subdomain, type, content, distance? }]
 *   ttl: number (optional)
 *   add_dns_to_current_setting: boolean (optional)
 *
 * REMOVE_DNS body (verified by sandbox 2026-09-13):
 *   dns_main_list: [{ record_type }]   — no value/content needed
 *   dns_sub_list: [{ subdomain, record_type }]
 *
 * Response shape (GET_DNS per docs):
 *   data: { glue_info: { ... } }  OR  data: { dns_record_list: [...] }
 *   Exact shape to be confirmed by sandbox.
 */

import type { DomainDnsCapability } from '@prisnames/registrar-core';
import type { DnsRecord, SetDnsParams, RemoveDnsParams } from '@prisnames/registrar-core';
import type { DynadotHttpClient } from '../http-client.js';
import { ENDPOINTS } from '../endpoints.js';

export class DynadotDnsFacet implements DomainDnsCapability {
  constructor(private readonly client: DynadotHttpClient) {}

  async getDnsRecords(domain: string): Promise<DnsRecord[]> {
    const response = await this.client.request<{
      dns_record_list?: Array<Record<string, unknown>>;
      glue_info?: Record<string, unknown>;
      dns_main_list?: Array<Record<string, unknown>>;
      dns_sub_list?: Array<Record<string, unknown>>;
    }>(ENDPOINTS.DNS_GET, {
      path: `domains/${encodeURIComponent(domain)}/records`,
    });

    // Support multiple observed shapes from sandbox
    const records = response.data.dns_record_list
      ?? response.data.dns_main_list
      ?? [];

    return records.map(r => ({
      type: (r.record_type as string) ?? '',
      hostname: (r.hostname as string) ?? (r.subdomain as string) ?? '',
      value: (r.value as string) ?? '',
      ttl: r.ttl as number | undefined,
      priority: r.priority as number | undefined,
      distance: r.distance as number | undefined,
    }));
  }

  async setDnsRecords(params: SetDnsParams): Promise<void> {
    // Dynadot REST v2 uses dns_main_list for root records
    // and dns_sub_list for subdomain records
    const mainRecords: Array<Record<string, unknown>> = [];
    const subRecords: Array<Record<string, unknown>> = [];

    for (const r of params.records) {
      // Sandbox-verified: SET_DNS uses { type, content } (NOT record_type, value)
      const record: Record<string, unknown> = {
        type: r.type,
        content: r.value,
      };
      if (r.distance !== undefined) record.distance = r.distance;

      if (!r.hostname || r.hostname === '' || r.hostname === '@') {
        mainRecords.push(record);
      } else {
        subRecords.push({ subdomain: r.hostname, ...record });
      }
    }

    const body: Record<string, unknown> = {};
    if (mainRecords.length > 0) body.dns_main_list = mainRecords;
    if (subRecords.length > 0) body.dns_sub_list = subRecords;
    if (params.ttl !== undefined) body.ttl = params.ttl;
    if (params.addToCurrent !== undefined) body.add_dns_to_current_setting = params.addToCurrent;

    await this.client.request(ENDPOINTS.DNS_SET, {
      path: `domains/${encodeURIComponent(params.domain)}/records`,
      body,
    });
  }

  async removeDnsRecords(params: RemoveDnsParams): Promise<void> {
    const body: Record<string, unknown> = {};

    // Remove uses dns_main_list and dns_sub_list to specify which records to remove
    if (params.records?.length) {
      const mainRecords: Array<Record<string, unknown>> = [];
      const subRecords: Array<Record<string, unknown>> = [];

      for (const r of params.records) {
        // Sandbox-verified: REMOVE_DNS uses { record_type } only (no value/content)
        const record: Record<string, unknown> = {
          record_type: r.type,
        };
        if (!r.hostname || r.hostname === '' || r.hostname === '@') {
          mainRecords.push(record);
        } else {
          subRecords.push({ subdomain: r.hostname, ...record });
        }
      }

      if (mainRecords.length > 0) body.dns_main_list = mainRecords;
      if (subRecords.length > 0) body.dns_sub_list = subRecords;
    } else if (params.recordIds) {
      body.record_ids = params.recordIds;
    }

    await this.client.request(ENDPOINTS.DNS_REMOVE, {
      path: `domains/${encodeURIComponent(params.domain)}/records`,
      body: Object.keys(body).length > 0 ? body : undefined,
    });
  }
}

