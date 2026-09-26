/**
 * PrisNames — Order Models
 */

export interface OrderStatusResult {
  readonly orderId: string;
  readonly status: string;
  readonly items?: OrderItemInfo[];
  readonly createdAt?: Date;
}

export interface OrderItemInfo {
  readonly domain?: string;
  readonly operationType?: string;
  readonly status?: string;
}

export interface OrderInfo {
  readonly orderId: string;
  readonly status: string;
  readonly totalAmount?: string;
  readonly currency?: string;
  readonly createdAt?: Date;
  readonly items?: OrderItemInfo[];
}

export interface OrderHistoryParams {
  readonly page?: number;
  readonly pageSize?: number;
  readonly startDate?: Date;
  readonly endDate?: Date;
}
