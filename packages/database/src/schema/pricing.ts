/**
 * PrisNames — Pricing Schema
 *
 * Tables: tlds, registrar_provider_prices
 *
 * Reference: DATABASE.md §3.4
 *
 * Money: BIGINT minor units with explicit currency.
 * Composite unique on (tld_id, registrar_provider_id, operation, years).
 */

import {
  pgTable,
  uuid,
  varchar,
  boolean,
  integer,
  timestamp,
  bigint,
  unique,
  foreignKey,
} from 'drizzle-orm/pg-core';
import { pkUuid, timestamps } from './helpers.js';
import { registrarProviders } from './registrar.js';

// ──────────────────────────────────────────────
// TLDS
// ──────────────────────────────────────────────

export const tlds = pgTable(
  'tlds',
  {
    id: pkUuid(),
    tld: varchar('tld', { length: 50 }).notNull(),
    isEnabled: boolean('is_enabled').notNull().default(false),
    supportsPrivacy: boolean('supports_privacy').notNull().default(false),
    supportsTransferLock: boolean('supports_transfer_lock').notNull().default(true),
    supportsDnssec: boolean('supports_dnssec').notNull().default(false),
    minRegistrationYears: integer('min_registration_years').notNull().default(1),
    maxRegistrationYears: integer('max_registration_years').notNull().default(10),
    isPremiumSupported: boolean('is_premium_supported').notNull().default(false),
    ...timestamps,
  },
  (table) => [
    unique('uq_tlds_tld').on(table.tld),
  ],
);

// ──────────────────────────────────────────────
// REGISTRAR PROVIDER PRICES
// ──────────────────────────────────────────────

export const registrarProviderPrices = pgTable(
  'registrar_provider_prices',
  {
    id: pkUuid(),
    tldId: uuid('tld_id')
      .notNull()
      .references(() => tlds.id, { onDelete: 'restrict' }),
    registrarProviderId: uuid('registrar_provider_id').notNull(),
    operation: varchar('operation', { length: 20 }).notNull(),
    years: integer('years').notNull().default(1),

    // Provider cost
    providerCostMinor: bigint('provider_cost_minor', { mode: 'bigint' }).notNull(),
    providerCostCurrency: varchar('provider_cost_currency', { length: 3 }).notNull(),

    // Retail price
    retailPriceMinor: bigint('retail_price_minor', { mode: 'bigint' }).notNull(),
    retailPriceCurrency: varchar('retail_price_currency', { length: 3 }).notNull(),

    // Markup
    markupType: varchar('markup_type', { length: 10 }),
    markupValue: integer('markup_value'),

    // Promotions
    isPromotion: boolean('is_promotion').notNull().default(false),
    promotionPriceMinor: bigint('promotion_price_minor', { mode: 'bigint' }),
    promotionStartsAt: timestamp('promotion_starts_at', { withTimezone: true }),
    promotionEndsAt: timestamp('promotion_ends_at', { withTimezone: true }),

    // Sync tracking
    lastSyncedAt: timestamp('last_synced_at', { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    unique('uq_provider_prices_tld_provider_op_years').on(
      table.tldId,
      table.registrarProviderId,
      table.operation,
      table.years,
    ),
    foreignKey({
      name: 'fk_prices_provider',
      columns: [table.registrarProviderId],
      foreignColumns: [registrarProviders.id],
    }).onDelete('restrict'),
  ],
);
