/**
 * PrisNames — Dynadot Orders Facet
 */

import type { RegistrarOrdersCapability } from '@prisnames/registrar-core';
import type { OrderStatusResult, OrderInfo, OrderHistoryParams } from '@prisnames/registrar-core';
import type { PaginatedResult } from '@prisnames/registrar-core';
import type { DynadotHttpClient } from '../http-client.js';
import { ENDPOINTS } from '../endpoints.js';

export class DynadotOrdersFacet implements RegistrarOrdersCapability {
  constructor(private readonly client: DynadotHttpClient) {}

  async getOrderStatus(orderId: string): Promise<OrderStatusResult> {
    // Provider serialization: Dynadot expects numeric-looking order IDs
    // Validation happens here at the provider boundary, not in business logic
    const response = await this.client.request<{
      order_id?: number;
      status?: string;
      items?: Array<{
        domain?: string;
        operation_type?: string;
        status?: string;
      }>;
      created_at?: string;
    }>(ENDPOINTS.ORDER_GET_STATUS, {
      path: `orders/${orderId}`,
    });

    return {
      orderId: String(response.data.order_id ?? orderId),
      status: response.data.status ?? 'unknown',
      items: response.data.items?.map(i => ({
        domain: i.domain,
        operationType: i.operation_type,
        status: i.status,
      })),
      createdAt: response.data.created_at ? new Date(response.data.created_at) : undefined,
    };
  }

  async getOrderHistory(params: OrderHistoryParams): Promise<PaginatedResult<OrderInfo>> {
    const queryParams: Record<string, string> = {};
    if (params.page !== undefined) queryParams.page = String(params.page);
    if (params.pageSize !== undefined) queryParams.page_size = String(params.pageSize);
    if (params.startDate) queryParams.start_date = params.startDate.toISOString().slice(0, 10);
    if (params.endDate) queryParams.end_date = params.endDate.toISOString().slice(0, 10);

    const response = await this.client.request<{
      order_list?: Array<Record<string, unknown>>;
      pagination_result?: { total_count?: number; current_page?: number; page_size?: number };
    }>(ENDPOINTS.ORDER_LIST, {
      path: 'orders',
      params: queryParams,
    });

    const list = response.data.order_list ?? [];
    const pagination = response.data.pagination_result ?? {};
    const pageSize = Number(pagination.page_size ?? params.pageSize ?? 25);

    return {
      items: list.map(o => ({
        orderId: String(o.order_id ?? ''),
        status: (o.status as string) ?? 'unknown',
        totalAmount: o.total_amount as string | undefined,
        currency: o.currency as string | undefined,
        createdAt: o.created_at ? new Date(o.created_at as string) : undefined,
        items: (o.items as Array<Record<string, unknown>> | undefined)?.map(i => ({
          domain: i.domain as string | undefined,
          operationType: i.operation_type as string | undefined,
          status: i.status as string | undefined,
        })),
      })),
      total: Number(pagination.total_count ?? 0),
      page: Number(pagination.current_page ?? params.page ?? 1),
      pageSize,
      hasMore: list.length >= pageSize,
    };
  }
}
