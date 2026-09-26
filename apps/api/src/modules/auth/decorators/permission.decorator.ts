/**
 * PrisNames — Permission Decorator
 *
 * @RequirePermission() decorator for capability-based authorization.
 * Works alongside @Roles() — not a replacement.
 *
 * Reference: Phase 6 Implementation Plan §16.3
 */

import { SetMetadata } from '@nestjs/common';
import type { Permission } from '@prisnames/contracts';

export const PERMISSION_KEY = 'permission';
export const RequirePermission = (permission: Permission) =>
  SetMetadata(PERMISSION_KEY, permission);
