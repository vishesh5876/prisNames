/**
 * PrisNames — Audit Service
 *
 * Records security-relevant events to audit_logs table.
 * Append-only — never update or delete audit records.
 */

import { Injectable, Inject, Logger } from '@nestjs/common';
import { type Database } from '@prisnames/database/client';
import { auditLogs } from '@prisnames/database/schema';
import { DATABASE_TOKEN } from '../../database/database.module.js';

export const AUDIT_EVENTS = {
  USER_REGISTERED: 'user.registered',
  EMAIL_VERIFICATION_QUEUED: 'user.email_verification_queued',
  EMAIL_VERIFIED: 'user.email_verified',
  LOGIN_SUCCEEDED: 'user.login_succeeded',
  LOGIN_FAILED: 'user.login_failed',
  LOGOUT: 'user.logout',
  SESSION_REVOKED: 'user.session_revoked',
  ALL_SESSIONS_REVOKED: 'user.all_sessions_revoked',
  PASSWORD_RESET_REQUESTED: 'user.password_reset_requested',
  PASSWORD_RESET_COMPLETED: 'user.password_reset_completed',
  PASSWORD_CHANGED: 'user.password_changed',
  VERIFICATION_RESENT: 'user.verification_resent',
  SESSION_ROTATED: 'user.session_rotated',
} as const;

export interface AuditEvent {
  actorId?: string;
  actorType: 'USER' | 'SYSTEM' | 'ADMIN';
  action: string;
  resourceType: string;
  resourceId?: string;
  requestId?: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @Inject(DATABASE_TOKEN) private readonly db: Database,
  ) {}

  async log(event: AuditEvent): Promise<void> {
    try {
      await this.db.insert(auditLogs).values({
        actorId: event.actorId,
        actorType: event.actorType,
        action: event.action,
        resourceType: event.resourceType,
        resourceId: event.resourceId,
        requestId: event.requestId,
        ipAddress: event.ipAddress,
        userAgent: event.userAgent,
        metadata: event.metadata,
      });
    } catch (error) {
      // Audit logging must never break the main flow
      this.logger.error({ err: error, event: event.action }, 'Failed to write audit log');
    }
  }
}
