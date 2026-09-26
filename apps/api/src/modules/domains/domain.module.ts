/**
 * PrisNames — Domain Module
 */

import { Module } from '@nestjs/common';
import { DomainService } from './domain.service.js';
import { DomainController, AdminDomainController } from './domain.controller.js';

@Module({
  providers: [DomainService],
  controllers: [DomainController, AdminDomainController],
  exports: [DomainService],
})
export class DomainModule {}
