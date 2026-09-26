/**
 * PrisNames — Domain Controller
 *
 * API endpoints for domain management:
 * - Customer endpoints: user-scoped read access
 * - Admin endpoints: capability-based read access
 *
 * Reference: Phase 6 Implementation Plan §17
 */

import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { AuthGuard } from '../auth/guards/auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { PermissionGuard } from '../auth/guards/permission.guard.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { RequirePermission } from '../auth/decorators/permission.decorator.js';
import { PERMISSIONS } from '@prisnames/contracts';
import type { ValidatedSession } from '../auth/session.service.js';
import { DomainService } from './domain.service.js';

// ──────────────────────────────────────────────
// CUSTOMER ENDPOINTS
// ──────────────────────────────────────────────

@Controller('domains')
@UseGuards(AuthGuard)
export class DomainController {
  constructor(private readonly domainService: DomainService) {}

  @Get()
  async listMyDomains(
    @CurrentUser() user: ValidatedSession,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const result = await this.domainService.listUserDomains(
      user.userId,
      page ? parseInt(page, 10) : 1,
      pageSize ? parseInt(pageSize, 10) : 20,
    );
    return {
      domains: result.domains.map(d => ({
        id: d.id,
        fqdn: d.fqdn,
        lifecycleStatus: d.lifecycleStatus,
        registeredAt: d.registeredAt?.toISOString(),
        expiresAt: d.expiresAt?.toISOString(),
        autoRenewEnabled: d.autoRenewEnabled,
        createdAt: d.createdAt.toISOString(),
      })),
      total: result.total,
    };
  }

  @Get(':id')
  async getMyDomain(
    @CurrentUser() user: ValidatedSession,
    @Param('id') id: string,
  ) {
    const domain = await this.domainService.findById(id);
    if (!domain || domain.userId !== user.userId) {
      throw new HttpException(
        { code: 'DOMAIN_NOT_FOUND', message: 'Domain not found' },
        HttpStatus.NOT_FOUND,
      );
    }
    return {
      id: domain.id,
      fqdn: domain.fqdn,
      lifecycleStatus: domain.lifecycleStatus,
      registeredAt: domain.registeredAt?.toISOString(),
      expiresAt: domain.expiresAt?.toISOString(),
      autoRenewEnabled: domain.autoRenewEnabled,
      privacyLevel: domain.privacyLevel,
      isTransferLocked: domain.isTransferLocked,
      createdAt: domain.createdAt.toISOString(),
    };
  }
}

// ──────────────────────────────────────────────
// ADMIN ENDPOINTS
// ──────────────────────────────────────────────

@Controller('admin/domains')
@UseGuards(AuthGuard, RolesGuard, PermissionGuard)
export class AdminDomainController {
  constructor(private readonly domainService: DomainService) {}

  @Get()
  @RequirePermission(PERMISSIONS.DOMAINS_READ_ALL)
  async listAllDomains(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const result = await this.domainService.listAllDomains(
      page ? parseInt(page, 10) : 1,
      pageSize ? parseInt(pageSize, 10) : 20,
    );
    return {
      domains: result.domains,
      total: result.total,
    };
  }

  @Get(':id')
  @RequirePermission(PERMISSIONS.DOMAINS_READ_ALL)
  async getDomain(@Param('id') id: string) {
    const domain = await this.domainService.findById(id);
    if (!domain) {
      throw new HttpException(
        { code: 'DOMAIN_NOT_FOUND', message: 'Domain not found' },
        HttpStatus.NOT_FOUND,
      );
    }
    return domain;
  }
}
