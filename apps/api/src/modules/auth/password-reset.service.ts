/**
 * PrisNames — Password Reset Service
 *
 * Forgot-password and reset-password flows.
 *
 * Security requirements:
 * - Always return same response regardless of account existence (correction 12)
 * - Timing-safe: always do work even for non-existent accounts
 * - Email sent AFTER transaction commits (correction 11)
 * - Reset revokes ALL sessions (correction 15)
 * - Single-use tokens with SHA-256 hashing
 */

import { Injectable, Inject, HttpException, HttpStatus } from '@nestjs/common';
import { eq, and, isNull } from 'drizzle-orm';
import { type Database } from '@prisnames/database/client';
import { passwordResets, passwordCredentials, users, sessions } from '@prisnames/database/schema';
import { generateSecureToken, hashToken, hashPassword, normalizeEmail } from '@prisnames/security';
import { AUTH_ERROR_CODES } from '@prisnames/contracts';
import { DATABASE_TOKEN } from '../../database/database.module.js';
import { RateLimitService } from './rate-limit.service.js';

/** Reset token expiration in minutes */
const RESET_EXPIRY_MINUTES = 60;

@Injectable()
export class PasswordResetService {
  constructor(
    @Inject(DATABASE_TOKEN) private readonly db: Database,
    private readonly rateLimitService: RateLimitService,
  ) {}

  /**
   * Create a password reset request.
   * Returns the plaintext token for inclusion in the email, or null if account doesn't exist.
   * Caller must always return the same response to the user regardless (timing-safe).
   */
  async createReset(email: string, ipAddress?: string): Promise<{ token: string; userId: string } | null> {
    const canonical = normalizeEmail(email);
    const emailHash = hashToken(canonical);

    // Multi-dimensional rate limiting (correction 8)
    await this.rateLimitService.check([
      { key: `rate:auth:forgot:${emailHash}`, max: 3, windowSeconds: 3600 },
      ...(ipAddress ? [{ key: `rate:auth:forgot:ip:${ipAddress}`, max: 10, windowSeconds: 3600 }] : []),
    ]);

    // Find user by canonical email
    const userRows = await this.db
      .select({ id: users.id, accountStatus: users.accountStatus })
      .from(users)
      .where(eq(users.emailCanonical, canonical))
      .limit(1);

    const user = userRows[0];
    if (!user || user.accountStatus === 'DISABLED') {
      // Account doesn't exist or is disabled — return null
      // Caller must still return success and add artificial delay (correction 12)
      return null;
    }

    const rawToken = generateSecureToken();
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + RESET_EXPIRY_MINUTES * 60 * 1000);

    await this.db.insert(passwordResets).values({
      userId: user.id,
      tokenHash,
      expiresAt,
    });

    return { token: rawToken, userId: user.id };
  }

  /**
   * Execute a password reset using a valid token.
   * Transactional: validate → update credential → revoke ALL sessions → mark token used.
   */
  async executeReset(rawToken: string, newPassword: string, ipAddress?: string): Promise<void> {
    const tokenHash = hashToken(rawToken);

    // Rate limit by token and IP (correction 8)
    await this.rateLimitService.check([
      { key: `rate:auth:reset:${tokenHash.substring(0, 16)}`, max: 5, windowSeconds: 900 },
      ...(ipAddress ? [{ key: `rate:auth:reset:ip:${ipAddress}`, max: 10, windowSeconds: 900 }] : []),
    ]);

    // Find the reset token
    const resets = await this.db
      .select()
      .from(passwordResets)
      .where(
        and(
          eq(passwordResets.tokenHash, tokenHash),
          isNull(passwordResets.usedAt),
        ),
      )
      .limit(1);

    const reset = resets[0];
    if (!reset) {
      throw new HttpException(
        { code: AUTH_ERROR_CODES.TOKEN_INVALID, message: 'Invalid or expired reset link' },
        HttpStatus.BAD_REQUEST,
      );
    }

    if (reset.expiresAt < new Date()) {
      throw new HttpException(
        { code: AUTH_ERROR_CODES.TOKEN_EXPIRED, message: 'Reset link has expired' },
        HttpStatus.BAD_REQUEST,
      );
    }

    // Hash new password
    const newPasswordHash = await hashPassword(newPassword);

    // Transactional: update password + revoke sessions + mark token used
    await this.db.transaction(async (tx) => {
      // Update password credential
      await tx
        .update(passwordCredentials)
        .set({
          passwordHash: newPasswordHash,
          changedAt: new Date(),
        })
        .where(eq(passwordCredentials.userId, reset.userId));

      // Revoke ALL sessions (correction 15)
      await tx
        .update(sessions)
        .set({ revokedAt: new Date() })
        .where(eq(sessions.userId, reset.userId));

      // Mark token as used (single-use)
      await tx
        .update(passwordResets)
        .set({ usedAt: new Date() })
        .where(eq(passwordResets.id, reset.id));
    });
  }
}
