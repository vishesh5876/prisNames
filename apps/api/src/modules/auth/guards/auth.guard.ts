/**
 * PrisNames — Auth Guard
 *
 * Extracts session cookie → hashes → validates session → attaches user to request.
 * Public endpoints (marked with @Public()) bypass authentication.
 */

import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { FastifyRequest } from 'fastify';
import { AUTH_ERROR_CODES } from '@prisnames/contracts';
import { SESSION_COOKIE_NAME, SESSION_COOKIE_NAME_DEV } from '@prisnames/config';
import { SessionService, type ValidatedSession } from '../session.service.js';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly sessionService: SessionService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Check @Public() decorator
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const cookies = (request as FastifyRequest & { cookies: Record<string, string> }).cookies || {};

    // Try __Host- prefix first, fall back to dev cookie
    const rawToken = cookies[SESSION_COOKIE_NAME] || cookies[SESSION_COOKIE_NAME_DEV];

    if (!rawToken) {
      throw new HttpException(
        { code: AUTH_ERROR_CODES.UNAUTHORIZED, message: 'Authentication required' },
        HttpStatus.UNAUTHORIZED,
      );
    }

    const session = await this.sessionService.validateSession(rawToken);

    if (!session) {
      throw new HttpException(
        { code: AUTH_ERROR_CODES.SESSION_EXPIRED, message: 'Session expired or revoked' },
        HttpStatus.UNAUTHORIZED,
      );
    }

    // Attach validated session to request
    (request as FastifyRequest & { user: ValidatedSession }).user = session;

    return true;
  }
}
