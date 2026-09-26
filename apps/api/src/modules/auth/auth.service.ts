/**
 * PrisNames — Auth Service
 *
 * Registration, login, and password change orchestration.
 *
 * Key security decisions:
 * - Email sent AFTER transaction commits (correction 11)
 * - Timing-safe login: dummy Argon2 for non-existent accounts (correction 10)
 * - Unverified users can login and access limited endpoints (correction 6)
 * - Password change: revoke other sessions + rotate current (correction 15)
 */

import { Injectable, Inject, HttpException, HttpStatus } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { type Database } from '@prisnames/database/client';
import {
  users, passwordCredentials, authIdentities, userRoles, roles,
} from '@prisnames/database/schema';
import {
  hashPassword, verifyPassword, getDummyHash, normalizeEmail,
} from '@prisnames/security';
import { AUTH_ERROR_CODES, ROLES, type AuthUser, type RegisterDto, type LoginDto, type ChangePasswordDto } from '@prisnames/contracts';
import { DATABASE_TOKEN } from '../../database/database.module.js';
import { SessionService, type SessionMeta } from './session.service.js';
import { EmailVerificationService } from './email-verification.service.js';
import { AuditService, AUDIT_EVENTS } from './audit.service.js';
import { RateLimitService } from './rate-limit.service.js';

@Injectable()
export class AuthService {

  constructor(
    @Inject(DATABASE_TOKEN) private readonly db: Database,
    private readonly sessionService: SessionService,
    private readonly emailVerificationService: EmailVerificationService,
    private readonly auditService: AuditService,
    private readonly rateLimitService: RateLimitService,
  ) {}

  /**
   * Detect PostgreSQL unique constraint violation (error code 23505).
   * Used to safely translate concurrent registration races into application errors.
   */
  private isUniqueViolation(err: unknown): boolean {
    if (typeof err === 'object' && err !== null && 'code' in err) {
      return (err as { code: string }).code === '23505';
    }
    return false;
  }

  /**
   * Register a new user account.
   *
   * Transaction: create user → auth_identity → password_credential → USER role → verification challenge → session
   * Email is sent AFTER commit (correction 11).
   *
   * Returns: { user, rawToken, otp } where otp is for sending via email provider outside the tx.
   */
  async register(
    dto: RegisterDto,
    meta: SessionMeta & { ipAddress?: string },
  ): Promise<{ user: AuthUser; rawToken: string; otp: string }> {
    // Rate limit by IP (correction 8)
    if (meta.ipAddress) {
      await this.rateLimitService.check([
        { key: `rate:auth:register:ip:${meta.ipAddress}`, max: 5, windowSeconds: 3600 },
      ]);
    }

    const canonical = normalizeEmail(dto.email);

    // Check for existing email
    const existing = await this.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.emailCanonical, canonical))
      .limit(1);

    if (existing.length > 0) {
      throw new HttpException(
        { code: AUTH_ERROR_CODES.EMAIL_ALREADY_REGISTERED, message: 'An account with this email already exists' },
        HttpStatus.CONFLICT,
      );
    }

    const passwordHash = await hashPassword(dto.password);

    // Transaction: create all records
    // Wrapped in try-catch to handle concurrent registration race conditions.
    // Database UNIQUE(email_canonical) is the final concurrency guarantee.
    let result;
    try {
      result = await this.db.transaction(async (tx) => {
        // Create user
        const [newUser] = await tx.insert(users).values({
          email: dto.email.trim(),
          emailCanonical: canonical,
          displayName: dto.displayName || null,
        }).returning();

        // Create auth identity (email provider)
        await tx.insert(authIdentities).values({
          userId: newUser!.id,
          provider: 'email',
          providerId: canonical,
        });

        // Create password credential
        await tx.insert(passwordCredentials).values({
          userId: newUser!.id,
          passwordHash,
        });

        // Assign USER role
        const userRole = await tx
          .select({ id: roles.id })
          .from(roles)
          .where(eq(roles.name, ROLES.USER))
          .limit(1);

        if (userRole.length > 0) {
          await tx.insert(userRoles).values({
            userId: newUser!.id,
            roleId: userRole[0]!.id,
          });
        }

        return newUser!;
      });
    } catch (err: unknown) {
      // Translate PostgreSQL unique constraint violation to safe app error.
      // Never expose raw database errors to clients.
      if (this.isUniqueViolation(err)) {
        throw new HttpException(
          { code: AUTH_ERROR_CODES.EMAIL_ALREADY_REGISTERED, message: 'An account with this email already exists' },
          HttpStatus.CONFLICT,
        );
      }
      throw err;
    }

    // AFTER commit: create verification challenge (correction 11)
    const otp = await this.emailVerificationService.createVerification(result.id);

    // AFTER commit: create session
    const { rawToken } = await this.sessionService.createSession(result.id, meta);

    // Audit
    await this.auditService.log({
      actorId: result.id,
      actorType: 'USER',
      action: AUDIT_EVENTS.USER_REGISTERED,
      resourceType: 'user',
      resourceId: result.id,
      ipAddress: meta.ipAddress,
    });

    return {
      user: {
        id: result.id,
        email: result.email,
        displayName: result.displayName,
        emailVerified: false,
        accountStatus: result.accountStatus,
        roles: [ROLES.USER],
        createdAt: result.createdAt.toISOString(),
      },
      rawToken,
      otp,
    };
  }

  /**
   * Login with email and password.
   *
   * Timing-safe: runs dummy Argon2 verify for non-existent accounts (correction 10).
   * Unverified users CAN login and get a session (correction 6).
   */
  async login(
    dto: LoginDto,
    meta: SessionMeta & { ipAddress?: string },
  ): Promise<{ user: AuthUser; rawToken: string }> {
    const canonical = normalizeEmail(dto.email);
    const emailHash = normalizeEmail(dto.email); // Already canonical

    // Multi-dimensional rate limiting (correction 8)
    await this.rateLimitService.check([
      ...(meta.ipAddress ? [{ key: `rate:auth:login:ip:${meta.ipAddress}`, max: 10, windowSeconds: 900 }] : []),
      { key: `rate:auth:login:email:${emailHash}`, max: 5, windowSeconds: 900 },
    ]);

    // Find user
    const userRows = await this.db
      .select()
      .from(users)
      .where(eq(users.emailCanonical, canonical))
      .limit(1);

    const user = userRows[0];

    if (!user) {
      // Timing-safe: run dummy Argon2 verify (correction 10)
      const dummyHash = await getDummyHash();
      await verifyPassword(dto.password, dummyHash);
      throw new HttpException(
        { code: AUTH_ERROR_CODES.INVALID_CREDENTIALS, message: 'Invalid email or password' },
        HttpStatus.UNAUTHORIZED,
      );
    }

    // Check account status (correction: DISABLED and SUSPENDED both reject)
    if (user.accountStatus === 'DISABLED') {
      throw new HttpException(
        { code: AUTH_ERROR_CODES.ACCOUNT_DISABLED, message: 'This account has been disabled' },
        HttpStatus.FORBIDDEN,
      );
    }
    if (user.accountStatus === 'SUSPENDED') {
      throw new HttpException(
        { code: AUTH_ERROR_CODES.ACCOUNT_SUSPENDED, message: 'This account has been suspended' },
        HttpStatus.FORBIDDEN,
      );
    }

    // Get password credential
    const credentials = await this.db
      .select()
      .from(passwordCredentials)
      .where(eq(passwordCredentials.userId, user.id))
      .limit(1);

    if (credentials.length === 0) {
      // No password credential (shouldn't happen for email provider, but handle gracefully)
      throw new HttpException(
        { code: AUTH_ERROR_CODES.INVALID_CREDENTIALS, message: 'Invalid email or password' },
        HttpStatus.UNAUTHORIZED,
      );
    }

    // Verify password
    const { valid, needsRehash } = await verifyPassword(dto.password, credentials[0]!.passwordHash);

    if (!valid) {
      await this.auditService.log({
        actorType: 'USER',
        action: AUDIT_EVENTS.LOGIN_FAILED,
        resourceType: 'user',
        resourceId: user.id,
        ipAddress: meta.ipAddress,
        metadata: { email: canonical },
      });

      throw new HttpException(
        { code: AUTH_ERROR_CODES.INVALID_CREDENTIALS, message: 'Invalid email or password' },
        HttpStatus.UNAUTHORIZED,
      );
    }

    // Rehash if needed (Argon2 params changed)
    if (needsRehash) {
      const newHash = await hashPassword(dto.password);
      await this.db
        .update(passwordCredentials)
        .set({ passwordHash: newHash, changedAt: new Date() })
        .where(eq(passwordCredentials.userId, user.id));
    }

    // Create session (unverified users CAN login — correction 6)
    const { rawToken } = await this.sessionService.createSession(user.id, meta);

    // Get current roles
    const userRoleRows = await this.db
      .select({ roleName: roles.name })
      .from(userRoles)
      .innerJoin(roles, eq(userRoles.roleId, roles.id))
      .where(eq(userRoles.userId, user.id));

    // Audit
    await this.auditService.log({
      actorId: user.id,
      actorType: 'USER',
      action: AUDIT_EVENTS.LOGIN_SUCCEEDED,
      resourceType: 'user',
      resourceId: user.id,
      ipAddress: meta.ipAddress,
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        emailVerified: user.emailVerified,
        accountStatus: user.accountStatus,
        roles: userRoleRows.map((r) => r.roleName),
        createdAt: user.createdAt.toISOString(),
      },
      rawToken,
    };
  }

  /**
   * Get current user profile from session.
   */
  async getCurrentUser(userId: string): Promise<AuthUser> {
    const userRows = await this.db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    const user = userRows[0];
    if (!user) {
      throw new HttpException(
        { code: AUTH_ERROR_CODES.UNAUTHORIZED, message: 'User not found' },
        HttpStatus.UNAUTHORIZED,
      );
    }

    const userRoleRows = await this.db
      .select({ roleName: roles.name })
      .from(userRoles)
      .innerJoin(roles, eq(userRoles.roleId, roles.id))
      .where(eq(userRoles.userId, userId));

    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      emailVerified: user.emailVerified,
      accountStatus: user.accountStatus,
      roles: userRoleRows.map((r) => r.roleName),
      createdAt: user.createdAt.toISOString(),
    };
  }

  /**
   * Change password while authenticated.
   * Revokes all OTHER sessions and rotates the current session (correction 15).
   */
  async changePassword(
    userId: string,
    currentSessionId: string,
    dto: ChangePasswordDto,
    ipAddress?: string,
  ): Promise<string> {
    // Get current credential
    const credentials = await this.db
      .select()
      .from(passwordCredentials)
      .where(eq(passwordCredentials.userId, userId))
      .limit(1);

    if (credentials.length === 0) {
      throw new HttpException(
        { code: AUTH_ERROR_CODES.INVALID_CREDENTIALS, message: 'Current password is incorrect' },
        HttpStatus.BAD_REQUEST,
      );
    }

    // Verify current password
    const { valid } = await verifyPassword(dto.currentPassword, credentials[0]!.passwordHash);
    if (!valid) {
      throw new HttpException(
        { code: AUTH_ERROR_CODES.INVALID_CREDENTIALS, message: 'Current password is incorrect' },
        HttpStatus.BAD_REQUEST,
      );
    }

    // Hash new password
    const newHash = await hashPassword(dto.newPassword);

    // Transaction: update password
    await this.db.transaction(async (tx) => {
      await tx
        .update(passwordCredentials)
        .set({ passwordHash: newHash, changedAt: new Date() })
        .where(eq(passwordCredentials.userId, userId));
    });

    // Revoke all OTHER sessions (correction 15)
    await this.sessionService.revokeAllSessions(userId, currentSessionId);

    // Rotate current session credential (correction 15)
    const newRawToken = await this.sessionService.rotateSession(currentSessionId);

    // Audit
    await this.auditService.log({
      actorId: userId,
      actorType: 'USER',
      action: AUDIT_EVENTS.PASSWORD_CHANGED,
      resourceType: 'user',
      resourceId: userId,
      ipAddress,
    });

    return newRawToken;
  }
}
