/**
 * PrisNames — Provider Errors
 *
 * Normalized error codes and error class for registrar provider operations.
 */

// ──────────────────────────────────────────────
// PROVIDER ERROR CODES
// ──────────────────────────────────────────────

export enum ProviderErrorCode {
  /** Provider authentication failed (invalid/expired API key) */
  AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR',
  /** Insufficient permissions/authorization */
  AUTHORIZATION_ERROR = 'AUTHORIZATION_ERROR',
  /** Domain is not available for the requested operation */
  DOMAIN_NOT_AVAILABLE = 'DOMAIN_NOT_AVAILABLE',
  /** Domain not found at the provider */
  DOMAIN_NOT_FOUND = 'DOMAIN_NOT_FOUND',
  /** Operation conflicts with current domain state */
  DOMAIN_STATE_CONFLICT = 'DOMAIN_STATE_CONFLICT',
  /** Provider-side validation error (bad request) */
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  /** Insufficient provider account balance */
  INSUFFICIENT_FUNDS = 'INSUFFICIENT_FUNDS',
  /** Rate limited by the provider */
  RATE_LIMITED = 'RATE_LIMITED',
  /** Request timed out waiting for provider response */
  PROVIDER_TIMEOUT = 'PROVIDER_TIMEOUT',
  /** Provider is unavailable (5xx, network error) */
  PROVIDER_UNAVAILABLE = 'PROVIDER_UNAVAILABLE',
  /** Circuit breaker is open, request not sent */
  CIRCUIT_OPEN = 'CIRCUIT_OPEN',
  /** Capability not supported by this provider */
  CAPABILITY_UNSUPPORTED = 'CAPABILITY_UNSUPPORTED',
  /** Unknown/unclassified error */
  UNKNOWN = 'UNKNOWN',
}

// ──────────────────────────────────────────────
// PROVIDER ERROR
// ──────────────────────────────────────────────

export class ProviderError extends Error {
  readonly code: ProviderErrorCode;
  readonly providerId: string;
  readonly httpStatus?: number;
  readonly providerRequestId?: string;
  readonly retryable: boolean;

  constructor(
    code: ProviderErrorCode,
    message: string,
    providerId: string,
    options?: {
      httpStatus?: number;
      providerRequestId?: string;
      retryable?: boolean;
      cause?: Error;
    },
  ) {
    super(message, { cause: options?.cause });
    this.name = 'ProviderError';
    this.code = code;
    this.providerId = providerId;
    this.httpStatus = options?.httpStatus;
    this.providerRequestId = options?.providerRequestId;
    this.retryable = options?.retryable ?? false;
  }
}

// ──────────────────────────────────────────────
// SPECIALIZED ERRORS
// ──────────────────────────────────────────────

export class CapabilityUnsupportedError extends ProviderError {
  readonly capability: string;

  constructor(capability: string, providerId: string) {
    super(
      ProviderErrorCode.CAPABILITY_UNSUPPORTED,
      `Capability '${capability}' is not supported by provider '${providerId}'`,
      providerId,
      { retryable: false },
    );
    this.name = 'CapabilityUnsupportedError';
    this.capability = capability;
  }
}
