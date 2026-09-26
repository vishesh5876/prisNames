/**
 * PrisNames — Auth Controller
 *
 * All Phase 3 authentication endpoints.
 *
 * Auth request bodies are NEVER logged (correction 18).
 * Email is enqueued via BullMQ OUTSIDE transactions (correction 11).
 * Forgot-password uses minimum response-time floor for timing resistance (correction 12).
 */

import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  Req,
  Res,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { FastifyRequest, FastifyReply } from 'fastify';
import {
  registerSchema,
  loginSchema,
  verifyEmailSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
  type SessionInfo,
} from '@prisnames/contracts';
import { AuthService } from './auth.service.js';
import { SessionService, type ValidatedSession } from './session.service.js';
import { EmailVerificationService } from './email-verification.service.js';
import { PasswordResetService } from './password-reset.service.js';
import { AuditService, AUDIT_EVENTS } from './audit.service.js';
import { AuthEmailQueueService } from '../../queues/auth-email-queue.module.js';
import { Public } from './decorators/public.decorator.js';
import { CurrentUser } from './decorators/current-user.decorator.js';
import { getSessionCookieConfig, getClearCookieConfig } from './cookie.config.js';

/** Minimum response time in ms for forgot-password to resist timing attacks */
const FORGOT_PASSWORD_MIN_RESPONSE_MS = 250;

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly authService: AuthService,
    private readonly sessionService: SessionService,
    private readonly emailVerificationService: EmailVerificationService,
    private readonly passwordResetService: PasswordResetService,
    private readonly auditService: AuditService,
    private readonly authEmailQueue: AuthEmailQueueService,
  ) {}

  /** POST /auth/register */
  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(
    @Body() body: unknown,
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const dto = registerSchema.parse(body);
    const ip = request.ip;

    // Registration: DB transaction → commit → enqueue email → return
    const result = await this.authService.register(dto, {
      ipAddress: ip,
      userAgent: request.headers['user-agent'],
    });

    // Enqueue verification email via BullMQ (durable, survives restarts)
    try {
      await this.authEmailQueue.enqueueVerification(
        result.user.email,
        result.otp,
        result.user.id,
      );
    } catch (err) {
      // Queue failure is non-fatal — user can resend verification
      this.logger.error({ err, userId: result.user.id }, 'Failed to enqueue verification email');
    }

    // Set session cookie
    const cookieConfig = getSessionCookieConfig();
    reply.setCookie(cookieConfig.name, result.rawToken, cookieConfig.options);

    return { user: result.user };
  }

  /** POST /auth/login */
  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() body: unknown,
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const dto = loginSchema.parse(body);

    const result = await this.authService.login(dto, {
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'],
    });

    const cookieConfig = getSessionCookieConfig();
    reply.setCookie(cookieConfig.name, result.rawToken, cookieConfig.options);

    return { user: result.user };
  }

  /** POST /auth/verify-email */
  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  async verifyEmail(
    @Body() body: unknown,
    @CurrentUser() session: ValidatedSession,
    @Req() request: FastifyRequest,
  ) {
    const dto = verifyEmailSchema.parse(body);
    await this.emailVerificationService.verify(session.userId, dto.otp, request.ip);

    await this.auditService.log({
      actorId: session.userId,
      actorType: 'USER',
      action: AUDIT_EVENTS.EMAIL_VERIFIED,
      resourceType: 'user',
      resourceId: session.userId,
      ipAddress: request.ip,
    });

    return { message: 'Email verified successfully' };
  }

  /** POST /auth/resend-verification */
  @Post('resend-verification')
  @HttpCode(HttpStatus.OK)
  async resendVerification(
    @CurrentUser() session: ValidatedSession,
    @Req() request: FastifyRequest,
  ) {
    const otp = await this.emailVerificationService.resend(session.userId, request.ip);

    // Enqueue via BullMQ (durable)
    try {
      await this.authEmailQueue.enqueueVerification(session.email, otp, session.userId);
    } catch (err) {
      this.logger.error({ err, userId: session.userId }, 'Failed to enqueue verification email');
    }

    await this.auditService.log({
      actorId: session.userId,
      actorType: 'USER',
      action: AUDIT_EVENTS.VERIFICATION_RESENT,
      resourceType: 'user',
      resourceId: session.userId,
      ipAddress: request.ip,
    });

    return { message: 'Verification code sent' };
  }

  /** POST /auth/logout */
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(
    @CurrentUser() session: ValidatedSession,
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    await this.sessionService.revokeSession(session.sessionId, session.userId);

    const clearConfig = getClearCookieConfig();
    reply.setCookie(clearConfig.name, '', clearConfig.options);

    await this.auditService.log({
      actorId: session.userId,
      actorType: 'USER',
      action: AUDIT_EVENTS.LOGOUT,
      resourceType: 'session',
      resourceId: session.sessionId,
      ipAddress: request.ip,
    });

    return { message: 'Logged out successfully' };
  }

  /** GET /auth/me */
  @Get('me')
  async me(@CurrentUser() session: ValidatedSession) {
    const user = await this.authService.getCurrentUser(session.userId);
    return { user };
  }

  /** GET /auth/sessions */
  @Get('sessions')
  async listSessions(@CurrentUser() session: ValidatedSession): Promise<{ sessions: SessionInfo[] }> {
    const sessionList = await this.sessionService.listSessions(session.userId);
    return {
      sessions: sessionList.map((s) => ({
        id: s.id,
        ipAddress: s.ipAddress,
        userAgent: s.userAgent,
        createdAt: s.createdAt.toISOString(),
        lastActiveAt: s.lastActiveAt.toISOString(),
        isCurrent: s.id === session.sessionId,
      })),
    };
  }

  /** DELETE /auth/sessions/:sessionId */
  @Delete('sessions/:sessionId')
  async revokeSession(
    @Param('sessionId') sessionId: string,
    @CurrentUser() session: ValidatedSession,
    @Req() request: FastifyRequest,
  ) {
    const revoked = await this.sessionService.revokeSession(sessionId, session.userId);

    if (revoked) {
      await this.auditService.log({
        actorId: session.userId,
        actorType: 'USER',
        action: AUDIT_EVENTS.SESSION_REVOKED,
        resourceType: 'session',
        resourceId: sessionId,
        ipAddress: request.ip,
      });
    }

    return { message: revoked ? 'Session revoked' : 'Session not found' };
  }

  /** POST /auth/sessions/revoke-all */
  @Post('sessions/revoke-all')
  @HttpCode(HttpStatus.OK)
  async revokeAllSessions(
    @CurrentUser() session: ValidatedSession,
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const count = await this.sessionService.revokeAllSessions(session.userId);

    const clearConfig = getClearCookieConfig();
    reply.setCookie(clearConfig.name, '', clearConfig.options);

    await this.auditService.log({
      actorId: session.userId,
      actorType: 'USER',
      action: AUDIT_EVENTS.ALL_SESSIONS_REVOKED,
      resourceType: 'user',
      resourceId: session.userId,
      ipAddress: request.ip,
      metadata: { revokedCount: count },
    });

    return { message: `Revoked ${count} session(s)` };
  }

  /**
   * POST /auth/forgot-password
   *
   * Timing resistance: uses a minimum response-time floor so account existence
   * cannot be inferred from response latency. Email is enqueued via BullMQ
   * (durable), not sent synchronously, making the code path nearly identical
   * regardless of whether the account exists.
   */
  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  async forgotPassword(
    @Body() body: unknown,
    @Req() request: FastifyRequest,
  ) {
    const startTime = Date.now();
    const dto = forgotPasswordSchema.parse(body);
    const ip = request.ip;

    const result = await this.passwordResetService.createReset(dto.email, ip);

    if (result) {
      // Enqueue reset email via BullMQ (durable, non-blocking)
      try {
        await this.authEmailQueue.enqueuePasswordReset(
          dto.email,
          result.token,
          result.userId,
        );
      } catch (err) {
        this.logger.error({ err }, 'Failed to enqueue password reset email');
      }

      await this.auditService.log({
        actorId: result.userId,
        actorType: 'USER',
        action: AUDIT_EVENTS.PASSWORD_RESET_REQUESTED,
        resourceType: 'user',
        resourceId: result.userId,
        ipAddress: ip,
      });
    }

    // Minimum response-time floor: ensure we always take at least N ms
    // so account existence cannot be inferred from timing differences
    const elapsed = Date.now() - startTime;
    if (elapsed < FORGOT_PASSWORD_MIN_RESPONSE_MS) {
      await new Promise((resolve) =>
        setTimeout(resolve, FORGOT_PASSWORD_MIN_RESPONSE_MS - elapsed),
      );
    }

    // Always same response (correction 12)
    return { message: 'If an account exists with that email, a password reset link has been sent.' };
  }

  /** POST /auth/reset-password */
  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(
    @Body() body: unknown,
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const dto = resetPasswordSchema.parse(body);

    await this.passwordResetService.executeReset(dto.token, dto.newPassword, request.ip);

    // Clear any existing session cookie
    const clearConfig = getClearCookieConfig();
    reply.setCookie(clearConfig.name, '', clearConfig.options);

    return { message: 'Password reset successfully. Please login with your new password.' };
  }

  /** POST /auth/change-password */
  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  async changePassword(
    @Body() body: unknown,
    @CurrentUser() session: ValidatedSession,
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const dto = changePasswordSchema.parse(body);

    // Returns new raw token after rotation (correction 15)
    const newRawToken = await this.authService.changePassword(
      session.userId,
      session.sessionId,
      dto,
      request.ip,
    );

    // Set new session cookie with rotated token
    const cookieConfig = getSessionCookieConfig();
    reply.setCookie(cookieConfig.name, newRawToken, cookieConfig.options);

    return { message: 'Password changed successfully' };
  }
}
