/**
 * PrisNames — Registrar Operation State Machine
 *
 * Canonical transition model for RegistrarOperationStatus.
 * Invalid transitions are forbidden and throw InvalidStateTransitionError.
 *
 * Key invariants:
 * - FAILED, SUCCEEDED, CANCELLED are terminal (no outgoing transitions)
 * - UNKNOWN → RETRY_PENDING is NOT valid (reconciliation only)
 * - RETRY_PENDING → MANUAL_REVIEW when retries exhausted
 * - All transitions are whitelist-based
 *
 * Reference: Phase 6 Implementation Plan §2
 */

import { HttpException, HttpStatus } from '@nestjs/common';
import { REGISTRAR_ERROR_CODES } from '@prisnames/contracts';
import { REGISTRAR_OP_STATUS } from '@prisnames/database';

// ──────────────────────────────────────────────
// VALID TRANSITIONS
// ──────────────────────────────────────────────

export const VALID_OP_TRANSITIONS: Record<string, readonly string[]> = {
  [REGISTRAR_OP_STATUS.QUEUED]: [
    REGISTRAR_OP_STATUS.PROCESSING,
    REGISTRAR_OP_STATUS.CANCELLED,
  ],
  [REGISTRAR_OP_STATUS.PROCESSING]: [
    REGISTRAR_OP_STATUS.SUCCEEDED,
    REGISTRAR_OP_STATUS.ACCEPTED,
    REGISTRAR_OP_STATUS.UNKNOWN,
    REGISTRAR_OP_STATUS.FAILED,
    REGISTRAR_OP_STATUS.RETRY_PENDING,
    REGISTRAR_OP_STATUS.MANUAL_REVIEW,
  ],
  [REGISTRAR_OP_STATUS.ACCEPTED]: [
    REGISTRAR_OP_STATUS.SUCCEEDED,
    REGISTRAR_OP_STATUS.FAILED,
    REGISTRAR_OP_STATUS.UNKNOWN,
    REGISTRAR_OP_STATUS.MANUAL_REVIEW,
  ],
  [REGISTRAR_OP_STATUS.UNKNOWN]: [
    REGISTRAR_OP_STATUS.SUCCEEDED,
    REGISTRAR_OP_STATUS.FAILED,
    REGISTRAR_OP_STATUS.MANUAL_REVIEW,
  ],
  [REGISTRAR_OP_STATUS.RETRY_PENDING]: [
    REGISTRAR_OP_STATUS.PROCESSING,
    REGISTRAR_OP_STATUS.CANCELLED,
    REGISTRAR_OP_STATUS.MANUAL_REVIEW,
  ],
  [REGISTRAR_OP_STATUS.MANUAL_REVIEW]: [
    REGISTRAR_OP_STATUS.SUCCEEDED,
    REGISTRAR_OP_STATUS.FAILED,
    REGISTRAR_OP_STATUS.CANCELLED,
    REGISTRAR_OP_STATUS.RETRY_PENDING,
  ],
  [REGISTRAR_OP_STATUS.SUCCEEDED]: [],  // terminal
  [REGISTRAR_OP_STATUS.FAILED]: [],     // terminal
  [REGISTRAR_OP_STATUS.CANCELLED]: [],  // terminal
} as const;

/** Terminal statuses — no outgoing transitions */
export const TERMINAL_STATUSES: readonly string[] = [
  REGISTRAR_OP_STATUS.SUCCEEDED,
  REGISTRAR_OP_STATUS.FAILED,
  REGISTRAR_OP_STATUS.CANCELLED,
];

export function isTerminalStatus(status: string): boolean {
  return TERMINAL_STATUSES.includes(status);
}

// ──────────────────────────────────────────────
// TRANSITION VALIDATION
// ──────────────────────────────────────────────

export class InvalidStateTransitionError extends HttpException {
  constructor(from: string, to: string) {
    super(
      {
        code: REGISTRAR_ERROR_CODES.INVALID_STATE_TRANSITION,
        message: `Invalid state transition: ${from} → ${to}`,
      },
      HttpStatus.CONFLICT,
    );
  }
}

/**
 * Assert a state transition is valid. Throws on invalid.
 */
export function assertValidTransition(from: string, to: string): void {
  const allowedTargets = VALID_OP_TRANSITIONS[from];
  if (!allowedTargets || !allowedTargets.includes(to)) {
    throw new InvalidStateTransitionError(from, to);
  }
}
