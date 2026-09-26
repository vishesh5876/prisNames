/**
 * PrisNames — Payments Schema
 *
 * Tables: payments, payment_attempts, refunds, invoices
 *
 * Reference: DATABASE.md §3.5 (second half), ORDER_STATE_MACHINE.md §1.2-1.3
 *
 * Design decisions:
 * - Payment provider uniqueness: UNIQUE(payment_provider_id, provider_payment_id)
 *   WHERE provider_payment_id IS NOT NULL — prevents duplicate webhook processing
 * - gateway_response is stored as TEXT (will contain versioned encrypted envelope)
 *   with encryption_key_id for key rotation support
 * - Refund is a SEPARATE entity from payment (approved architecture)
 * - PaymentStatus.SUCCEEDED is immutable — never changes back
 */

import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  integer,
  bigint,
  index,
  unique,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { pkUuid, timestamps, createdTimestamp, statusCheck } from './helpers.js';
import { PAYMENT_STATUS_VALUES, REFUND_STATUS_VALUES, INVOICE_STATUS_VALUES } from './enums.js';
import { users } from './auth.js';
import { orders } from './commerce.js';

// ──────────────────────────────────────────────
// PAYMENTS
// ──────────────────────────────────────────────

export const payments = pgTable(
  'payments',
  {
    id: pkUuid(),
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'restrict' }),
    status: varchar('status', { length: 20 }).notNull().default('CREATED'),
    paymentProviderId: varchar('payment_provider_id', { length: 30 }),
    providerPaymentId: varchar('provider_payment_id', { length: 255 }),

    // Money — BIGINT minor units
    amountMinor: bigint('amount_minor', { mode: 'bigint' }).notNull(),
    currency: varchar('currency', { length: 3 }).notNull(),

    method: varchar('method', { length: 30 }),

    // Encrypted gateway response — TEXT containing versioned encrypted envelope
    gatewayResponse: text('gateway_response'),
    encryptionKeyId: varchar('encryption_key_id', { length: 50 }),

    paidAt: timestamp('paid_at', { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    // Provider-scoped payment uniqueness — prevents duplicate webhook processing
    uniqueIndex('uq_payments_provider_payment')
      .on(table.paymentProviderId, table.providerPaymentId)
      .where(sql`provider_payment_id IS NOT NULL`),

    index('idx_payments_order_id').on(table.orderId),
    index('idx_payments_status').on(table.status),
    statusCheck('chk_payments_status', 'status', PAYMENT_STATUS_VALUES),
  ],
);

// ──────────────────────────────────────────────
// PAYMENT ATTEMPTS
// ──────────────────────────────────────────────

export const paymentAttempts = pgTable('payment_attempts', {
  id: pkUuid(),
  paymentId: uuid('payment_id')
    .notNull()
    .references(() => payments.id, { onDelete: 'restrict' }),
  attemptNumber: integer('attempt_number').notNull(),
  status: varchar('status', { length: 20 }).notNull(),
  gatewayResponseCode: varchar('gateway_response_code', { length: 50 }),
  errorMessage: text('error_message'),
  ...createdTimestamp,
});

// ──────────────────────────────────────────────
// REFUNDS — Separate entity, NOT a payment status change
// ──────────────────────────────────────────────

export const refunds = pgTable(
  'refunds',
  {
    id: pkUuid(),
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'restrict' }),
    paymentId: uuid('payment_id')
      .notNull()
      .references(() => payments.id, { onDelete: 'restrict' }),
    status: varchar('status', { length: 20 }).notNull().default('CREATED'),

    // Money — BIGINT minor units
    amountMinor: bigint('amount_minor', { mode: 'bigint' }).notNull(),
    currency: varchar('currency', { length: 3 }).notNull(),

    reason: text('reason').notNull(),
    providerRefundId: varchar('provider_refund_id', { length: 255 }),
    initiatedBy: uuid('initiated_by').references(() => users.id, { onDelete: 'set null' }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    index('idx_refunds_payment_id').on(table.paymentId),
    index('idx_refunds_status').on(table.status),
    statusCheck('chk_refunds_status', 'status', REFUND_STATUS_VALUES),
  ],
);

// ──────────────────────────────────────────────
// INVOICES
// ──────────────────────────────────────────────

export const invoices = pgTable(
  'invoices',
  {
    id: pkUuid(),
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'restrict' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    invoiceNumber: varchar('invoice_number', { length: 50 }).notNull(),

    // Money — BIGINT minor units
    amountMinor: bigint('amount_minor', { mode: 'bigint' }).notNull(),
    taxMinor: bigint('tax_minor', { mode: 'bigint' }).notNull().default(sql`0`),
    totalMinor: bigint('total_minor', { mode: 'bigint' }).notNull(),
    currency: varchar('currency', { length: 3 }).notNull(),

    status: varchar('status', { length: 20 }).notNull(),
    issuedAt: timestamp('issued_at', { withTimezone: true }),
    paidAt: timestamp('paid_at', { withTimezone: true }),
    ...createdTimestamp,
  },
  (table) => [
    unique('uq_invoices_invoice_number').on(table.invoiceNumber),
    statusCheck('chk_invoices_status', 'status', INVOICE_STATUS_VALUES),
  ],
);
