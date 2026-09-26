/**
 * PrisNames — Domains Schema
 *
 * Tables: domains, domain_contacts, domain_nameservers, domain_dns_records, domain_events
 *
 * Reference: DATABASE.md §3.2, ORDER_STATE_MACHINE.md §1.5-1.6, DOMAIN_LIFECYCLE.md
 *
 * Domain ownership/registration-instance model:
 * ──────────────────────────────────────────────
 * A `domains` row represents ONE REGISTRATION INSTANCE (ownership period), not a
 * permanent canonical FQDN identity. Each row captures the full lifecycle of one
 * customer's ownership of a domain name through PrisNames.
 *
 * Two independent temporal markers:
 *
 *   registration_ended_at — The registration/ownership instance has ended.
 *     Set when a domain transfers away, is deleted by the registrar, or expires
 *     beyond redemption. Historical records with registration_ended_at set remain
 *     fully queryable — they are NOT deleted.
 *
 *   deleted_at — The record itself is soft-deleted (administrative/data-hygiene).
 *     Distinct from registration ending. A transferred-away domain is historical,
 *     not deleted.
 *
 * Ownership lifecycle example:
 *   1. Customer A registers example.com → row created (registration_ended_at NULL)
 *   2. Customer A transfers away → registration_ended_at = now()
 *      (record remains, with full history of contacts, nameservers, events)
 *   3. Years later, Customer B registers example.com through PrisNames
 *      → NEW row created (registration_ended_at NULL)
 *      → Customer A's historical record is unchanged and queryable
 *
 * Uniqueness strategy:
 *   UNIQUE(fqdn) WHERE registration_ended_at IS NULL AND deleted_at IS NULL
 *   Only one CURRENT registration instance per FQDN.
 *
 * Provider resource uniqueness:
 *   UNIQUE(registrar_provider_id, provider_domain_id)
 *   WHERE provider_domain_id IS NOT NULL AND registration_ended_at IS NULL AND deleted_at IS NULL
 */

import {
  pgTable,
  uuid,
  varchar,
  boolean,
  text,
  timestamp,
  integer,
  jsonb,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { pkUuid, timestamps, createdTimestamp, softDelete, statusCheck } from './helpers.js';
import { DOMAIN_LIFECYCLE_VALUES } from './enums.js';
import { users } from './auth.js';
import { registrarProviders } from './registrar.js';

// ──────────────────────────────────────────────
// DOMAINS
// ──────────────────────────────────────────────

export const domains = pgTable(
  'domains',
  {
    id: pkUuid(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    fqdn: varchar('fqdn', { length: 255 }).notNull(),
    sld: varchar('sld', { length: 200 }).notNull(),
    tld: varchar('tld', { length: 50 }).notNull(),

    // === Lifecycle (single state machine) ===
    lifecycleStatus: varchar('lifecycle_status', { length: 30 })
      .notNull()
      .default('PENDING_REGISTRATION'),

    // === Independent operational flags ===
    isSuspended: boolean('is_suspended').notNull().default(false),
    suspensionType: varchar('suspension_type', { length: 50 }),
    suspensionReason: text('suspension_reason'),
    suspendedAt: timestamp('suspended_at', { withTimezone: true }),

    isTransferLocked: boolean('is_transfer_locked').notNull().default(true),
    transferLockUpdatedAt: timestamp('transfer_lock_updated_at', { withTimezone: true }),

    privacyLevel: varchar('privacy_level', { length: 20 }),
    privacyUpdatedAt: timestamp('privacy_updated_at', { withTimezone: true }),

    autoRenewEnabled: boolean('auto_renew_enabled').notNull().default(false),
    renewOption: varchar('renew_option', { length: 30 }),

    registrarHold: boolean('registrar_hold').notNull().default(false),

    // === Provider state (raw, for reconciliation) ===
    providerStatus: varchar('provider_status', { length: 50 }),
    providerExpirationInfo: jsonb('provider_expiration_info'),

    // === Provider ownership ===
    registrarProviderId: uuid('registrar_provider_id')
      .notNull()
      .references(() => registrarProviders.id, { onDelete: 'restrict' }),
    providerDomainId: varchar('provider_domain_id', { length: 255 }),

    // === Registration lifecycle ===
    registeredAt: timestamp('registered_at', { withTimezone: true }),
    expiresAt: timestamp('expires_at', { withTimezone: true }),

    // === Registration instance ended ===
    // Set when this ownership/registration instance ends (transfer-out, expiry,
    // registrar deletion). Distinct from deleted_at (which is administrative
    // soft-delete). A domain with registration_ended_at set is historical, not deleted.
    registrationEndedAt: timestamp('registration_ended_at', { withTimezone: true }),
    registrationEndedReason: varchar('registration_ended_reason', { length: 30 }),

    ...timestamps,
    ...softDelete,
  },
  (table) => [
    // Only one CURRENT registration instance per FQDN.
    // Historical rows (registration_ended_at IS NOT NULL) are excluded.
    // Soft-deleted rows are also excluded.
    uniqueIndex('uq_domains_fqdn_active')
      .on(table.fqdn)
      .where(sql`registration_ended_at IS NULL AND deleted_at IS NULL`),

    // Provider resource uniqueness: only current registration instances
    uniqueIndex('uq_domains_provider_domain')
      .on(table.registrarProviderId, table.providerDomainId)
      .where(sql`provider_domain_id IS NOT NULL AND registration_ended_at IS NULL AND deleted_at IS NULL`),

    index('idx_domains_user_id').on(table.userId),
    index('idx_domains_expires_at').on(table.expiresAt),
    index('idx_domains_lifecycle_status').on(table.lifecycleStatus),
    index('idx_domains_registrar_provider_id').on(table.registrarProviderId),
    statusCheck('chk_domains_lifecycle_status', 'lifecycle_status', DOMAIN_LIFECYCLE_VALUES),
  ],
);

// ──────────────────────────────────────────────
// DOMAIN CONTACTS
// PII fields stored as VARCHAR — encrypted at application layer (AES-256-GCM)
// ──────────────────────────────────────────────

export const domainContacts = pgTable('domain_contacts', {
  id: pkUuid(),
  domainId: uuid('domain_id')
    .notNull()
    .references(() => domains.id, { onDelete: 'cascade' }),
  contactType: varchar('contact_type', { length: 20 }).notNull(),
  firstName: varchar('first_name', { length: 100 }),
  lastName: varchar('last_name', { length: 100 }),
  company: varchar('company', { length: 200 }),
  email: varchar('email', { length: 255 }),
  phone: varchar('phone', { length: 30 }),
  addressLine1: varchar('address_line1', { length: 255 }),
  addressLine2: varchar('address_line2', { length: 255 }),
  city: varchar('city', { length: 100 }),
  state: varchar('state', { length: 100 }),
  postalCode: varchar('postal_code', { length: 20 }),
  country: varchar('country', { length: 2 }),
  providerContactId: varchar('provider_contact_id', { length: 255 }),
  ...timestamps,
});

// ──────────────────────────────────────────────
// DOMAIN NAMESERVERS
// ──────────────────────────────────────────────

export const domainNameservers = pgTable('domain_nameservers', {
  id: pkUuid(),
  domainId: uuid('domain_id')
    .notNull()
    .references(() => domains.id, { onDelete: 'cascade' }),
  hostname: varchar('hostname', { length: 255 }).notNull(),
  sortOrder: integer('sort_order').notNull(),
  ...timestamps,
});

// ──────────────────────────────────────────────
// DOMAIN DNS RECORDS
// ──────────────────────────────────────────────

export const domainDnsRecords = pgTable('domain_dns_records', {
  id: pkUuid(),
  domainId: uuid('domain_id')
    .notNull()
    .references(() => domains.id, { onDelete: 'cascade' }),
  recordType: varchar('record_type', { length: 10 }).notNull(),
  hostname: varchar('hostname', { length: 255 }).notNull(),
  value: text('value').notNull(),
  ttl: integer('ttl').notNull().default(3600),
  priority: integer('priority'),
  ...timestamps,
});

// ──────────────────────────────────────────────
// DOMAIN EVENTS — Immutable lifecycle event log
// ──────────────────────────────────────────────

export const domainEvents = pgTable('domain_events', {
  id: pkUuid(),
  domainId: uuid('domain_id')
    .notNull()
    .references(() => domains.id, { onDelete: 'restrict' }),
  eventType: varchar('event_type', { length: 50 }).notNull(),
  eventData: jsonb('event_data'),
  source: varchar('source', { length: 20 }).notNull(),
  ...createdTimestamp,
});
