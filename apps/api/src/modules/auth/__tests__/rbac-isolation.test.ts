/**
 * PrisNames — RBAC Capability Isolation Tests
 *
 * Proves that the RolesGuard is CAPABILITY-BASED, not numeric hierarchy.
 *
 * Verifies:
 * - SUPPORT cannot access FINANCE-only functionality
 * - FINANCE cannot access ABUSE-only functionality
 * - ABUSE cannot access FINANCE-only functionality
 * - ADMIN access follows the approved capability matrix
 * - SUPER_ADMIN override is centralized
 * - No numeric privilege comparison is used
 */

import { describe, it, expect, vi } from 'vitest';
import { RolesGuard } from '../guards/roles.guard.js';
import { Reflector } from '@nestjs/core';
import { ROLES, type Role } from '@prisnames/contracts';

function createMockContext(userRoles: Role[]) {
  const context = {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => ({
        user: {
          userId: 'test-user-123',
          roles: userRoles,
          sessionId: 'test-session',
          email: 'test@example.com',
        },
      }),
    }),
  } as Parameters<RolesGuard['canActivate']>[0];

  return { context };
}

function createGuard(requiredRoles: Role[] | undefined): RolesGuard {
  const reflector = new Reflector();
  vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(requiredRoles);
  return new RolesGuard(reflector);
}

describe('RBAC Capability Isolation', () => {
  describe('RolesGuard uses exact role matching, NOT numeric hierarchy', () => {
    it('has NO numeric comparison logic in source code', async () => {
      // Read the actual guard source to confirm no numeric comparison
      const { readFileSync } = await import('node:fs');
      const { resolve, dirname } = await import('node:path');
      const { fileURLToPath } = await import('node:url');
      const __dirname = dirname(fileURLToPath(import.meta.url));
      const guardSource = readFileSync(
        resolve(__dirname, '../guards/roles.guard.ts'),
        'utf-8',
      );

      // Must NOT contain numeric privilege comparison patterns
      expect(guardSource).not.toContain('privilegeLevel');
      expect(guardSource).not.toContain('>=');
      expect(guardSource).not.toContain('<=');
      expect(guardSource).not.toContain('level >');
      expect(guardSource).not.toContain('level <');
      expect(guardSource).not.toContain('indexOf');

      // MUST contain .includes() for exact role matching
      expect(guardSource).toContain('.includes(');
      // MUST contain .some() for checking required roles
      expect(guardSource).toContain('.some(');
    });
  });

  describe('SUPPORT cannot access FINANCE-only endpoints', () => {
    it('SUPPORT user is rejected by FINANCE-guarded endpoint', () => {
      const guard = createGuard([ROLES.FINANCE]);
      const { context } = createMockContext([ROLES.SUPPORT]);
      expect(() => guard.canActivate(context)).toThrow();
    });
  });

  describe('FINANCE cannot access ABUSE-only endpoints', () => {
    it('FINANCE user is rejected by ABUSE-guarded endpoint', () => {
      const guard = createGuard([ROLES.ABUSE]);
      const { context } = createMockContext([ROLES.FINANCE]);
      expect(() => guard.canActivate(context)).toThrow();
    });
  });

  describe('ABUSE cannot access FINANCE-only endpoints', () => {
    it('ABUSE user is rejected by FINANCE-guarded endpoint', () => {
      const guard = createGuard([ROLES.FINANCE]);
      const { context } = createMockContext([ROLES.ABUSE]);
      expect(() => guard.canActivate(context)).toThrow();
    });
  });

  describe('SUPPORT cannot access ABUSE-only endpoints', () => {
    it('SUPPORT user is rejected by ABUSE-guarded endpoint', () => {
      const guard = createGuard([ROLES.ABUSE]);
      const { context } = createMockContext([ROLES.SUPPORT]);
      expect(() => guard.canActivate(context)).toThrow();
    });
  });

  describe('ADMIN capability matrix', () => {
    it('ADMIN can access ADMIN-guarded endpoints', () => {
      const guard = createGuard([ROLES.ADMIN]);
      const { context } = createMockContext([ROLES.ADMIN]);
      expect(guard.canActivate(context)).toBe(true);
    });

    it('ADMIN cannot access SUPER_ADMIN-guarded endpoints', () => {
      const guard = createGuard([ROLES.SUPER_ADMIN]);
      const { context } = createMockContext([ROLES.ADMIN]);
      expect(() => guard.canActivate(context)).toThrow();
    });

    it('ADMIN cannot access endpoints restricted to different roles', () => {
      const guard = createGuard([ROLES.FINANCE]);
      const { context } = createMockContext([ROLES.ADMIN]);
      expect(() => guard.canActivate(context)).toThrow();
    });
  });

  describe('SUPER_ADMIN centralized override', () => {
    it('SUPER_ADMIN can access USER-guarded endpoints', () => {
      const guard = createGuard([ROLES.USER]);
      const { context } = createMockContext([ROLES.SUPER_ADMIN]);
      expect(guard.canActivate(context)).toBe(true);
    });

    it('SUPER_ADMIN can access SUPPORT-guarded endpoints', () => {
      const guard = createGuard([ROLES.SUPPORT]);
      const { context } = createMockContext([ROLES.SUPER_ADMIN]);
      expect(guard.canActivate(context)).toBe(true);
    });

    it('SUPER_ADMIN can access FINANCE-guarded endpoints', () => {
      const guard = createGuard([ROLES.FINANCE]);
      const { context } = createMockContext([ROLES.SUPER_ADMIN]);
      expect(guard.canActivate(context)).toBe(true);
    });

    it('SUPER_ADMIN can access ABUSE-guarded endpoints', () => {
      const guard = createGuard([ROLES.ABUSE]);
      const { context } = createMockContext([ROLES.SUPER_ADMIN]);
      expect(guard.canActivate(context)).toBe(true);
    });

    it('SUPER_ADMIN can access ADMIN-guarded endpoints', () => {
      const guard = createGuard([ROLES.ADMIN]);
      const { context } = createMockContext([ROLES.SUPER_ADMIN]);
      expect(guard.canActivate(context)).toBe(true);
    });
  });

  describe('multi-role endpoints', () => {
    it('endpoint requiring FINANCE or ABUSE allows FINANCE', () => {
      const guard = createGuard([ROLES.FINANCE, ROLES.ABUSE]);
      const { context } = createMockContext([ROLES.FINANCE]);
      expect(guard.canActivate(context)).toBe(true);
    });

    it('endpoint requiring FINANCE or ABUSE allows ABUSE', () => {
      const guard = createGuard([ROLES.FINANCE, ROLES.ABUSE]);
      const { context } = createMockContext([ROLES.ABUSE]);
      expect(guard.canActivate(context)).toBe(true);
    });

    it('endpoint requiring FINANCE or ABUSE rejects SUPPORT', () => {
      const guard = createGuard([ROLES.FINANCE, ROLES.ABUSE]);
      const { context } = createMockContext([ROLES.SUPPORT]);
      expect(() => guard.canActivate(context)).toThrow();
    });
  });

  describe('no @Roles() decorator → open to all authenticated users', () => {
    it('allows any role when no required roles specified', () => {
      const guard = createGuard(undefined);
      const { context } = createMockContext([ROLES.USER]);
      expect(guard.canActivate(context)).toBe(true);
    });

    it('allows any role when empty roles specified', () => {
      const guard = createGuard([]);
      const { context } = createMockContext([ROLES.SUPPORT]);
      expect(guard.canActivate(context)).toBe(true);
    });
  });

  describe('USER cannot access privileged endpoints', () => {
    it('USER rejected from SUPPORT-guarded endpoint', () => {
      const guard = createGuard([ROLES.SUPPORT]);
      const { context } = createMockContext([ROLES.USER]);
      expect(() => guard.canActivate(context)).toThrow();
    });

    it('USER rejected from ADMIN-guarded endpoint', () => {
      const guard = createGuard([ROLES.ADMIN]);
      const { context } = createMockContext([ROLES.USER]);
      expect(() => guard.canActivate(context)).toThrow();
    });
  });
});
