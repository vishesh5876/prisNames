import { relations } from 'drizzle-orm';
import { quotes, orders, orderItems } from '../schema/commerce.js';
import { users } from '../schema/auth.js';
import { registrarProviders } from '../schema/registrar.js';
import { payments, refunds, invoices } from '../schema/payments.js';

export const quotesRelations = relations(quotes, ({ one }) => ({
  user: one(users, {
    fields: [quotes.userId],
    references: [users.id],
  }),
  registrarProvider: one(registrarProviders, {
    fields: [quotes.registrarProviderId],
    references: [registrarProviders.id],
  }),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  user: one(users, {
    fields: [orders.userId],
    references: [users.id],
  }),
  items: many(orderItems),
  payments: many(payments),
  refunds: many(refunds),
  invoices: many(invoices),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, {
    fields: [orderItems.orderId],
    references: [orders.id],
  }),
  quote: one(quotes, {
    fields: [orderItems.quoteId],
    references: [quotes.id],
  }),
  registrarProvider: one(registrarProviders, {
    fields: [orderItems.registrarProviderId],
    references: [registrarProviders.id],
  }),
}));
