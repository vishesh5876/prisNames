/**
 * PrisNames — Registrar Module (Composition Root)
 *
 * The ONLY module allowed to import @prisnames/registrar-dynadot.
 * All other business modules depend on @prisnames/registrar-core interfaces.
 *
 * Provides:
 * - REGISTRAR_PROVIDER token for dependency injection
 * - Provider factory for runtime resolution
 *
 * Reference: Phase 6 Implementation Plan §15.1
 */

import { Module } from '@nestjs/common';
// NOTE: This composition root is the ONLY module permitted to import @prisnames/registrar-dynadot.
// The actual DynadotRegistrarProvider instantiation will be added here when provider keys are configured.
// See architecture-lint.test.ts for enforcement.
import { RegistrarOpsModule } from '../registrar-ops/registrar-ops.module.js';
import { DomainModule } from '../domains/domain.module.js';
import { OrderModule } from '../orders/order.module.js';

export const REGISTRAR_PROVIDER_TOKEN = 'REGISTRAR_PROVIDER';

@Module({
  imports: [RegistrarOpsModule, DomainModule, OrderModule],
  providers: [
    {
      provide: REGISTRAR_PROVIDER_TOKEN,
      useFactory: () => {
        // In production, this would be initialized from config/env.
        // For now, return null — actual instantiation requires API keys.
        // Worker processes will instantiate DynadotRegistrarProvider directly.
        return null;
      },
    },
  ],
  exports: [
    REGISTRAR_PROVIDER_TOKEN,
    RegistrarOpsModule,
    DomainModule,
    OrderModule,
  ],
})
export class RegistrarModule {}
