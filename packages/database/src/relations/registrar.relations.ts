import { relations } from 'drizzle-orm';
import { registrarProviders, registrarOperations, transfers } from '../schema/registrar.js';
import { domains } from '../schema/domains.js';
import { orders, orderItems } from '../schema/commerce.js';

export const registrarProvidersRelations = relations(registrarProviders, ({ many }) => ({
  domains: many(domains),
  operations: many(registrarOperations),
}));

export const registrarOperationsRelations = relations(registrarOperations, ({ one }) => ({
  order: one(orders, {
    fields: [registrarOperations.orderId],
    references: [orders.id],
  }),
  orderItem: one(orderItems, {
    fields: [registrarOperations.orderItemId],
    references: [orderItems.id],
  }),
  domain: one(domains, {
    fields: [registrarOperations.domainId],
    references: [domains.id],
  }),
  registrarProvider: one(registrarProviders, {
    fields: [registrarOperations.registrarProviderId],
    references: [registrarProviders.id],
  }),
}));

export const transfersRelations = relations(transfers, ({ one }) => ({
  domain: one(domains, {
    fields: [transfers.domainId],
    references: [domains.id],
  }),
  order: one(orders, {
    fields: [transfers.orderId],
    references: [orders.id],
  }),
  registrarOperation: one(registrarOperations, {
    fields: [transfers.registrarOperationId],
    references: [registrarOperations.id],
  }),
}));
