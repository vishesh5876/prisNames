/**
 * PrisNames — §18 Authorization Integration Tests
 *
 * Verifies PermissionGuard execution and ownership isolation
 * for USER, SUPPORT, FINANCE, ABUSE, ADMIN, and SUPER_ADMIN.
 *
 * Tests are unit-level (mocked reflector) but exercise the real guard logic,
 * proving permission-based endpoints actually execute PermissionGuard.
 */

import { describe, it, expect, vi } from 'vitest';
import { Reflector } from '@nestjs/core';
import { HttpException, HttpStatus } from '@nestjs/common';
import { PermissionGuard } from '../../auth/guards/permission.guard.js';
import { ROLES, PERMISSIONS, ROLE_PERMISSIONS, type Role, type Permission } from '@prisnames/contracts';

// ──────────────────────────────────────────────
// HELPERS
// ──────────────────────────────────────────────

function createMockContext(userRoles: Role[], userId = 'test-user') {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => ({
        user: {
          userId,
          roles: userRoles,
          sessionId: 'test-session',
          email: 'test@example.com',
        },
      }),
    }),
  } as Parameters<PermissionGuard['canActivate']>[0];
}

function createGuard(requiredPermission: Permission | undefined): PermissionGuard {
  const reflector = new Reflector();
  vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(requiredPermission);
  return new PermissionGuard(reflector);
}

// ──────────────────────────────────────────────
// §18 AUTHORIZATION TESTS
// ──────────────────────────────────────────────

describe('§18 Authorization Integration', () => {
  // ════════════════════════════════════════════
  // USER role
  // ════════════════════════════════════════════

  describe('USER', () => {
    const role: Role[] = [ROLES.USER];

    it('can access endpoints with no permission requirement (own domains/orders)', () => {
      const guard = createGuard(undefined);
      const ctx = createMockContext(role);
      expect(guard.canActivate(ctx)).toBe(true);
    });

    it('cannot access admin registrar-operation endpoints (registrar_ops:read)', () => {
      const guard = createGuard(PERMISSIONS.REGISTRAR_OPS_READ);
      const ctx = createMockContext(role);
      expect(() => guard.canActivate(ctx)).toThrow(HttpException);
      try { guard.canActivate(ctx); } catch (e) {
        expect((e as HttpException).getStatus()).toBe(HttpStatus.FORBIDDEN);
      }
    });

    it('cannot access admin registrar-operation resolve (registrar_ops:resolve)', () => {
      const guard = createGuard(PERMISSIONS.REGISTRAR_OPS_RESOLVE);
      const ctx = createMockContext(role);
      expect(() => guard.canActivate(ctx)).toThrow(HttpException);
    });

    it('cannot access admin orders (orders:read_all)', () => {
      const guard = createGuard(PERMISSIONS.ORDERS_READ_ALL);
      const ctx = createMockContext(role);
      expect(() => guard.canActivate(ctx)).toThrow(HttpException);
    });

    it('cannot access admin domains (domains:read_all)', () => {
      const guard = createGuard(PERMISSIONS.DOMAINS_READ_ALL);
      const ctx = createMockContext(role);
      expect(() => guard.canActivate(ctx)).toThrow(HttpException);
    });
  });

  // ════════════════════════════════════════════
  // SUPPORT role
  // ════════════════════════════════════════════

  describe('SUPPORT', () => {
    const role: Role[] = [ROLES.SUPPORT];

    it('can read registrar operations', () => {
      const guard = createGuard(PERMISSIONS.REGISTRAR_OPS_READ);
      const ctx = createMockContext(role);
      expect(guard.canActivate(ctx)).toBe(true);
    });

    it('can read orders (orders:read_all)', () => {
      const guard = createGuard(PERMISSIONS.ORDERS_READ_ALL);
      const ctx = createMockContext(role);
      expect(guard.canActivate(ctx)).toBe(true);
    });

    it('can read domains (domains:read_all)', () => {
      const guard = createGuard(PERMISSIONS.DOMAINS_READ_ALL);
      const ctx = createMockContext(role);
      expect(guard.canActivate(ctx)).toBe(true);
    });

    it('cannot resolve MANUAL_REVIEW (registrar_ops:resolve)', () => {
      const guard = createGuard(PERMISSIONS.REGISTRAR_OPS_RESOLVE);
      const ctx = createMockContext(role);
      expect(() => guard.canActivate(ctx)).toThrow(HttpException);
    });
  });

  // ════════════════════════════════════════════
  // FINANCE role
  // ════════════════════════════════════════════

  describe('FINANCE', () => {
    const role: Role[] = [ROLES.FINANCE];

    it('receives only configured permissions (orders:read_all only)', () => {
      // Can read orders
      const guard1 = createGuard(PERMISSIONS.ORDERS_READ_ALL);
      expect(guard1.canActivate(createMockContext(role))).toBe(true);
    });

    it('cannot read registrar operations', () => {
      const guard = createGuard(PERMISSIONS.REGISTRAR_OPS_READ);
      expect(() => guard.canActivate(createMockContext(role))).toThrow(HttpException);
    });

    it('cannot resolve registrar operations', () => {
      const guard = createGuard(PERMISSIONS.REGISTRAR_OPS_RESOLVE);
      expect(() => guard.canActivate(createMockContext(role))).toThrow(HttpException);
    });

    it('cannot read domains', () => {
      const guard = createGuard(PERMISSIONS.DOMAINS_READ_ALL);
      expect(() => guard.canActivate(createMockContext(role))).toThrow(HttpException);
    });
  });

  // ════════════════════════════════════════════
  // ABUSE role
  // ════════════════════════════════════════════

  describe('ABUSE', () => {
    const role: Role[] = [ROLES.ABUSE];

    it('receives only configured domain permissions (domains:read_all)', () => {
      const guard = createGuard(PERMISSIONS.DOMAINS_READ_ALL);
      expect(guard.canActivate(createMockContext(role))).toBe(true);
    });

    it('cannot read registrar operations', () => {
      const guard = createGuard(PERMISSIONS.REGISTRAR_OPS_READ);
      expect(() => guard.canActivate(createMockContext(role))).toThrow(HttpException);
    });

    it('cannot resolve registrar operations', () => {
      const guard = createGuard(PERMISSIONS.REGISTRAR_OPS_RESOLVE);
      expect(() => guard.canActivate(createMockContext(role))).toThrow(HttpException);
    });

    it('cannot read orders', () => {
      const guard = createGuard(PERMISSIONS.ORDERS_READ_ALL);
      expect(() => guard.canActivate(createMockContext(role))).toThrow(HttpException);
    });
  });

  // ════════════════════════════════════════════
  // ADMIN role
  // ════════════════════════════════════════════

  describe('ADMIN', () => {
    const role: Role[] = [ROLES.ADMIN];

    it('can resolve MANUAL_REVIEW (registrar_ops:resolve)', () => {
      const guard = createGuard(PERMISSIONS.REGISTRAR_OPS_RESOLVE);
      expect(guard.canActivate(createMockContext(role))).toBe(true);
    });

    it('can read registrar operations', () => {
      const guard = createGuard(PERMISSIONS.REGISTRAR_OPS_READ);
      expect(guard.canActivate(createMockContext(role))).toBe(true);
    });

    it('can read orders', () => {
      const guard = createGuard(PERMISSIONS.ORDERS_READ_ALL);
      expect(guard.canActivate(createMockContext(role))).toBe(true);
    });

    it('can read domains', () => {
      const guard = createGuard(PERMISSIONS.DOMAINS_READ_ALL);
      expect(guard.canActivate(createMockContext(role))).toBe(true);
    });
  });

  // ════════════════════════════════════════════
  // SUPER_ADMIN role
  // ════════════════════════════════════════════

  describe('SUPER_ADMIN', () => {
    const role: Role[] = [ROLES.SUPER_ADMIN];

    it('implicit override: can access registrar_ops:read', () => {
      const guard = createGuard(PERMISSIONS.REGISTRAR_OPS_READ);
      expect(guard.canActivate(createMockContext(role))).toBe(true);
    });

    it('implicit override: can access registrar_ops:resolve', () => {
      const guard = createGuard(PERMISSIONS.REGISTRAR_OPS_RESOLVE);
      expect(guard.canActivate(createMockContext(role))).toBe(true);
    });

    it('implicit override: can access orders:read_all', () => {
      const guard = createGuard(PERMISSIONS.ORDERS_READ_ALL);
      expect(guard.canActivate(createMockContext(role))).toBe(true);
    });

    it('implicit override: can access domains:read_all', () => {
      const guard = createGuard(PERMISSIONS.DOMAINS_READ_ALL);
      expect(guard.canActivate(createMockContext(role))).toBe(true);
    });

    it('SUPER_ADMIN is not listed in ROLE_PERMISSIONS (implicit, not explicit)', () => {
      expect(ROLE_PERMISSIONS).not.toHaveProperty('SUPER_ADMIN');
    });
  });

  // ════════════════════════════════════════════
  // Guard execution verification
  // ════════════════════════════════════════════

  describe('Guard execution verification', () => {
    it('unauthenticated user (no user) → 401 UNAUTHORIZED', () => {
      const guard = createGuard(PERMISSIONS.REGISTRAR_OPS_READ);
      const ctx = {
        getHandler: () => ({}),
        getClass: () => ({}),
        switchToHttp: () => ({
          getRequest: () => ({ user: undefined }),
        }),
      } as Parameters<PermissionGuard['canActivate']>[0];

      expect(() => guard.canActivate(ctx)).toThrow(HttpException);
      try { guard.canActivate(ctx); } catch (e) {
        expect((e as HttpException).getStatus()).toBe(HttpStatus.UNAUTHORIZED);
      }
    });

    it('no @RequirePermission decorator → allows any authenticated user', () => {
      const guard = createGuard(undefined);
      const ctx = createMockContext([ROLES.USER]);
      expect(guard.canActivate(ctx)).toBe(true);
    });

    it('controllers use @UseGuards(AuthGuard, RolesGuard, PermissionGuard)', async () => {
      const { readFileSync } = await import('node:fs');
      const { resolve, dirname } = await import('node:path');
      const { fileURLToPath } = await import('node:url');
      const __dirname = dirname(fileURLToPath(import.meta.url));

      const controllerFiles = [
        resolve(__dirname, '../../registrar-ops/registrar-ops.controller.ts'),
        resolve(__dirname, '../../domains/domain.controller.ts'),
        resolve(__dirname, '../../orders/order.controller.ts'),
      ];

      for (const file of controllerFiles) {
        const source = readFileSync(file, 'utf-8');
        // Admin controllers MUST have all three guards
        expect(source).toContain('UseGuards(AuthGuard, RolesGuard, PermissionGuard)');
        // Must import PermissionGuard
        expect(source).toContain("import { PermissionGuard }");
      }
    });

    it('admin registrar-ops endpoints use @RequirePermission', async () => {
      const { readFileSync } = await import('node:fs');
      const { resolve, dirname } = await import('node:path');
      const { fileURLToPath } = await import('node:url');
      const __dirname = dirname(fileURLToPath(import.meta.url));

      const source = readFileSync(
        resolve(__dirname, '../../registrar-ops/registrar-ops.controller.ts'),
        'utf-8',
      );
      // listOperations and getOperation use READ
      expect(source).toContain("@RequirePermission(PERMISSIONS.REGISTRAR_OPS_READ)");
      // resolveManualReview uses RESOLVE
      expect(source).toContain("@RequirePermission(PERMISSIONS.REGISTRAR_OPS_RESOLVE)");
    });

    it('admin domain endpoints use @RequirePermission(DOMAINS_READ_ALL)', async () => {
      const { readFileSync } = await import('node:fs');
      const { resolve, dirname } = await import('node:path');
      const { fileURLToPath } = await import('node:url');
      const __dirname = dirname(fileURLToPath(import.meta.url));

      const source = readFileSync(
        resolve(__dirname, '../../domains/domain.controller.ts'),
        'utf-8',
      );
      expect(source).toContain("@RequirePermission(PERMISSIONS.DOMAINS_READ_ALL)");
    });

    it('admin order endpoints use @RequirePermission(ORDERS_READ_ALL)', async () => {
      const { readFileSync } = await import('node:fs');
      const { resolve, dirname } = await import('node:path');
      const { fileURLToPath } = await import('node:url');
      const __dirname = dirname(fileURLToPath(import.meta.url));

      const source = readFileSync(
        resolve(__dirname, '../../orders/order.controller.ts'),
        'utf-8',
      );
      expect(source).toContain("@RequirePermission(PERMISSIONS.ORDERS_READ_ALL)");
    });
  });

  // ════════════════════════════════════════════
  // Ownership isolation (customer endpoints)
  // ════════════════════════════════════════════

  describe('Ownership isolation', () => {
    it('customer domain controller scopes by userId (source-level proof)', async () => {
      const { readFileSync } = await import('node:fs');
      const { resolve, dirname } = await import('node:path');
      const { fileURLToPath } = await import('node:url');
      const __dirname = dirname(fileURLToPath(import.meta.url));

      const source = readFileSync(
        resolve(__dirname, '../../domains/domain.controller.ts'),
        'utf-8',
      );
      // listMyDomains passes user.userId
      expect(source).toContain('user.userId');
      // getMyDomain checks domain.userId !== user.userId
      expect(source).toContain('domain.userId !== user.userId');
    });

    it('customer order controller scopes by userId (source-level proof)', async () => {
      const { readFileSync } = await import('node:fs');
      const { resolve, dirname } = await import('node:path');
      const { fileURLToPath } = await import('node:url');
      const __dirname = dirname(fileURLToPath(import.meta.url));

      const source = readFileSync(
        resolve(__dirname, '../../orders/order.controller.ts'),
        'utf-8',
      );
      // listMyOrders passes user.userId
      expect(source).toContain('user.userId');
      // getMyOrder checks order.userId !== user.userId
      expect(source).toContain('order.userId !== user.userId');
    });
  });

  // ════════════════════════════════════════════
  // ROLE_PERMISSIONS exhaustive verification
  // ════════════════════════════════════════════

  describe('ROLE_PERMISSIONS completeness', () => {
    it('every permission in ROLE_PERMISSIONS is a valid Permission constant', () => {
      const allPerms = Object.values(PERMISSIONS);
      for (const [_role, perms] of Object.entries(ROLE_PERMISSIONS)) {
        for (const perm of perms!) {
          expect(allPerms).toContain(perm);
        }
      }
    });

    it('SUPPORT has exactly 3 permissions', () => {
      expect(ROLE_PERMISSIONS.SUPPORT).toHaveLength(3);
      expect(ROLE_PERMISSIONS.SUPPORT).toContain(PERMISSIONS.REGISTRAR_OPS_READ);
      expect(ROLE_PERMISSIONS.SUPPORT).toContain(PERMISSIONS.ORDERS_READ_ALL);
      expect(ROLE_PERMISSIONS.SUPPORT).toContain(PERMISSIONS.DOMAINS_READ_ALL);
    });

    it('FINANCE has exactly 1 permission', () => {
      expect(ROLE_PERMISSIONS.FINANCE).toHaveLength(1);
      expect(ROLE_PERMISSIONS.FINANCE).toContain(PERMISSIONS.ORDERS_READ_ALL);
    });

    it('ABUSE has exactly 1 permission', () => {
      expect(ROLE_PERMISSIONS.ABUSE).toHaveLength(1);
      expect(ROLE_PERMISSIONS.ABUSE).toContain(PERMISSIONS.DOMAINS_READ_ALL);
    });

    it('ADMIN has exactly 4 permissions (including resolve)', () => {
      expect(ROLE_PERMISSIONS.ADMIN).toHaveLength(4);
      expect(ROLE_PERMISSIONS.ADMIN).toContain(PERMISSIONS.REGISTRAR_OPS_READ);
      expect(ROLE_PERMISSIONS.ADMIN).toContain(PERMISSIONS.REGISTRAR_OPS_RESOLVE);
      expect(ROLE_PERMISSIONS.ADMIN).toContain(PERMISSIONS.ORDERS_READ_ALL);
      expect(ROLE_PERMISSIONS.ADMIN).toContain(PERMISSIONS.DOMAINS_READ_ALL);
    });
  });
});
