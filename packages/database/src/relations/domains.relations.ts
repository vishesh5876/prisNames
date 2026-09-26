import { relations } from 'drizzle-orm';
import {
  domains,
  domainContacts,
  domainNameservers,
  domainDnsRecords,
  domainEvents,
} from '../schema/domains.js';
import { users } from '../schema/auth.js';
import { registrarProviders } from '../schema/registrar.js';

export const domainsRelations = relations(domains, ({ one, many }) => ({
  user: one(users, {
    fields: [domains.userId],
    references: [users.id],
  }),
  registrarProvider: one(registrarProviders, {
    fields: [domains.registrarProviderId],
    references: [registrarProviders.id],
  }),
  contacts: many(domainContacts),
  nameservers: many(domainNameservers),
  dnsRecords: many(domainDnsRecords),
  events: many(domainEvents),
}));

export const domainContactsRelations = relations(domainContacts, ({ one }) => ({
  domain: one(domains, {
    fields: [domainContacts.domainId],
    references: [domains.id],
  }),
}));

export const domainNameserversRelations = relations(domainNameservers, ({ one }) => ({
  domain: one(domains, {
    fields: [domainNameservers.domainId],
    references: [domains.id],
  }),
}));

export const domainDnsRecordsRelations = relations(domainDnsRecords, ({ one }) => ({
  domain: one(domains, {
    fields: [domainDnsRecords.domainId],
    references: [domains.id],
  }),
}));

export const domainEventsRelations = relations(domainEvents, ({ one }) => ({
  domain: one(domains, {
    fields: [domainEvents.domainId],
    references: [domains.id],
  }),
}));
