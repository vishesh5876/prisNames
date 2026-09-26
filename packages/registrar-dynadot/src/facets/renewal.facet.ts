/**
 * PrisNames — Dynadot Renewal Facet
 */

import type { DomainRenewalCapability } from '@prisnames/registrar-core';
import type { RenewDomainParams } from '@prisnames/registrar-core';
import { ProviderOperationStatus } from '@prisnames/registrar-core';
import type { ProviderOperationResult } from '@prisnames/registrar-core';
import type { DynadotHttpClient } from '../http-client.js';
import { ENDPOINTS } from '../endpoints.js';

export class DynadotRenewalFacet implements DomainRenewalCapability {
  constructor(private readonly client: DynadotHttpClient) {}

  async renewDomain(params: RenewDomainParams): Promise<ProviderOperationResult> {
    const body: Record<string, unknown> = {};
    if (params.duration !== undefined) body.duration = params.duration;
    if (params.year !== undefined) body.year = params.year;
    if (params.currency) body.currency = params.currency;
    if (params.couponCode) body.coupon_code = params.couponCode;
    if (params.noRenewIfLateFee !== undefined) body.no_renew_if_late_renew_fee_needed = params.noRenewIfLateFee;

    const response = await this.client.request<{
      expiration_date?: number;
      order_id?: number;
    }>(ENDPOINTS.DOMAIN_RENEW, {
      path: `domains/${encodeURIComponent(params.domain)}/renew`,
      body,
      context: params.context,
    });

    return {
      status: response.status === 202
        ? ProviderOperationStatus.ACCEPTED
        : ProviderOperationStatus.SUCCEEDED,
      providerOrderId: response.data.order_id != null ? String(response.data.order_id) : undefined,
      providerRequestId: response.requestId,
      expiresAt: response.data.expiration_date
        ? new Date(response.data.expiration_date)
        : undefined,
      rawHttpStatus: response.status,
    };
  }
}
