/**
 * PrisNames — Dynadot Transfer-In Facet
 *
 * Auth/EPP code is sensitive ephemeral input.
 * Never logged, never persisted in generic operation metadata.
 */

import type { DomainTransferInCapability } from '@prisnames/registrar-core';
import type { TransferInParams, CancelTransferParams, SetAuthCodeParams, TransferStatusResult } from '@prisnames/registrar-core';
import { ProviderOperationStatus } from '@prisnames/registrar-core';
import type { ProviderOperationResult } from '@prisnames/registrar-core';
import type { DynadotHttpClient } from '../http-client.js';
import { ENDPOINTS } from '../endpoints.js';

export class DynadotTransferInFacet implements DomainTransferInCapability {
  constructor(private readonly client: DynadotHttpClient) {}

  async transferIn(params: TransferInParams): Promise<ProviderOperationResult> {
    const body: Record<string, unknown> = {
      auth_code: params.authCode, // Ephemeral — cleared after transmission
    };
    if (params.transferPremium) body.transfer_premium = true;
    if (params.currency) body.currency = params.currency;
    if (params.couponCode) body.coupon_code = params.couponCode;

    const response = await this.client.request<{
      order_id?: number;
      domain_name?: string;
    }>(ENDPOINTS.TRANSFER_IN, {
      path: `domains/${encodeURIComponent(params.domain)}/transfer_in`,
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

  async getTransferStatus(orderId: number): Promise<TransferStatusResult> {
    const response = await this.client.request<{
      domain_transfer_status_list?: Array<{
        type?: string;
        status?: string;
        description?: string;
        date?: string;
      }>;
    }>(ENDPOINTS.TRANSFER_STATUS, {
      path: `domains/transfer_status`,
      params: { order_id: String(orderId), transfer_type: 'in' },
    });

    return {
      domain: '',
      statusEntries: (response.data.domain_transfer_status_list ?? []).map(entry => ({
        type: entry.type ?? '',
        status: entry.status ?? '',
        description: entry.description,
        date: entry.date ? new Date(entry.date) : undefined,
      })),
    };
  }

  async cancelTransfer(params: CancelTransferParams): Promise<ProviderOperationResult> {
    const response = await this.client.request(ENDPOINTS.TRANSFER_CANCEL, {
      path: `orders/${params.orderId}/cancel_transfer`,
      body: { domain_name: params.domain },
      context: params.context,
    });

    return {
      status: ProviderOperationStatus.SUCCEEDED,
      providerRequestId: response.requestId,
      rawHttpStatus: response.status,
    };
  }

  async setTransferAuthCode(params: SetAuthCodeParams): Promise<ProviderOperationResult> {
    const response = await this.client.request(ENDPOINTS.TRANSFER_SET_AUTH_CODE, {
      path: `orders/${params.orderId}/update_transfer_auth_code`,
      body: {
        domain_name: params.domain,
        auth_code: params.authCode, // Ephemeral
      },
      context: params.context,
    });

    return {
      status: ProviderOperationStatus.SUCCEEDED,
      providerRequestId: response.requestId,
      rawHttpStatus: response.status,
    };
  }
}
