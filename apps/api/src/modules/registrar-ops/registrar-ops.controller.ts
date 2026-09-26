/**
 * PrisNames — Admin Registrar Operations Controller
 *
 * Capability-based admin endpoints for registrar operation management.
 *
 * Reference: Phase 6 Implementation Plan §17.3
 */

import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
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
import {
  RegistrarOperationService,
  type ManualReviewAction,
} from './registrar-operation.service.js';
import { RegistrarOperationRepository } from './registrar-operation.repository.js';

@Controller('admin/registrar-ops')
@UseGuards(AuthGuard, RolesGuard, PermissionGuard)
export class AdminRegistrarOpsController {
  constructor(
    private readonly opService: RegistrarOperationService,
    private readonly opRepo: RegistrarOperationRepository,
  ) {}

  @Get()
  @RequirePermission(PERMISSIONS.REGISTRAR_OPS_READ)
  async listOperations(
    @Query('status') status?: string,
    @Query('operationType') operationType?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.opRepo.listOperations(
      { status, operationType },
      page ? parseInt(page, 10) : 1,
      pageSize ? parseInt(pageSize, 10) : 20,
    );
  }

  @Get(':id')
  @RequirePermission(PERMISSIONS.REGISTRAR_OPS_READ)
  async getOperation(@Param('id') id: string) {
    const op = await this.opRepo.findById(id);
    if (!op) {
      throw new HttpException(
        { code: 'OPERATION_NOT_FOUND', message: 'Operation not found' },
        HttpStatus.NOT_FOUND,
      );
    }
    return op;
  }

  @Post(':id/resolve')
  @RequirePermission(PERMISSIONS.REGISTRAR_OPS_RESOLVE)
  async resolveManualReview(
    @Param('id') id: string,
    @CurrentUser() admin: ValidatedSession,
    @Body() body: ManualReviewAction,
  ) {
    const result = await this.opService.resolveManualReview(
      id,
      body,
      admin.userId,
    );
    return result;
  }
}
