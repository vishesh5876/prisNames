/**
 * PrisNames — Operation Result Handler (Standalone)
 *
 * Pure logic — no NestJS dependencies.
 * Classifies provider results into registrar operation status transitions.
 */

import {
  ProviderOperationStatus,
  ProviderErrorCode,
  type ProviderOperationResult,
} from '@prisnames/registrar-core';

const REGISTRAR_OP_STATUS = {
  QUEUED: 'QUEUED',
  PROCESSING: 'PROCESSING',
  ACCEPTED: 'ACCEPTED',
  SUCCEEDED: 'SUCCEEDED',
  UNKNOWN: 'UNKNOWN',
  RETRY_PENDING: 'RETRY_PENDING',
  FAILED: 'FAILED',
  MANUAL_REVIEW: 'MANUAL_REVIEW',
  CANCELLED: 'CANCELLED',
} as const;

export interface ClassifiedResult {
  status: string;
  attemptStatus: 'NOT_ATTEMPTED' | 'ATTEMPT_STARTED' | 'OUTCOME_RECEIVED' | 'OUTCOME_UNKNOWN';
  needsReconciliation: boolean;
  needsRetry: boolean;
  isTerminal: boolean;
  reason: string;
}

const NO_TRANSMISSION: readonly ProviderErrorCode[] = [
  ProviderErrorCode.RATE_LIMITED,
  ProviderErrorCode.CIRCUIT_OPEN,
];

const CREDENTIAL_ERRORS: readonly ProviderErrorCode[] = [
  ProviderErrorCode.AUTHENTICATION_ERROR,
  ProviderErrorCode.INSUFFICIENT_FUNDS,
];

const TERMINAL_ERRORS: readonly ProviderErrorCode[] = [
  ProviderErrorCode.VALIDATION_ERROR,
  ProviderErrorCode.DOMAIN_NOT_AVAILABLE,
  ProviderErrorCode.DOMAIN_STATE_CONFLICT,
];

export class OperationResultHandler {
  classifySuccess(result: ProviderOperationResult): ClassifiedResult {
    switch (result.status) {
      case ProviderOperationStatus.SUCCEEDED:
        return { status: REGISTRAR_OP_STATUS.SUCCEEDED, attemptStatus: 'OUTCOME_RECEIVED', needsReconciliation: false, needsRetry: false, isTerminal: true, reason: 'Provider confirmed success' };
      case ProviderOperationStatus.ACCEPTED:
        return { status: REGISTRAR_OP_STATUS.ACCEPTED, attemptStatus: 'OUTCOME_RECEIVED', needsReconciliation: true, needsRetry: false, isTerminal: false, reason: 'Provider acknowledged, pending async completion' };
      case ProviderOperationStatus.UNKNOWN:
        return { status: REGISTRAR_OP_STATUS.UNKNOWN, attemptStatus: 'OUTCOME_UNKNOWN', needsReconciliation: true, needsRetry: false, isTerminal: false, reason: 'Provider response ambiguous' };
      case ProviderOperationStatus.FAILED:
        return this.classifyFailure(result);
      default: {
        const _exhaustive: never = result.status;
        throw new Error(`Unhandled provider status: ${_exhaustive}`);
      }
    }
  }

  classifyFailure(result: ProviderOperationResult): ClassifiedResult {
    const errorCode = result.failureCode;
    if (!errorCode) return { status: REGISTRAR_OP_STATUS.UNKNOWN, attemptStatus: 'OUTCOME_UNKNOWN', needsReconciliation: true, needsRetry: false, isTerminal: false, reason: 'No failure code' };

    if (NO_TRANSMISSION.includes(errorCode)) return { status: REGISTRAR_OP_STATUS.RETRY_PENDING, attemptStatus: 'OUTCOME_RECEIVED', needsReconciliation: false, needsRetry: true, isTerminal: false, reason: `No transmission: ${errorCode}` };
    if (CREDENTIAL_ERRORS.includes(errorCode)) return { status: REGISTRAR_OP_STATUS.MANUAL_REVIEW, attemptStatus: 'OUTCOME_RECEIVED', needsReconciliation: false, needsRetry: false, isTerminal: false, reason: `Credential issue: ${errorCode}` };
    if (TERMINAL_ERRORS.includes(errorCode)) return { status: REGISTRAR_OP_STATUS.FAILED, attemptStatus: 'OUTCOME_RECEIVED', needsReconciliation: false, needsRetry: false, isTerminal: true, reason: `Terminal: ${errorCode}` };

    if (errorCode === ProviderErrorCode.PROVIDER_TIMEOUT || errorCode === ProviderErrorCode.PROVIDER_UNAVAILABLE)
      return { status: REGISTRAR_OP_STATUS.UNKNOWN, attemptStatus: 'OUTCOME_UNKNOWN', needsReconciliation: true, needsRetry: false, isTerminal: false, reason: `Unreachable: ${errorCode}` };

    return { status: REGISTRAR_OP_STATUS.UNKNOWN, attemptStatus: 'OUTCOME_UNKNOWN', needsReconciliation: true, needsRetry: false, isTerminal: false, reason: `Unclassified: ${errorCode}` };
  }

  classifyError(errorCode: ProviderErrorCode | undefined, attemptStarted: boolean): ClassifiedResult {
    if (!errorCode) {
      return attemptStarted
        ? { status: REGISTRAR_OP_STATUS.UNKNOWN, attemptStatus: 'OUTCOME_UNKNOWN', needsReconciliation: true, needsRetry: false, isTerminal: false, reason: 'Exception after attempt' }
        : { status: REGISTRAR_OP_STATUS.RETRY_PENDING, attemptStatus: 'NOT_ATTEMPTED', needsReconciliation: false, needsRetry: true, isTerminal: false, reason: 'Exception before attempt' };
    }
    const mock: ProviderOperationResult = { status: ProviderOperationStatus.FAILED, failureCode: errorCode, providerRequestId: '' };
    return this.classifyFailure(mock);
  }
}
