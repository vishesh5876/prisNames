/**
 * PrisNames — Email Verification Service
 *
 * OTP lifecycle: create → verify → resend
 * Uses HMAC-SHA256 with AUTH_OTP_PEPPER for OTP hashing.
 * Multi-dimensional rate limiting (user, IP, challenge attempts).
 */

import { Injectable, Inject, HttpException, HttpStatus } from '@nestjs/common';
import { eq, and, desc } from 'drizzle-orm';
import { type Database } from '@prisnames/database/client';
import { emailVerifications, users } from '@prisnames/database/schema';
import { generateOtp, hashOtp, verifyOtp } from '@prisnames/security';
import { AUTH_ERROR_CODES } from '@prisnames/contracts';
import { DATABASE_TOKEN } from '../../database/database.module.js';
import { RateLimitService } from './rate-limit.service.js';
import { getEnv } from '@prisnames/config';

/** OTP expiration in minutes */
const OTP_EXPIRY_MINUTES = 10;
/** Max verification attempts per OTP */
const MAX_ATTEMPTS = 5;
/** Resend cooldown in seconds */
const RESEND_COOLDOWN_SECONDS = 60;

@Injectable()
export class EmailVerificationService {
  private readonly otpPepper: string;

  constructor(
    @Inject(DATABASE_TOKEN) private readonly db: Database,
    private readonly rateLimitService: RateLimitService,
  ) {
    this.otpPepper = getEnv().AUTH_OTP_PEPPER;
  }

  /**
   * Create a new email verification challenge.
   * Returns the plaintext OTP for inclusion in the email.
   * Must be called AFTER the DB transaction commits (correction 11).
   */
  async createVerification(userId: string): Promise<string> {
    // Invalidate any existing pending verifications
    await this.db
      .update(emailVerifications)
      .set({ invalidated: true })
      .where(
        and(
          eq(emailVerifications.userId, userId),
          eq(emailVerifications.invalidated, false),
        ),
      );

    const otp = generateOtp();
    const otpHash = hashOtp(otp, this.otpPepper);
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

    await this.db.insert(emailVerifications).values({
      userId,
      otpHash,
      method: 'EMAIL',
      expiresAt,
    });

    return otp;
  }

  /**
   * Verify an OTP for a user.
   * Checks: exists, not expired, not invalidated, not max attempts.
   */
  async verify(userId: string, otp: string, ipAddress?: string): Promise<void> {
    // Multi-dimensional rate limiting (correction 8)
    await this.rateLimitService.check([
      { key: `rate:auth:verify:${userId}`, max: 10, windowSeconds: 900 },
      ...(ipAddress ? [{ key: `rate:auth:verify:ip:${ipAddress}`, max: 20, windowSeconds: 900 }] : []),
    ]);

    // Find latest non-invalidated verification for this user
    const verifications = await this.db
      .select()
      .from(emailVerifications)
      .where(
        and(
          eq(emailVerifications.userId, userId),
          eq(emailVerifications.invalidated, false),
        ),
      )
      .orderBy(desc(emailVerifications.createdAt))
      .limit(1);

    const verification = verifications[0];

    if (!verification) {
      throw new HttpException(
        { code: AUTH_ERROR_CODES.OTP_INVALID, message: 'No pending verification found' },
        HttpStatus.BAD_REQUEST,
      );
    }

    // Check expiration
    if (verification.expiresAt < new Date()) {
      throw new HttpException(
        { code: AUTH_ERROR_CODES.OTP_EXPIRED, message: 'Verification code has expired' },
        HttpStatus.BAD_REQUEST,
      );
    }

    // Check attempt limit
    if (verification.attempts >= MAX_ATTEMPTS) {
      await this.db
        .update(emailVerifications)
        .set({ invalidated: true })
        .where(eq(emailVerifications.id, verification.id));

      throw new HttpException(
        { code: AUTH_ERROR_CODES.OTP_MAX_ATTEMPTS, message: 'Too many attempts. Please request a new code.' },
        HttpStatus.BAD_REQUEST,
      );
    }

    // Increment attempts
    await this.db
      .update(emailVerifications)
      .set({ attempts: verification.attempts + 1 })
      .where(eq(emailVerifications.id, verification.id));

    // Verify OTP using constant-time HMAC comparison
    if (!verifyOtp(otp, verification.otpHash, this.otpPepper)) {
      throw new HttpException(
        { code: AUTH_ERROR_CODES.OTP_INVALID, message: 'Invalid verification code' },
        HttpStatus.BAD_REQUEST,
      );
    }

    // Mark as verified
    await this.db
      .update(emailVerifications)
      .set({ verifiedAt: new Date(), invalidated: true })
      .where(eq(emailVerifications.id, verification.id));

    // Update user's email_verified flag
    await this.db
      .update(users)
      .set({ emailVerified: true })
      .where(eq(users.id, userId));
  }

  /**
   * Resend verification OTP.
   * Enforces cooldown and rate limits.
   * Returns the new plaintext OTP.
   */
  async resend(userId: string, ipAddress?: string): Promise<string> {
    // Multi-dimensional rate limiting (correction 8)
    await this.rateLimitService.check([
      { key: `rate:auth:resend:${userId}`, max: 5, windowSeconds: 3600 },
      ...(ipAddress ? [{ key: `rate:auth:resend:ip:${ipAddress}`, max: 10, windowSeconds: 3600 }] : []),
    ]);

    // Check cooldown
    const recent = await this.db
      .select({ createdAt: emailVerifications.createdAt })
      .from(emailVerifications)
      .where(eq(emailVerifications.userId, userId))
      .orderBy(desc(emailVerifications.createdAt))
      .limit(1);

    if (recent[0]) {
      const elapsed = (Date.now() - recent[0].createdAt.getTime()) / 1000;
      if (elapsed < RESEND_COOLDOWN_SECONDS) {
        throw new HttpException(
          { code: AUTH_ERROR_CODES.OTP_COOLDOWN, message: 'Please wait before requesting a new code' },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }

    return this.createVerification(userId);
  }
}
