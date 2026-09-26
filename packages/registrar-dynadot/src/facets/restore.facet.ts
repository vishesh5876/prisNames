/**
 * PrisNames — Dynadot Restore Facet
 */

import type { DomainRestoreCapability } from '@prisnames/registrar-core';
import type { RestoreDomainParams } from '@prisnames/registrar-core';
import { ProviderOperationStatus } from '@prisnames/registrar-core';
import type { ProviderOperationResult } from '@prisnames/registrar-core';
import type { DynadotHttpClient } from '../http-client.js';
import { ENDPOINTS } from '../endpoints.js';

export class DynadotRestoreFacet implements DomainRestoreCapability {
  constructor(private readonly client: DynadotHttpClient) {}

  async restoreDomain(params: RestoreDomainParams): Promise<ProviderOperationResult> {
    const body: Record<string, unknown> = {};
    if (params.currency) body.currency = params.currency;
    if (params.couponCode) body.coupon_code = params.couponCode;

    const response = await this.client.request<{
      order_id?: number;
    }>(ENDPOINTS.DOMAIN_RESTORE, {
      path: `domains/${encodeURIComponent(params.domain)}/restore`,
      body,
      context: params.context,
    });

    return {
      status: response.status === 202
        ? ProviderOperationStatus.ACCEPTED
        : ProviderOperationStatus.SUCCEEDED,
      providerOrderId: response.data.order_id != null ? String(response.data.order_id) : undefined,
      providerRequestId: response.requestId,
      rawHttpStatus: response.status,
    };
  }
}
