/**
 * PrisNames — Dynadot Grace Delete Facet
 *
 * Two deletion operations:
 * - graceDelete: Within grace period, typically free/reversible
 * - postGraceDelete: After grace period, may incur fees, typically irreversible
 */

import type { DomainGraceDeleteCapability } from '@prisnames/registrar-core';
import type { GraceDeleteParams, PostGraceDeleteParams } from '@prisnames/registrar-core';
import { ProviderOperationStatus } from '@prisnames/registrar-core';
import type { ProviderOperationResult } from '@prisnames/registrar-core';
import type { DynadotHttpClient } from '../http-client.js';
import { ENDPOINTS } from '../endpoints.js';

export class DynadotGraceDeleteFacet implements DomainGraceDeleteCapability {
  constructor(private readonly client: DynadotHttpClient) {}

  async graceDelete(params: GraceDeleteParams): Promise<ProviderOperationResult> {
    const response = await this.client.request(ENDPOINTS.DOMAIN_GRACE_DELETE, {
      path: `domains/${encodeURIComponent(params.domain)}/grace_delete`,
      context: params.context,
    });

    return {
      status: ProviderOperationStatus.SUCCEEDED,
      providerRequestId: response.requestId,
      rawHttpStatus: response.status,
    };
  }

  async postGraceDelete(params: PostGraceDeleteParams): Promise<ProviderOperationResult> {
    const response = await this.client.request(ENDPOINTS.DOMAIN_POST_GRACE_DELETE, {
      path: `domains/${encodeURIComponent(params.domain)}/post_grace_delete`,
      context: params.context,
    });

    return {
      status: ProviderOperationStatus.SUCCEEDED,
      providerRequestId: response.requestId,
      rawHttpStatus: response.status,
    };
  }
}
