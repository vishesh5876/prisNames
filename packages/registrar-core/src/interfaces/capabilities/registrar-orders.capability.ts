/**
 * PrisNames — Registrar Orders Capability
 */

import type { OrderStatusResult, OrderInfo, OrderHistoryParams } from '../../models/order.js';
import type { PaginatedResult } from '../../models/common.js';

export interface RegistrarOrdersCapability {
  /** Get the status of a specific order. Provider order ID is an opaque string. */
  getOrderStatus(orderId: string): Promise<OrderStatusResult>;

  /** Get order history with filtering/pagination. */
  getOrderHistory(params: OrderHistoryParams): Promise<PaginatedResult<OrderInfo>>;
}
