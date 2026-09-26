/**
 * PrisNames — Permission Guard
 *
 * Capability-based authorization extending @Roles().
 * Checks ROLE_PERMISSIONS mapping for fine-grained access control.
 * SUPER_ADMIN bypasses all permission checks (centralized in RolesGuard).
 *
 * Reference: Phase 6 Implementation Plan §16.3
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
import { AUTH_ERROR_CODES, ROLES, ROLE_PERMISSIONS, type Permission } from '@prisnames/contracts';
import type { ValidatedSession } from '../session.service.js';
import { PERMISSION_KEY } from '../decorators/permission.decorator.js';

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermission = this.reflector.getAllAndOverride<Permission>(PERMISSION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // No @RequirePermission() decorator → no permission restriction
    if (!requiredPermission) return true;

    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const user = (request as FastifyRequest & { user: ValidatedSession }).user;

    if (!user) {
      throw new HttpException(
        { code: AUTH_ERROR_CODES.UNAUTHORIZED, message: 'Authentication required' },
        HttpStatus.UNAUTHORIZED,
      );
    }

    // SUPER_ADMIN has implicit access to everything
    if (user.roles.includes(ROLES.SUPER_ADMIN)) return true;

    // Check if any of the user's roles grants the required permission
    const hasPermission = user.roles.some((role) => {
      const perms = ROLE_PERMISSIONS[role as keyof typeof ROLE_PERMISSIONS];
      return perms?.includes(requiredPermission);
    });

    if (!hasPermission) {
      throw new HttpException(
        { code: AUTH_ERROR_CODES.FORBIDDEN, message: 'Insufficient permissions' },
        HttpStatus.FORBIDDEN,
      );
    }

    return true;
  }
}
