import { relations } from 'drizzle-orm';
import { tlds, registrarProviderPrices } from '../schema/pricing.js';
import { registrarProviders } from '../schema/registrar.js';

export const tldsRelations = relations(tlds, ({ many }) => ({
  prices: many(registrarProviderPrices),
}));

export const registrarProviderPricesRelations = relations(registrarProviderPrices, ({ one }) => ({
  tld: one(tlds, {
    fields: [registrarProviderPrices.tldId],
    references: [tlds.id],
  }),
  registrarProvider: one(registrarProviders, {
    fields: [registrarProviderPrices.registrarProviderId],
    references: [registrarProviders.id],
  }),
}));
