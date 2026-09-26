/**
 * PrisNames — Commerce Schema
 *
 * Tables: quotes, orders, order_items
 *
 * Reference: DATABASE.md §3.5 (first half), ORDER_STATE_MACHINE.md §1.1
 *
 * Money: BIGINT minor units with _minor suffix.
 */

import {
  pgTable,
  uuid,
  varchar,
  boolean,
  integer,
  timestamp,
  bigint,
  index,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { pkUuid, timestamps, createdTimestamp, statusCheck } from './helpers.js';
import { ORDER_STATUS_VALUES } from './enums.js';
import { users } from './auth.js';
import { registrarProviders, registrarOperations } from './registrar.js';

// ──────────────────────────────────────────────
// QUOTES
// ──────────────────────────────────────────────

export const quotes = pgTable(
  'quotes',
  {
    id: pkUuid(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    domain: varchar('domain', { length: 255 }).notNull(),
    operation: varchar('operation', { length: 20 }).notNull(),
    years: integer('years').notNull().default(1),

    // Retail price snapshot
    retailAmountMinor: bigint('retail_amount_minor', { mode: 'bigint' }).notNull(),
    currency: varchar('currency', { length: 3 }).notNull(),

    // Provider cost snapshot
    providerCostMinor: bigint('provider_cost_minor', { mode: 'bigint' }).notNull(),

    isPremium: boolean('is_premium').notNull().default(false),
    registrarProviderId: uuid('registrar_provider_id')
      .notNull()
      .references(() => registrarProviders.id, { onDelete: 'restrict' }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    ...createdTimestamp,
  },
  (table) => [
    index('idx_quotes_user_id').on(table.userId),
    index('idx_quotes_expires_at').on(table.expiresAt),
  ],
);

// ──────────────────────────────────────────────
// ORDERS
// ──────────────────────────────────────────────

export const orders = pgTable(
  'orders',
  {
    id: pkUuid(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    status: varchar('status', { length: 30 }).notNull().default('DRAFT'),
    currency: varchar('currency', { length: 3 }).notNull(),

    // Money — BIGINT minor units
    subtotalMinor: bigint('subtotal_minor', { mode: 'bigint' }).notNull().default(sql`0`),
    taxMinor: bigint('tax_minor', { mode: 'bigint' }).notNull().default(sql`0`),
    discountMinor: bigint('discount_minor', { mode: 'bigint' }).notNull().default(sql`0`),
    totalMinor: bigint('total_minor', { mode: 'bigint' }).notNull().default(sql`0`),

    ...timestamps,
    completedAt: timestamp('completed_at', { withTimezone: true }),
  },
  (table) => [
    index('idx_orders_user_id').on(table.userId),
    index('idx_orders_status').on(table.status),
    statusCheck('chk_orders_status', 'status', ORDER_STATUS_VALUES),
  ],
);

// ──────────────────────────────────────────────
// ORDER ITEMS
// ──────────────────────────────────────────────

export const orderItems = pgTable('order_items', {
  id: pkUuid(),
  orderId: uuid('order_id')
    .notNull()
    .references(() => orders.id, { onDelete: 'restrict' }),
  domain: varchar('domain', { length: 255 }).notNull(),
  operation: varchar('operation', { length: 20 }).notNull(),
  years: integer('years').notNull(),

  // Money — BIGINT minor units
  amountMinor: bigint('amount_minor', { mode: 'bigint' }).notNull(),
  currency: varchar('currency', { length: 3 }).notNull(),

  isPremium: boolean('is_premium').notNull().default(false),
  quoteId: uuid('quote_id').references(() => quotes.id, { onDelete: 'set null' }),
  registrarProviderId: uuid('registrar_provider_id')
    .notNull()
    .references(() => registrarProviders.id, { onDelete: 'restrict' }),

  // Provider cost snapshot
  providerCostMinor: bigint('provider_cost_minor', { mode: 'bigint' }).notNull(),

  // Phase 6: FK to registrar operation for fulfillment tracking
  registrarOperationId: uuid('registrar_operation_id').references(
    () => registrarOperations.id,
    { onDelete: 'set null' },
  ),

  ...createdTimestamp,
});
