/**
 * PrisNames — Session Service
 *
 * Server-side session lifecycle:
 * - Create: generate opaque token → SHA-256 hash → store hash in DB
 * - Validate: hash incoming cookie token → find matching row → check expiry/revocation/account status
 * - Revoke: mark session as revoked
 * - Rotate: create new token/hash for existing session (after password change)
 *
 * last_active_at throttling uses distributed-safe conditional DB update (correction 19).
 * Roles/status are ALWAYS checked from DB, not from cached session (correction 7).
 */

import { Injectable, Inject, Logger } from '@nestjs/common';
import { eq, and, isNull, sql } from 'drizzle-orm';
import { type Database } from '@prisnames/database/client';
import { sessions, users, userRoles, roles } from '@prisnames/database/schema';
import { generateSessionToken, hashSessionToken } from '@prisnames/security';
import { DATABASE_TOKEN } from '../../database/database.module.js';
import { getEnv } from '@prisnames/config';

/** Minimum interval between last_active_at updates (5 minutes in ms). */
const LAST_ACTIVE_THROTTLE_MS = 5 * 60 * 1000;

export interface SessionMeta {
  ipAddress?: string;
  userAgent?: string;
}

export interface ValidatedSession {
  sessionId: string;
  userId: string;
  email: string;
  emailVerified: boolean;
  accountStatus: string;
  roles: string[];
}

export interface SessionListItem {
  id: string;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
  lastActiveAt: Date;
}

@Injectable()
export class SessionService {
  private readonly logger = new Logger(SessionService.name);
  private readonly maxAgeSeconds: number;

  constructor(
    @Inject(DATABASE_TOKEN) private readonly db: Database,
  ) {
    this.maxAgeSeconds = getEnv().SESSION_MAX_AGE_SECONDS;
  }

  /**
   * Create a new session for a user.
   * Returns the raw opaque token to be placed in the HttpOnly cookie.
   */
  async createSession(userId: string, meta: SessionMeta): Promise<{ rawToken: string; sessionId: string }> {
    const rawToken = generateSessionToken();
    const tokenHash = hashSessionToken(rawToken);
    const expiresAt = new Date(Date.now() + this.maxAgeSeconds * 1000);

    const [session] = await this.db.insert(sessions).values({
      userId,
      tokenHash,
      ipAddress: meta.ipAddress || null,
      userAgent: meta.userAgent ? meta.userAgent.substring(0, 512) : null,
      expiresAt,
    }).returning({ id: sessions.id });

    return { rawToken, sessionId: session!.id };
  }

  /**
   * Validate a session from a raw cookie token.
   * Checks: token exists, not expired, not revoked, account active.
   * Returns CURRENT roles from DB (never cached/snapshotted).
   */
  async validateSession(rawToken: string): Promise<ValidatedSession | null> {
    const tokenHash = hashSessionToken(rawToken);

    // Find session by token hash
    const result = await this.db
      .select({
        sessionId: sessions.id,
        userId: sessions.userId,
        expiresAt: sessions.expiresAt,
        revokedAt: sessions.revokedAt,
        lastActiveAt: sessions.lastActiveAt,
        email: users.email,
        emailVerified: users.emailVerified,
        accountStatus: users.accountStatus,
      })
      .from(sessions)
      .innerJoin(users, eq(sessions.userId, users.id))
      .where(eq(sessions.tokenHash, tokenHash))
      .limit(1);

    const session = result[0];
    if (!session) return null;

    // Check revocation
    if (session.revokedAt) return null;

    // Check expiration
    if (session.expiresAt < new Date()) return null;

    // Check account status (correction 7: live check, not cached)
    if (session.accountStatus === 'DISABLED' || session.accountStatus === 'SUSPENDED') {
      return null;
    }

    // Throttled last_active_at update (correction 19: distributed-safe conditional DB update)
    const now = new Date();
    const elapsed = now.getTime() - session.lastActiveAt.getTime();
    if (elapsed > LAST_ACTIVE_THROTTLE_MS) {
      // Conditional update: only write if still sufficiently old (avoids race conditions across instances)
      this.db
        .update(sessions)
        .set({ lastActiveAt: now })
        .where(
          and(
            eq(sessions.id, session.sessionId),
            sql`${sessions.lastActiveAt} < ${new Date(now.getTime() - LAST_ACTIVE_THROTTLE_MS)}`,
          ),
        )
        .execute()
        .catch((err) => {
          this.logger.warn({ err, sessionId: session.sessionId }, 'Failed to update last_active_at');
        });
    }

    // Fetch CURRENT roles from DB (correction 7)
    const userRoleRows = await this.db
      .select({ roleName: roles.name })
      .from(userRoles)
      .innerJoin(roles, eq(userRoles.roleId, roles.id))
      .where(eq(userRoles.userId, session.userId));

    return {
      sessionId: session.sessionId,
      userId: session.userId,
      email: session.email,
      emailVerified: session.emailVerified,
      accountStatus: session.accountStatus,
      roles: userRoleRows.map((r) => r.roleName),
    };
  }

  /**
   * List active sessions for a user.
   */
  async listSessions(userId: string): Promise<SessionListItem[]> {
    const result = await this.db
      .select({
        id: sessions.id,
        ipAddress: sessions.ipAddress,
        userAgent: sessions.userAgent,
        createdAt: sessions.createdAt,
        lastActiveAt: sessions.lastActiveAt,
      })
      .from(sessions)
      .where(
        and(
          eq(sessions.userId, userId),
          isNull(sessions.revokedAt),
          sql`${sessions.expiresAt} > NOW()`,
        ),
      )
      .orderBy(sessions.lastActiveAt);

    return result;
  }

  /**
   * Revoke a specific session. Checks ownership.
   */
  async revokeSession(sessionId: string, userId: string): Promise<boolean> {
    const result = await this.db
      .update(sessions)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(sessions.id, sessionId),
          eq(sessions.userId, userId),
          isNull(sessions.revokedAt),
        ),
      )
      .returning({ id: sessions.id });

    return result.length > 0;
  }

  /**
   * Revoke all sessions for a user, optionally except one.
   */
  async revokeAllSessions(userId: string, exceptSessionId?: string): Promise<number> {
    const conditions = [
      eq(sessions.userId, userId),
      isNull(sessions.revokedAt),
    ];
    if (exceptSessionId) {
      conditions.push(sql`${sessions.id} != ${exceptSessionId}`);
    }

    const result = await this.db
      .update(sessions)
      .set({ revokedAt: new Date() })
      .where(and(...conditions))
      .returning({ id: sessions.id });

    return result.length;
  }

  /**
   * Rotate session credential (correction 15).
   * Creates a new token/hash for an existing session after password change.
   * Returns the new raw token for the cookie.
   */
  async rotateSession(sessionId: string): Promise<string> {
    const newRawToken = generateSessionToken();
    const newTokenHash = hashSessionToken(newRawToken);
    const newExpiresAt = new Date(Date.now() + this.maxAgeSeconds * 1000);

    await this.db
      .update(sessions)
      .set({
        tokenHash: newTokenHash,
        expiresAt: newExpiresAt,
        lastActiveAt: new Date(),
      })
      .where(eq(sessions.id, sessionId));

    return newRawToken;
  }
}
