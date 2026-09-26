/**
 * PrisNames — Email Verified Guard
 *
 * Rejects unverified users for application features (correction 6).
 * Unverified users may still access auth/verification endpoints.
 */

import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { AUTH_ERROR_CODES } from '@prisnames/contracts';
import type { ValidatedSession } from '../session.service.js';

@Injectable()
export class EmailVerifiedGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const user = (request as FastifyRequest & { user: ValidatedSession }).user;

    if (!user) {
      throw new HttpException(
        { code: AUTH_ERROR_CODES.UNAUTHORIZED, message: 'Authentication required' },
        HttpStatus.UNAUTHORIZED,
      );
    }

    if (!user.emailVerified) {
      throw new HttpException(
        { code: AUTH_ERROR_CODES.EMAIL_NOT_VERIFIED, message: 'Email verification required' },
        HttpStatus.FORBIDDEN,
      );
    }

    return true;
  }
}
