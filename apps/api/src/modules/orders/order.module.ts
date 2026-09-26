/**
 * PrisNames — Order Module
 */

import { Module } from '@nestjs/common';
import { RegistrarOpsModule } from '../registrar-ops/registrar-ops.module.js';
import { OrderService } from './order.service.js';
import { OrderController, AdminOrderController } from './order.controller.js';

@Module({
  imports: [RegistrarOpsModule],
  providers: [OrderService],
  controllers: [OrderController, AdminOrderController],
  exports: [OrderService],
})
export class OrderModule {}
