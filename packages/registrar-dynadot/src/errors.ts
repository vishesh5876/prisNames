/**
 * PrisNames — Dynadot API Error
 *
 * Provider-specific error class wrapping ProviderError with Dynadot-specific context.
 */

import { ProviderError, ProviderErrorCode } from '@prisnames/registrar-core';

export class DynadotApiError extends ProviderError {
  readonly dynadotErrorCode?: string;
  readonly dynadotErrorMessage?: string;

  constructor(
    code: ProviderErrorCode,
    message: string,
    options?: {
      httpStatus?: number;
      providerRequestId?: string;
      retryable?: boolean;
      cause?: Error;
      dynadotErrorCode?: string;
      dynadotErrorMessage?: string;
    },
  ) {
    super(code, message, 'dynadot', {
      httpStatus: options?.httpStatus,
      providerRequestId: options?.providerRequestId,
      retryable: options?.retryable,
      cause: options?.cause,
    });
    this.name = 'DynadotApiError';
    this.dynadotErrorCode = options?.dynadotErrorCode;
    this.dynadotErrorMessage = options?.dynadotErrorMessage;
  }
}

// ──────────────────────────────────────────────
// ERROR CODE MAPPING
// ──────────────────────────────────────────────

/**
 * Map Dynadot-specific error codes/HTTP statuses to ProviderErrorCode.
 */
export function mapDynadotErrorCode(httpStatus: number, errorCode?: string): ProviderErrorCode {
  // HTTP status-based mapping
  if (httpStatus === 401 || httpStatus === 403) return ProviderErrorCode.AUTHENTICATION_ERROR;
  if (httpStatus === 402) return ProviderErrorCode.INSUFFICIENT_FUNDS;
  if (httpStatus === 404) return ProviderErrorCode.DOMAIN_NOT_FOUND;
  if (httpStatus === 409) return ProviderErrorCode.DOMAIN_STATE_CONFLICT;
  if (httpStatus === 429) return ProviderErrorCode.RATE_LIMITED;
  if (httpStatus >= 500) return ProviderErrorCode.PROVIDER_UNAVAILABLE;
  if (httpStatus === 400) return ProviderErrorCode.VALIDATION_ERROR;

  // Dynadot error code mapping (from REST v2 API)
  if (errorCode) {
    switch (errorCode) {
      case 'invalid_api_key':
      case 'authentication_error':
        return ProviderErrorCode.AUTHENTICATION_ERROR;
      case 'insufficient_account_funds':
        return ProviderErrorCode.INSUFFICIENT_FUNDS;
      case 'invalid_domain':
      case 'domain_not_found':
        return ProviderErrorCode.DOMAIN_NOT_FOUND;
      default:
        break;
    }
  }

  return ProviderErrorCode.UNKNOWN;
}
