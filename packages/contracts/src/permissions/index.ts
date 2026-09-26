/**
 * PrisNames — Permissions Contracts
 *
 * Capability-based permissions extending the existing @Roles() model.
 * Phase 6 introduces fine-grained permissions mapped to roles at the application level.
 *
 * SUPER_ADMIN has implicit all-access (centralized in RolesGuard).
 * Role → Permission mapping is application-level, not stored in DB.
 *
 * Reference: Phase 6 Implementation Plan §16.3
 */

import type { Role } from '../auth/index.js';

// ──────────────────────────────────────────────
// PERMISSIONS
// ──────────────────────────────────────────────

export const PERMISSIONS = {
  REGISTRAR_OPS_READ: 'registrar_ops:read',
  REGISTRAR_OPS_RESOLVE: 'registrar_ops:resolve',
  ORDERS_READ_ALL: 'orders:read_all',
  DOMAINS_READ_ALL: 'domains:read_all',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

// ──────────────────────────────────────────────
// ROLE → PERMISSION MAPPING
// ──────────────────────────────────────────────

export const ROLE_PERMISSIONS: Partial<Record<Role, readonly Permission[]>> = {
  SUPPORT: [
    PERMISSIONS.REGISTRAR_OPS_READ,
    PERMISSIONS.ORDERS_READ_ALL,
    PERMISSIONS.DOMAINS_READ_ALL,
  ],
  FINANCE: [PERMISSIONS.ORDERS_READ_ALL],
  ABUSE: [PERMISSIONS.DOMAINS_READ_ALL],
  ADMIN: [
    PERMISSIONS.REGISTRAR_OPS_READ,
    PERMISSIONS.REGISTRAR_OPS_RESOLVE,
    PERMISSIONS.ORDERS_READ_ALL,
    PERMISSIONS.DOMAINS_READ_ALL,
  ],
  // SUPER_ADMIN: implicit all-access via RolesGuard
} as const;
