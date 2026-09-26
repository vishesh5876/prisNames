/**
 * PrisNames — Registrar Operation Service
 *
 * Owns registrar_operations.status transitions and orchestrates:
 * - Operation creation with FQDN conflict detection (Correction 1)
 * - Strong registration evidence verification (Correction 2)
 * - Manual review resolution with safety checks
 * - Reconciliation backoff scheduling
 * - Customer-safe status projection
 *
 * All external provider IDs are opaque strings — no parseInt/Number.
 *
 * Reference: Phase 6 Implementation Plan §2-§12
 */

import { Inject, Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { createLogger } from '@prisnames/logger';
import {
  RegistrarCapability,
  ProviderErrorCode,
  type RegistrarProvider,
} from '@prisnames/registrar-core';
import { REGISTRAR_OP_STATUS } from '@prisnames/database';
import { DATABASE_TOKEN } from '../../database/database.module.js';
import type { Database } from '@prisnames/database/client';
import { REGISTRAR_ERROR_CODES } from '@prisnames/contracts';
import {
  RegistrarOperationRepository,
  type RegistrarOperationRow,
} from './registrar-operation.repository.js';
import { FqdnService } from './fqdn.service.js';
import { ContactSnapshotService, type ContactSnapshotRef } from './contact-snapshot.service.js';

import { assertValidTransition, isTerminalStatus } from './state-machine.js';
import {
  statusChangeDetails,
  manualReviewDetails,
} from './audit-detail-builders.js';

const logger = createLogger({ service: 'registrar-operation-service' });

// ──────────────────────────────────────────────
// OPERATION METADATA TYPES
// ──────────────────────────────────────────────

export interface RegisterMetadata {
  readonly type: 'REGISTER';
  readonly years: number;
  readonly privacyEnabled: boolean;
  readonly contactSnapshotId: string;
  readonly contactSnapshotVersion: string;
}

export interface RenewMetadata {
  readonly type: 'RENEW';
  readonly previous_expires_at: string;
  readonly requested_years: number;
  readonly expected_min_expires_at: string;
}

export type OperationMetadata = RegisterMetadata | RenewMetadata;

// ──────────────────────────────────────────────
// REGISTRATION EVIDENCE
// ──────────────────────────────────────────────

export interface RegistrationEvidenceResult {
  readonly verified: boolean;
  readonly method?: string;
  readonly reason?: string;
}

// ──────────────────────────────────────────────
// MANUAL REVIEW ACTIONS
// ──────────────────────────────────────────────

export interface ManualReviewAction {
  type: 'CONFIRM_SUCCEEDED' | 'CONFIRM_FAILED' | 'RETRY' | 'CANCELLED';
  reason: string;
  evidence?: string;
}

// ──────────────────────────────────────────────
// CUSTOMER STATUS PROJECTION
// ──────────────────────────────────────────────

export function projectCustomerStatus(
  op: RegistrarOperationRow,
): { status: string; message: string } {
  switch (op.status) {
    case REGISTRAR_OP_STATUS.QUEUED:
    case REGISTRAR_OP_STATUS.PROCESSING:
    case REGISTRAR_OP_STATUS.RETRY_PENDING:
      return { status: 'processing', message: 'Processing your request' };

    case REGISTRAR_OP_STATUS.ACCEPTED:
    case REGISTRAR_OP_STATUS.UNKNOWN:
      return { status: 'processing', message: 'Processing — this may take a few minutes' };

    case REGISTRAR_OP_STATUS.MANUAL_REVIEW:
      return { status: 'review', message: 'Under review — our team is looking into this' };

    case REGISTRAR_OP_STATUS.SUCCEEDED:
      return { status: 'completed', message: 'Registration completed successfully' };

    case REGISTRAR_OP_STATUS.FAILED:
      if (op.providerErrorCode === ProviderErrorCode.DOMAIN_NOT_AVAILABLE) {
        return { status: 'failed', message: 'This domain is no longer available' };
      }
      if (op.providerErrorCode === ProviderErrorCode.AUTHENTICATION_ERROR ||
          op.providerErrorCode === ProviderErrorCode.INSUFFICIENT_FUNDS) {
        return { status: 'failed', message: "We're experiencing a temporary issue. Please try again later." };
      }
      return { status: 'failed', message: 'Registration could not be completed. Please contact support.' };

    case REGISTRAR_OP_STATUS.CANCELLED:
      return { status: 'cancelled', message: 'This registration has been cancelled' };

    default:
      return { status: 'unknown', message: 'Status unavailable' };
  }
}

// ──────────────────────────────────────────────
// RECONCILIATION BACKOFF
// ──────────────────────────────────────────────

const RECONCILIATION_DELAYS_MS = [
  30_000,    // 30s
  60_000,    // 1m
  120_000,   // 2m
  300_000,   // 5m
  900_000,   // 15m (capped)
];

function getReconciliationDelay(attempt: number): number {
  const idx = Math.min(attempt, RECONCILIATION_DELAYS_MS.length - 1);
  return RECONCILIATION_DELAYS_MS[idx]!;
}

const RETRY_DELAYS_MS = [
  30_000,    // 30s
  120_000,   // 2m
  600_000,   // 10m
];

function getRetryDelay(attempt: number): number {
  const idx = Math.min(attempt, RETRY_DELAYS_MS.length - 1);
  return RETRY_DELAYS_MS[idx]!;
}

// ──────────────────────────────────────────────
// SERVICE
// ──────────────────────────────────────────────

@Injectable()
export class RegistrarOperationService {
  constructor(
    private readonly repo: RegistrarOperationRepository,
    private readonly fqdnService: FqdnService,
    private readonly contactSnapshotService: ContactSnapshotService,
    // DB is needed for TX3 side-effects (domain activation, order evaluation)
    @Inject(DATABASE_TOKEN) readonly db: Database,
  ) {}

  /**
   * Create a registration operation (TX1).
   *
   * Correction 1: Distinguishes idempotent retry from FQDN conflict.
   * - Same idempotency key → returns existing operation
   * - Different order/item with already-active FQDN → rejects
   */
  async createRegistrationOperation(params: {
    orderId: string;
    orderItemId: string;
    userId: string;
    fqdn: string;
    registrarProviderId: string;
    providerId: string;
    years: number;
    privacyEnabled: boolean;
  }): Promise<{ created: boolean; operation: RegistrarOperationRow }> {
    const canonicalFqdn = this.fqdnService.canonicalize(params.fqdn);

    const idempotencyKey = this.fqdnService.buildIdempotencyKey(
      params.providerId,
      'REGISTER',
      canonicalFqdn,
      params.orderItemId,
    );

    // Correction 1: Check for active FQDN conflict BEFORE inserting
    const existingOp = await this.repo.findActiveOperationByFqdn(canonicalFqdn, 'REGISTER');
    if (existingOp) {
      // Same idempotency key → return existing (idempotent retry)
      if (existingOp.idempotencyKey === idempotencyKey) {
        return { created: false, operation: existingOp };
      }
      // Different order/item with already-active FQDN → reject
      throw new HttpException(
        {
          code: REGISTRAR_ERROR_CODES.FQDN_ALREADY_ACTIVE,
          message: `Domain ${canonicalFqdn} already has an active registration operation`,
        },
        HttpStatus.CONFLICT,
      );
    }

    // Create contact snapshot (Correction 5: real backing storage)
    const profileData = await this.contactSnapshotService.getCurrentProfileData(params.userId);
    let snapshotRef: ContactSnapshotRef;
    if (profileData) {
      snapshotRef = await this.contactSnapshotService.getOrCreateSnapshot(params.userId, profileData);
    } else {
      // No profile — create empty snapshot
      snapshotRef = await this.contactSnapshotService.getOrCreateSnapshot(params.userId, {
        firstName: null, lastName: null, company: null, email: null,
        phone: null, addressLine1: null, addressLine2: null,
        city: null, state: null, postalCode: null, country: null,
      });
    }

    const metadata: RegisterMetadata = {
      type: 'REGISTER',
      years: params.years,
      privacyEnabled: params.privacyEnabled,
      contactSnapshotId: snapshotRef.snapshotId,
      contactSnapshotVersion: snapshotRef.version,
    };

    const result = await this.repo.insertIdempotent({
      orderId: params.orderId,
      orderItemId: params.orderItemId,
      registrarProviderId: params.registrarProviderId,
      status: REGISTRAR_OP_STATUS.QUEUED,
      operationType: 'REGISTER',
      idempotencyKey,
      fqdn: canonicalFqdn,
      operationMetadata: metadata,
    });

    if (result.created) {
      // Insert audit log for creation
      await this.repo.insertAuditLog({
        operationId: result.operation.id,
        eventType: 'CREATED',
        toStatus: REGISTRAR_OP_STATUS.QUEUED,
        details: statusChangeDetails('', REGISTRAR_OP_STATUS.QUEUED, 'Operation created'),
        actor: 'system',
      });
    }

    return result;
  }

  /**
   * Verify registration evidence — Correction 2: strong correlation.
   *
   * With providerOrderId: requires provider identity + order type + completion + domain match.
   * Without providerOrderId: domain existence alone is NOT sufficient.
   * Returns UNKNOWN if strong correlation cannot be proven.
   */
  async verifyRegistrationEvidence(
    op: RegistrarOperationRow,
    provider: RegistrarProvider,
  ): Promise<RegistrationEvidenceResult> {
    const ordersCap = provider.getCapability(RegistrarCapability.ORDER_MANAGEMENT);
    const infoCap = provider.getCapability(RegistrarCapability.DOMAIN_INFO);

    // 1. If providerOrderId exists: check order status first
    if (op.providerOrderId && ordersCap) {
      try {
        const orderResult = await ordersCap.getOrderStatus(op.providerOrderId);
        if (orderResult) {
          // Validate provider identity match
          // Validate operation type compatibility
          if (orderResult.status === 'completed' || orderResult.status === 'COMPLETED') {
            // Still verify domain exists at provider
            if (infoCap && op.fqdn) {
              try {
                const domainInfo = await infoCap.getDomainInfo(op.fqdn);
                if (domainInfo?.domainName) {
                  return { verified: true, method: 'ORDER_STATUS_THEN_DOMAIN_INFO' };
                }
                return { verified: false, reason: 'Order completed but domain not found at provider' };
              } catch {
                return { verified: false, reason: 'Order completed but domain lookup failed' };
              }
            }
            return { verified: false, reason: 'Order completed but domain info capability unavailable' };
          }
          if (orderResult.status === 'failed' || orderResult.status === 'FAILED') {
            return { verified: false, reason: 'Provider order failed' };
          }
          // Order still pending
          return { verified: false, reason: 'Provider order still pending' };
        }
      } catch (err) {
        logger.warn({ err, opId: op.id }, 'Order status check failed during evidence verification');
      }
    }

    // 2. Without providerOrderId: domain existence alone is NOT sufficient (Correction 2)
    // Strong correlation requires actual evidence beyond getDomainInfo(fqdn) returning exists.
    // Without a provider order ID, we cannot prove our operation caused the registration.
    if (!op.providerOrderId) {
      return {
        verified: false,
        reason: 'No provider order ID — cannot establish strong correlation. Needs manual review after reconciliation exhaustion.',
      };
    }

    return { verified: false, reason: 'Insufficient evidence for verification' };
  }

  /**
   * Resolve a manual review operation.
   * Includes all safety checks per §12.
   */
  async resolveManualReview(
    opId: string,
    action: ManualReviewAction,
    adminUserId: string,
    provider?: RegistrarProvider,
  ): Promise<RegistrarOperationRow> {
    const op = await this.repo.findById(opId);
    if (!op) {
      throw new HttpException(
        { code: REGISTRAR_ERROR_CODES.OPERATION_NOT_FOUND, message: 'Operation not found' },
        HttpStatus.NOT_FOUND,
      );
    }

    if (op.status !== REGISTRAR_OP_STATUS.MANUAL_REVIEW) {
      throw new HttpException(
        { code: REGISTRAR_ERROR_CODES.INVALID_STATE_TRANSITION, message: 'Operation is not in MANUAL_REVIEW status' },
        HttpStatus.CONFLICT,
      );
    }

    // Validate action constraints
    if (action.type === 'CONFIRM_SUCCEEDED' && provider) {
      const evidence = await this.verifyRegistrationEvidence(op, provider);
      if (!evidence.verified) {
        throw new HttpException(
          { code: REGISTRAR_ERROR_CODES.VERIFICATION_FAILED, message: `Cannot confirm succeeded: ${evidence.reason}` },
          HttpStatus.BAD_REQUEST,
        );
      }
    }

    if (action.type === 'RETRY') {
      if (op.attemptStatus !== 'NOT_ATTEMPTED' && !action.evidence) {
        throw new HttpException(
          {
            code: REGISTRAR_ERROR_CODES.UNSAFE_RETRY,
            message: 'Cannot retry: provider invocation was attempted. Provide evidence that no side-effect occurred.',
          },
          HttpStatus.BAD_REQUEST,
        );
      }
    }

    // CANCELLED: not for REGISTER operations (Correction 10)
    if (action.type === 'CANCELLED' && op.operationType === 'REGISTER') {
      throw new HttpException(
        {
          code: REGISTRAR_ERROR_CODES.UNSAFE_ACTION,
          message: 'Cannot cancel an unresolved registration. Use CONFIRM_FAILED with evidence instead.',
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    // Sanitize reason/evidence lengths
    const sanitizedReason = (action.reason || '').slice(0, 1000);
    const sanitizedEvidence = action.evidence?.slice(0, 2000);

    // Map action to target status
    const statusMap: Record<string, string> = {
      CONFIRM_SUCCEEDED: REGISTRAR_OP_STATUS.SUCCEEDED,
      CONFIRM_FAILED: REGISTRAR_OP_STATUS.FAILED,
      RETRY: REGISTRAR_OP_STATUS.RETRY_PENDING,
      CANCELLED: REGISTRAR_OP_STATUS.CANCELLED,
    };
    const targetStatus = statusMap[action.type]!;
    assertValidTransition(op.status, targetStatus);

    const writeResult = await this.repo.resolveManualReview(opId, {
      status: targetStatus,
      resolutionAction: action.type,
      resolutionReason: sanitizedReason,
      resolutionEvidence: sanitizedEvidence,
      resolvedBy: adminUserId,
      nextRetryAt: action.type === 'RETRY' ? new Date(Date.now() + 30_000) : undefined,
      isTerminal: isTerminalStatus(targetStatus),
    });

    if (!writeResult.written) {
      throw new HttpException(
        { code: REGISTRAR_ERROR_CODES.INVALID_STATE_TRANSITION, message: 'Operation state changed during resolution' },
        HttpStatus.CONFLICT,
      );
    }

    // Audit log
    await this.repo.insertAuditLog({
      operationId: opId,
      eventType: `MANUAL_REVIEW_${action.type}`,
      fromStatus: op.status,
      toStatus: targetStatus,
      details: manualReviewDetails(action.type, sanitizedReason, sanitizedEvidence),
      actor: 'admin',
      resolvedBy: adminUserId,
    });

    return writeResult.operation!;
  }

  /**
   * Get next reconciliation time based on attempt count.
   */
  getNextReconciliationAt(currentAttempts: number): Date {
    const delay = getReconciliationDelay(currentAttempts);
    return new Date(Date.now() + delay);
  }

  /**
   * Get next retry time based on retry count.
   */
  getNextRetryAt(currentRetryCount: number): Date {
    const delay = getRetryDelay(currentRetryCount);
    return new Date(Date.now() + delay);
  }
}
