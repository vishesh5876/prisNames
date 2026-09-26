/**
 * PrisNames — Auth Module
 *
 * Wires up all auth services, guards, and controller.
 * AuthGuard and RolesGuard are registered as APP_GUARD (global).
 */

import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { SessionService } from './session.service.js';
import { EmailVerificationService } from './email-verification.service.js';
import { PasswordResetService } from './password-reset.service.js';
import { AuditService } from './audit.service.js';
import { RateLimitService } from './rate-limit.service.js';
import { AuthGuard } from './guards/auth.guard.js';
import { RolesGuard } from './guards/roles.guard.js';

@Module({
  controllers: [AuthController],
  providers: [
    AuthService,
    SessionService,
    EmailVerificationService,
    PasswordResetService,
    AuditService,
    RateLimitService,

    // Global guards — applied to ALL routes
    // @Public() bypasses AuthGuard
    // @Roles() activates RolesGuard
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
  exports: [
    AuthService,
    SessionService,
    AuditService,
    RateLimitService,
  ],
})
export class AuthModule {}
