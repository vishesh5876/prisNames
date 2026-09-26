/**
 * PrisNames — Provider Operation Result
 *
 * Normalized outcome of a transactional provider operation.
 * ProviderOperationStatus is a provider-outcome subset that MUST be exhaustively
 * mapped to RegistrarOperationStatus (from packages/database enums).
 *
 * Critical rules:
 * - UNKNOWN must NEVER be automatically retried for transactional writes
 * - ACCEPTED must NEVER be treated as SUCCEEDED
 * - Pre-transmission failures (validation, credentials, rate-limit) → FAILED
 * - Post-transmission ambiguity (timeout, socket close) → UNKNOWN
 *
 * Reference: ORDER_STATE_MACHINE.md §1.4
 */

import type { ProviderErrorCode } from '../errors/provider-error.js';

// ──────────────────────────────────────────────
// PROVIDER OPERATION STATUS
// ──────────────────────────────────────────────

/**
 * Provider-side outcome subset. Each value maps exhaustively to one
 * RegistrarOperationStatus value from the database schema.
 *
 * Mapping (compile/test-time verified):
 *   SUCCEEDED → SUCCEEDED
 *   ACCEPTED  → ACCEPTED
 *   UNKNOWN   → UNKNOWN
 *   FAILED    → FAILED
 */
export enum ProviderOperationStatus {
  /** Provider confirmed success (HTTP 200/201) */
  SUCCEEDED = 'SUCCEEDED',
  /** Provider acknowledged, pending async completion (HTTP 202) */
  ACCEPTED = 'ACCEPTED',
  /** Request may have reached provider but response was lost (timeout/disconnect) */
  UNKNOWN = 'UNKNOWN',
  /** Provider explicitly rejected the operation */
  FAILED = 'FAILED',
}

/**
 * Canonical mapping from ProviderOperationStatus → RegistrarOperationStatus string.
 * Used for exhaustiveness verification in tests.
 */
export const PROVIDER_TO_REGISTRAR_STATUS_MAP: Record<ProviderOperationStatus, string> = {
  [ProviderOperationStatus.SUCCEEDED]: 'SUCCEEDED',
  [ProviderOperationStatus.ACCEPTED]: 'ACCEPTED',
  [ProviderOperationStatus.UNKNOWN]: 'UNKNOWN',
  [ProviderOperationStatus.FAILED]: 'FAILED',
} as const;

// ──────────────────────────────────────────────
// PROVIDER OPERATION RESULT
// ──────────────────────────────────────────────

export interface ProviderOperationResult {
  /** Normalized outcome status */
  readonly status: ProviderOperationStatus;

  /** Provider's order/transaction ID for reconciliation (opaque string) */
  readonly providerOrderId?: string;

  /** Provider's domain identifier if applicable */
  readonly providerDomainId?: string;

  /** The X-Request-ID we sent (for log/webhook correlation) */
  readonly providerRequestId: string;

  /** Domain expiration date if returned by the provider */
  readonly expiresAt?: Date;

  /** Raw HTTP status code for diagnostics (not for business logic) */
  readonly rawHttpStatus?: number;

  /** Specific failure code if status is FAILED */
  readonly failureCode?: ProviderErrorCode;

  /** Human-readable failure message (sanitized — no PII/secrets) */
  readonly failureMessage?: string;
}

// ──────────────────────────────────────────────
// OPERATION CONTEXT
// ──────────────────────────────────────────────

/**
 * Context supplied by callers for request correlation.
 * Allows registrar operation → provider request → logs → webhook reconciliation.
 */
export interface OperationContext {
  /** Internal registrar operation ID from our database */
  readonly registrarOperationId?: string;

  /** Application-level correlation ID */
  readonly correlationId?: string;

  /** Pre-assigned X-Request-ID (used if provided, else generated) */
  readonly requestId?: string;

  /** Operation type for logging context */
  readonly operationType?: string;
}
