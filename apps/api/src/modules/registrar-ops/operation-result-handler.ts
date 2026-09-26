/**
 * PrisNames — Operation Result Handler
 *
 * Classifies provider operation results into registrar operation status transitions.
 * Determines attempt_status and whether retry/reconciliation/manual review is needed.
 *
 * Key rules:
 * - RATE_LIMITED/CIRCUIT_OPEN: ProviderErrorCode is authoritative (no transmission) → RETRY_PENDING
 * - AUTHENTICATION_ERROR/INSUFFICIENT_FUNDS → MANUAL_REVIEW (credential/funds issue)
 * - PROVIDER_TIMEOUT/PROVIDER_UNAVAILABLE after ATTEMPT_STARTED → UNKNOWN
 * - VALIDATION_ERROR/DOMAIN_NOT_AVAILABLE → FAILED (terminal)
 *
 * Reference: Phase 6 Implementation Plan §3, §7.4
 */

import { Injectable } from '@nestjs/common';
import {
  ProviderOperationStatus,
  ProviderErrorCode,
  type ProviderOperationResult,
} from '@prisnames/registrar-core';
import { REGISTRAR_OP_STATUS } from '@prisnames/database';

// ──────────────────────────────────────────────
// RESULT CLASSIFICATION
// ──────────────────────────────────────────────

export interface ClassifiedResult {
  /** Target registrar operation status */
  status: string;
  /** Attempt status to record */
  attemptStatus: 'NOT_ATTEMPTED' | 'ATTEMPT_STARTED' | 'OUTCOME_RECEIVED' | 'OUTCOME_UNKNOWN';
  /** Whether this triggers reconciliation scheduling */
  needsReconciliation: boolean;
  /** Whether this schedules a retry */
  needsRetry: boolean;
  /** Whether this is a terminal outcome */
  isTerminal: boolean;
  /** Human-readable classification reason */
  reason: string;
}

/**
 * Error codes that authoritatively prove no HTTP request reached the provider.
 * Safe to retry even after ATTEMPT_STARTED because the provider-internal gate
 * fired before fetch().
 */
const NO_TRANSMISSION_ERROR_CODES: readonly ProviderErrorCode[] = [
  ProviderErrorCode.RATE_LIMITED,
  ProviderErrorCode.CIRCUIT_OPEN,
];

/**
 * Error codes that mean the provider explicitly rejected with no side-effect.
 * Not auto-retryable (operational issue), but safe — no duplicate risk.
 */
const CREDENTIAL_ERROR_CODES: readonly ProviderErrorCode[] = [
  ProviderErrorCode.AUTHENTICATION_ERROR,
  ProviderErrorCode.INSUFFICIENT_FUNDS,
];

/**
 * Error codes that are terminal — the operation itself is fundamentally invalid.
 */
const TERMINAL_ERROR_CODES: readonly ProviderErrorCode[] = [
  ProviderErrorCode.VALIDATION_ERROR,
  ProviderErrorCode.DOMAIN_NOT_AVAILABLE,
  ProviderErrorCode.DOMAIN_STATE_CONFLICT,
];

@Injectable()
export class OperationResultHandler {
  /**
   * Classify a successful provider result.
   */
  classifySuccess(result: ProviderOperationResult): ClassifiedResult {
    switch (result.status) {
      case ProviderOperationStatus.SUCCEEDED:
        return {
          status: REGISTRAR_OP_STATUS.SUCCEEDED,
          attemptStatus: 'OUTCOME_RECEIVED',
          needsReconciliation: false,
          needsRetry: false,
          isTerminal: true,
          reason: 'Provider confirmed success',
        };
      case ProviderOperationStatus.ACCEPTED:
        return {
          status: REGISTRAR_OP_STATUS.ACCEPTED,
          attemptStatus: 'OUTCOME_RECEIVED',
          needsReconciliation: true,
          needsRetry: false,
          isTerminal: false,
          reason: 'Provider acknowledged, pending async completion',
        };
      case ProviderOperationStatus.UNKNOWN:
        return {
          status: REGISTRAR_OP_STATUS.UNKNOWN,
          attemptStatus: 'OUTCOME_UNKNOWN',
          needsReconciliation: true,
          needsRetry: false,
          isTerminal: false,
          reason: 'Provider response lost or ambiguous',
        };
      case ProviderOperationStatus.FAILED:
        return this.classifyFailure(result);
    }
  }

  /**
   * Classify a failed provider result based on error code.
   */
  classifyFailure(result: ProviderOperationResult): ClassifiedResult {
    const errorCode = result.failureCode;

    // No error code — conservative UNKNOWN if it reached attempt
    if (!errorCode) {
      return {
        status: REGISTRAR_OP_STATUS.UNKNOWN,
        attemptStatus: 'OUTCOME_UNKNOWN',
        needsReconciliation: true,
        needsRetry: false,
        isTerminal: false,
        reason: 'No failure code available, conservative UNKNOWN',
      };
    }

    // No-transmission errors (rate limit, circuit open) — safe to retry
    if (NO_TRANSMISSION_ERROR_CODES.includes(errorCode)) {
      return {
        status: REGISTRAR_OP_STATUS.RETRY_PENDING,
        attemptStatus: 'OUTCOME_RECEIVED',  // provider-internal gate fired, no HTTP
        needsReconciliation: false,
        needsRetry: true,
        isTerminal: false,
        reason: `No transmission: ${errorCode}`,
      };
    }

    // Credential/funds errors — manual review needed (provider rejected, no side-effect)
    if (CREDENTIAL_ERROR_CODES.includes(errorCode)) {
      return {
        status: REGISTRAR_OP_STATUS.MANUAL_REVIEW,
        attemptStatus: 'OUTCOME_RECEIVED',
        needsReconciliation: false,
        needsRetry: false,
        isTerminal: false,
        reason: `Credential/funds issue: ${errorCode}`,
      };
    }

    // Terminal errors — operation is fundamentally invalid
    if (TERMINAL_ERROR_CODES.includes(errorCode)) {
      return {
        status: REGISTRAR_OP_STATUS.FAILED,
        attemptStatus: 'OUTCOME_RECEIVED',
        needsReconciliation: false,
        needsRetry: false,
        isTerminal: true,
        reason: `Terminal failure: ${errorCode}`,
      };
    }

    // Timeout/unavailable — UNKNOWN, reconciliation needed
    if (errorCode === ProviderErrorCode.PROVIDER_TIMEOUT ||
        errorCode === ProviderErrorCode.PROVIDER_UNAVAILABLE) {
      return {
        status: REGISTRAR_OP_STATUS.UNKNOWN,
        attemptStatus: 'OUTCOME_UNKNOWN',
        needsReconciliation: true,
        needsRetry: false,
        isTerminal: false,
        reason: `Provider unreachable: ${errorCode}`,
      };
    }

    // Any other error — conservative UNKNOWN
    return {
      status: REGISTRAR_OP_STATUS.UNKNOWN,
      attemptStatus: 'OUTCOME_UNKNOWN',
      needsReconciliation: true,
      needsRetry: false,
      isTerminal: false,
      reason: `Unclassified error: ${errorCode}`,
    };
  }

  /**
   * Classify a ProviderError exception that was thrown during execution.
   */
  classifyError(
    errorCode: ProviderErrorCode | undefined,
    attemptStarted: boolean,
  ): ClassifiedResult {
    if (!errorCode) {
      // No error code and attempt was started — conservative UNKNOWN
      if (attemptStarted) {
        return {
          status: REGISTRAR_OP_STATUS.UNKNOWN,
          attemptStatus: 'OUTCOME_UNKNOWN',
          needsReconciliation: true,
          needsRetry: false,
          isTerminal: false,
          reason: 'Exception with no error code after attempt started',
        };
      }
      // Not started — safe to retry
      return {
        status: REGISTRAR_OP_STATUS.RETRY_PENDING,
        attemptStatus: 'NOT_ATTEMPTED',
        needsReconciliation: false,
        needsRetry: true,
        isTerminal: false,
        reason: 'Exception before attempt started',
      };
    }

    // Use the same error code classification
    const mockResult: ProviderOperationResult = {
      status: ProviderOperationStatus.FAILED,
      failureCode: errorCode,
      providerRequestId: '',
    };
    return this.classifyFailure(mockResult);
  }
}
