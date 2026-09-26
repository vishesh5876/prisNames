/**
 * PrisNames — Dynadot Transfer-Away Facet
 *
 * Auth code results are ephemeral — never log or persist.
 * Domain lock/unlock is in DomainLockCapability, NOT here.
 */

import type { DomainTransferAwayCapability } from '@prisnames/registrar-core';
import type { AuthCodeResult, AuthorizeTransferAwayParams } from '@prisnames/registrar-core';
import { ProviderOperationStatus } from '@prisnames/registrar-core';
import type { ProviderOperationResult } from '@prisnames/registrar-core';
import type { DynadotHttpClient } from '../http-client.js';
import { ENDPOINTS } from '../endpoints.js';

export class DynadotTransferAwayFacet implements DomainTransferAwayCapability {
  constructor(private readonly client: DynadotHttpClient) {}

  async getTransferAuthCode(domain: string): Promise<AuthCodeResult> {
    const response = await this.client.request<{
      auth_code?: string;
    }>(ENDPOINTS.TRANSFER_GET_AUTH_CODE, {
      path: `domains/${encodeURIComponent(domain)}/transfer_auth_code`,
    });

    return {
      authCode: response.data.auth_code ?? '',
    };
  }

  async authorizeTransferAway(params: AuthorizeTransferAwayParams): Promise<ProviderOperationResult> {
    const response = await this.client.request(ENDPOINTS.TRANSFER_AUTHORIZE_AWAY, {
      path: `orders/${params.orderId}/authorize_transfer_away`,
      body: {
        domain_name: params.domain,
        approve: params.approve,
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
