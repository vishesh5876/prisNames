/**
 * PrisNames — Dynadot Registration Facet
 *
 * Raw provider adapter for domain registration.
 * Normalized request → Dynadot request → signed call → response validation → normalized result.
 *
 * Status mapping:
 * - HTTP 200/201 → SUCCEEDED
 * - HTTP 202 → ACCEPTED (should not occur for registration, but handled)
 * - Post-dispatch timeout/disconnect → UNKNOWN (never auto-retry)
 * - 4xx → FAILED with error classification
 * - 5xx → error (circuit breaker may trip)
 */

import type { DomainRegistrationCapability } from '@prisnames/registrar-core';
import type { RegisterDomainParams } from '@prisnames/registrar-core';
import { ProviderOperationStatus } from '@prisnames/registrar-core';
import type { ProviderOperationResult } from '@prisnames/registrar-core';
import type { DynadotHttpClient } from '../http-client.js';
import { ENDPOINTS } from '../endpoints.js';

export class DynadotRegistrationFacet implements DomainRegistrationCapability {
  constructor(private readonly client: DynadotHttpClient) {}

  async registerDomain(params: RegisterDomainParams): Promise<ProviderOperationResult> {
    // Dynadot REST v2 requires a `domain` wrapper object containing
    // duration, privacy, and contact IDs. Currency goes at the top level.
    const domainObj: Record<string, unknown> = {
      duration: params.duration,
    };
    if (params.privacy) domainObj.privacy = params.privacy;
    if (params.registrantContactId != null) domainObj.registrant_contact_id = params.registrantContactId;
    if (params.adminContactId != null) domainObj.admin_contact_id = params.adminContactId;
    if (params.technicalContactId != null) domainObj.technical_contact_id = params.technicalContactId;
    if (params.billingContactId != null) domainObj.billing_contact_id = params.billingContactId;

    const body: Record<string, unknown> = {
      domain: domainObj,
    };
    if (params.currency) body.currency = params.currency;
    if (params.registerPremium) body.register_premium = true;
    if (params.couponCode) body.coupon_code = params.couponCode;

    const response = await this.client.request<{
      domain_name?: string;
      expiration_date?: number;
      order_id?: number;
    }>(ENDPOINTS.DOMAIN_REGISTER, {
      path: `domains/${encodeURIComponent(params.domain)}/register`,
      body,
      context: params.context,
    });

    const status = response.status === 202
      ? ProviderOperationStatus.ACCEPTED
      : ProviderOperationStatus.SUCCEEDED;

    return {
      status,
      providerOrderId: response.data.order_id != null ? String(response.data.order_id) : undefined,
      providerRequestId: response.requestId,
      expiresAt: (() => {
        const raw = response.data.expiration_date;
        if (raw == null) return undefined;
        const d = new Date(raw);
        return isNaN(d.getTime()) ? undefined : d;
      })(),
      rawHttpStatus: response.status,
    };
  }
}
