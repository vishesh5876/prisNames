/**
 * PrisNames — Order Service
 *
 * Owns orders.status. Evaluates fulfillment across order items.
 *
 * Multi-item fulfillment logic:
 * - ALL items SUCCEEDED → COMPLETED
 * - ANY item FAILED → FAILED
 * - Missing operations or non-terminal items → PROCESSING (never auto-complete)
 * - Zero operations created → PROCESSING (not COMPLETED)
 * - Empty fulfillable items → PROCESSING (not COMPLETED)
 *
 * Reference: Phase 6 Implementation Plan §7 (evaluateFulfillment)
 */

import { Inject, Injectable } from '@nestjs/common';
import { eq, sql, and } from 'drizzle-orm';
import { DATABASE_TOKEN } from '../../database/database.module.js';
import type { Database } from '@prisnames/database/client';
import { orders, orderItems, ORDER_STATUS, REGISTRAR_OP_STATUS } from '@prisnames/database';
import { createLogger } from '@prisnames/logger';
import { RegistrarOperationRepository } from '../registrar-ops/registrar-operation.repository.js';
import { isTerminalStatus } from '../registrar-ops/state-machine.js';

const logger = createLogger({ service: 'order-service' });

export type OrderRow = typeof orders.$inferSelect;
export type OrderItemRow = typeof orderItems.$inferSelect;

@Injectable()
export class OrderService {
  constructor(
    @Inject(DATABASE_TOKEN) private readonly db: Database,
    private readonly opRepo: RegistrarOperationRepository,
  ) {}

  /**
   * Evaluate fulfillment status across all items for an order.
   * Must be called within the TX3 transaction.
   *
   * Logic:
   * - 0 operations: PROCESSING (never auto-complete with no work done)
   * - Any FAILED: FAILED
   * - All SUCCEEDED: COMPLETED
   * - Otherwise: PROCESSING
   */
  async evaluateFulfillment(orderId: string, tx: Database): Promise<OrderRow> {
    const operations = await this.opRepo.findByOrderId(orderId, tx);

    // Zero operations → PROCESSING (never auto-complete)
    if (operations.length === 0) {
      logger.debug({ orderId }, 'No operations for order — remaining PROCESSING');
      return (await this.findById(orderId, tx))!;
    }

    // Get all order items to check if all are accounted for
    const items = await tx
      .select()
      .from(orderItems)
      .where(eq(orderItems.orderId, orderId));

    // If not all items have operations, keep PROCESSING
    const itemsWithOps = new Set(operations.map(op => op.orderItemId).filter(Boolean));
    const fulfillableItems = items.filter(i => i.operation === 'registration' || i.operation === 'renewal');

    if (fulfillableItems.length === 0) {
      logger.debug({ orderId }, 'No fulfillable items — remaining PROCESSING');
      return (await this.findById(orderId, tx))!;
    }

    if (itemsWithOps.size < fulfillableItems.length) {
      logger.debug({ orderId, itemsWithOps: itemsWithOps.size, fulfillable: fulfillableItems.length },
        'Not all fulfillable items have operations — remaining PROCESSING');
      return (await this.findById(orderId, tx))!;
    }

    // Check operation statuses
    const allSucceeded = operations.every(op => op.status === REGISTRAR_OP_STATUS.SUCCEEDED);
    const anyFailed = operations.some(op => op.status === REGISTRAR_OP_STATUS.FAILED);
    const allTerminal = operations.every(op => isTerminalStatus(op.status));

    let targetStatus: string | null = null;

    if (allSucceeded) {
      targetStatus = ORDER_STATUS.COMPLETED;
    } else if (anyFailed && allTerminal) {
      targetStatus = ORDER_STATUS.FAILED;
    }
    // Otherwise remain PROCESSING

    if (targetStatus) {
      const [updated] = await tx
        .update(orders)
        .set({
          status: targetStatus,
          completedAt: new Date(),
        })
        .where(
          and(
            eq(orders.id, orderId),
            eq(orders.status, ORDER_STATUS.PROCESSING),
          ),
        )
        .returning();

      if (updated) {
        logger.info({ orderId, status: targetStatus }, 'Order fulfillment evaluated');
        return updated;
      }
    }

    return (await this.findById(orderId, tx))!;
  }

  /**
   * Find order by ID.
   */
  async findById(orderId: string, tx?: Database): Promise<OrderRow | null> {
    const executor = tx ?? this.db;
    const [order] = await executor
      .select()
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);
    return order ?? null;
  }

  /**
   * List orders for a user (customer).
   */
  async listUserOrders(
    userId: string,
    page = 1,
    pageSize = 20,
  ): Promise<{ orders: OrderRow[]; total: number }> {
    const result = await this.db
      .select()
      .from(orders)
      .where(eq(orders.userId, userId))
      .orderBy(sql`created_at DESC`)
      .limit(pageSize)
      .offset((page - 1) * pageSize);

    const [countResult] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(orders)
      .where(eq(orders.userId, userId));

    return { orders: result, total: countResult?.count ?? 0 };
  }

  /**
   * List all orders (admin).
   */
  async listAllOrders(
    page = 1,
    pageSize = 20,
  ): Promise<{ orders: OrderRow[]; total: number }> {
    const result = await this.db
      .select()
      .from(orders)
      .orderBy(sql`created_at DESC`)
      .limit(pageSize)
      .offset((page - 1) * pageSize);

    const [countResult] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(orders);

    return { orders: result, total: countResult?.count ?? 0 };
  }
}
