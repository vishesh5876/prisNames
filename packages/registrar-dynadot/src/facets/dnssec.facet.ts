/**
 * PrisNames — Dynadot DNSSEC Facet
 */

import type { DomainDnssecCapability } from '@prisnames/registrar-core';
import type { DnssecInfo, DnssecParams } from '@prisnames/registrar-core';
import type { DynadotHttpClient } from '../http-client.js';
import { ENDPOINTS } from '../endpoints.js';

export class DynadotDnssecFacet implements DomainDnssecCapability {
  constructor(private readonly client: DynadotHttpClient) {}

  async getDnssec(domain: string): Promise<DnssecInfo> {
    const response = await this.client.request<{
      dnssec_record_list?: Array<{
        key_tag?: number;
        algorithm?: number;
        digest_type?: number;
        digest?: string;
      }>;
    }>(ENDPOINTS.DNSSEC_GET, {
      path: `domains/${encodeURIComponent(domain)}/dnssec`,
    });

    const records = response.data.dnssec_record_list ?? [];
    return {
      enabled: records.length > 0,
      records: records.map(r => ({
        keyTag: r.key_tag ?? 0,
        algorithm: r.algorithm ?? 0,
        digestType: r.digest_type ?? 0,
        digest: r.digest ?? '',
      })),
    };
  }

  async setDnssec(params: DnssecParams): Promise<void> {
    await this.client.request(ENDPOINTS.DNSSEC_SET, {
      path: `domains/${encodeURIComponent(params.domain)}/dnssec`,
      body: {
        dnssec_record_list: params.records.map(r => ({
          key_tag: r.keyTag,
          algorithm: r.algorithm,
          digest_type: r.digestType,
          digest: r.digest,
        })),
      },
    });
  }

  async clearDnssec(domain: string): Promise<void> {
    await this.client.request(ENDPOINTS.DNSSEC_CLEAR, {
      path: `domains/${encodeURIComponent(domain)}/dnssec`,
    });
  }
}
