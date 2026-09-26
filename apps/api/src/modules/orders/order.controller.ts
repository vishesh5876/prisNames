/**
 * PrisNames — Order Controller
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
import { OrderService } from './order.service.js';

@Controller('orders')
@UseGuards(AuthGuard)
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @Get()
  async listMyOrders(
    @CurrentUser() user: ValidatedSession,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.orderService.listUserOrders(
      user.userId,
      page ? parseInt(page, 10) : 1,
      pageSize ? parseInt(pageSize, 10) : 20,
    );
  }

  @Get(':id')
  async getMyOrder(
    @CurrentUser() user: ValidatedSession,
    @Param('id') id: string,
  ) {
    const order = await this.orderService.findById(id);
    if (!order || order.userId !== user.userId) {
      throw new HttpException(
        { code: 'ORDER_NOT_FOUND', message: 'Order not found' },
        HttpStatus.NOT_FOUND,
      );
    }
    return order;
  }
}

@Controller('admin/orders')
@UseGuards(AuthGuard, RolesGuard, PermissionGuard)
export class AdminOrderController {
  constructor(private readonly orderService: OrderService) {}

  @Get()
  @RequirePermission(PERMISSIONS.ORDERS_READ_ALL)
  async listAllOrders(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.orderService.listAllOrders(
      page ? parseInt(page, 10) : 1,
      pageSize ? parseInt(pageSize, 10) : 20,
    );
  }

  @Get(':id')
  @RequirePermission(PERMISSIONS.ORDERS_READ_ALL)
  async getOrder(@Param('id') id: string) {
    const order = await this.orderService.findById(id);
    if (!order) {
      throw new HttpException(
        { code: 'ORDER_NOT_FOUND', message: 'Order not found' },
        HttpStatus.NOT_FOUND,
      );
    }
    return order;
  }
}
