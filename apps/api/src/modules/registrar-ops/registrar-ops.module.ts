/**
 * PrisNames — Registrar Operations Module
 *
 * Encapsulates registrar operation lifecycle management.
 * This module does NOT import @prisnames/registrar-dynadot.
 */

import { Module } from '@nestjs/common';
import { RegistrarOperationService } from './registrar-operation.service.js';
import { RegistrarOperationRepository } from './registrar-operation.repository.js';
import { FqdnService } from './fqdn.service.js';
import { ContactSnapshotService } from './contact-snapshot.service.js';
import { OperationResultHandler } from './operation-result-handler.js';
import { AdminRegistrarOpsController } from './registrar-ops.controller.js';

@Module({
  providers: [
    RegistrarOperationService,
    RegistrarOperationRepository,
    FqdnService,
    ContactSnapshotService,
    OperationResultHandler,
  ],
  controllers: [AdminRegistrarOpsController],
  exports: [
    RegistrarOperationService,
    RegistrarOperationRepository,
    FqdnService,
    ContactSnapshotService,
    OperationResultHandler,
  ],
})
export class RegistrarOpsModule {}
