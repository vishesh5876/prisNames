/**
 * PrisNames — Roles Guard
 *
 * Checks current roles from the validated session (already fetched from DB by AuthGuard).
 * SUPER_ADMIN has implicit access to all role-protected endpoints (centralized).
 * Roles are ALWAYS from the current DB state, never cached (correction 7).
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
import { AUTH_ERROR_CODES, ROLES, type Role } from '@prisnames/contracts';
import type { ValidatedSession } from '../session.service.js';
import { ROLES_KEY } from '../decorators/roles.decorator.js';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // No @Roles() decorator → no role restriction
    if (!requiredRoles || requiredRoles.length === 0) return true;

    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const user = (request as FastifyRequest & { user: ValidatedSession }).user;

    if (!user) {
      throw new HttpException(
        { code: AUTH_ERROR_CODES.UNAUTHORIZED, message: 'Authentication required' },
        HttpStatus.UNAUTHORIZED,
      );
    }

    // SUPER_ADMIN has implicit access to everything (centralized rule)
    if (user.roles.includes(ROLES.SUPER_ADMIN)) return true;

    // Check if user has any of the required roles
    const hasRole = requiredRoles.some((role) => user.roles.includes(role));
    if (!hasRole) {
      throw new HttpException(
        { code: AUTH_ERROR_CODES.FORBIDDEN, message: 'Insufficient permissions' },
        HttpStatus.FORBIDDEN,
      );
    }

    return true;
  }
}
