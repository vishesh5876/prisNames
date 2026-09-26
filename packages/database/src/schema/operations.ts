/**
 * PrisNames — Operations Schema
 *
 * Tables: email_logs, webhook_events, job_records, feature_flags, system_settings
 *
 * Reference: DATABASE.md §3.7
 *
 * Design decisions:
 * - webhook_events: provider-scoped deduplication UNIQUE(provider, provider_event_id)
 *   NOT global event_id uniqueness (multi-provider-ready)
 * - webhook raw_payload is TEXT (versioned encrypted envelope) with encryption_key_id
 * - Partial index on raw_payload_expires_at WHERE raw_payload IS NOT NULL
 */

import {
  pgTable,
  uuid,
  varchar,
  boolean,
  text,
  timestamp,
  jsonb,
  index,
  unique,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { pkUuid, timestamps, createdTimestamp, statusCheck } from './helpers.js';
import {
  EMAIL_STATUS_VALUES,
  WEBHOOK_STATUS_VALUES,
  JOB_STATUS_VALUES,
} from './enums.js';
import { users } from './auth.js';

// ──────────────────────────────────────────────
// EMAIL LOGS
// ──────────────────────────────────────────────

export const emailLogs = pgTable(
  'email_logs',
  {
    id: pkUuid(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    toEmail: varchar('to_email', { length: 255 }).notNull(),
    template: varchar('template', { length: 50 }).notNull(),
    subject: varchar('subject', { length: 255 }).notNull(),
    status: varchar('status', { length: 20 }).notNull(),
    provider: varchar('provider', { length: 30 }),
    providerMessageId: varchar('provider_message_id', { length: 255 }),
    error: text('error'),
    sentAt: timestamp('sent_at', { withTimezone: true }),
    ...createdTimestamp,
  },
  (_table) => [
    statusCheck('chk_email_logs_status', 'status', EMAIL_STATUS_VALUES),
  ],
);

// ──────────────────────────────────────────────
// WEBHOOK EVENTS
//
// Multi-provider deduplication: UNIQUE(provider, provider_event_id)
// Our internal UUID is separate from the provider's event identifier.
// ──────────────────────────────────────────────

export const webhookEvents = pgTable(
  'webhook_events',
  {
    id: pkUuid(),
    provider: varchar('provider', { length: 20 }).notNull().default('dynadot'),
    providerEventId: varchar('provider_event_id', { length: 100 }).notNull(),
    eventType: varchar('event_type', { length: 50 }).notNull(),
    receivedAt: timestamp('received_at', { withTimezone: true }).notNull().defaultNow(),
    queuedAt: timestamp('queued_at', { withTimezone: true }),
    processedAt: timestamp('processed_at', { withTimezone: true }),
    processingStatus: varchar('processing_status', { length: 20 }).notNull().default('RECEIVED'),
    processingAttempts: varchar('processing_attempts', { length: 10 }).notNull().default('0'),
    processingError: text('processing_error'),

    // Encrypted raw payload — TEXT containing versioned encrypted envelope
    // Format: "v1:{key_id}:{nonce_b64}:{ciphertext_b64}" (defined in SECURITY.md)
    rawPayload: text('raw_payload').notNull(),
    encryptionKeyId: varchar('encryption_key_id', { length: 50 }),
    rawPayloadExpiresAt: timestamp('raw_payload_expires_at', { withTimezone: true }).notNull(),

    signatureValid: boolean('signature_valid').notNull(),
    ...createdTimestamp,
  },
  (table) => [
    // Provider-scoped dedup — NOT global event_id uniqueness
    unique('uq_webhook_events_provider_event').on(table.provider, table.providerEventId),

    // Partial index for retention cleanup
    index('idx_webhook_events_expiry')
      .on(table.rawPayloadExpiresAt)
      .where(sql`raw_payload IS NOT NULL`),

    index('idx_webhook_events_processing_status').on(table.processingStatus),
    statusCheck('chk_webhook_events_status', 'processing_status', WEBHOOK_STATUS_VALUES),
  ],
);

// ──────────────────────────────────────────────
// JOB RECORDS
// ──────────────────────────────────────────────

export const jobRecords = pgTable(
  'job_records',
  {
    id: pkUuid(),
    queueName: varchar('queue_name', { length: 50 }).notNull(),
    jobId: varchar('job_id', { length: 100 }).notNull(),
    status: varchar('status', { length: 20 }).notNull(),
    payloadSummary: jsonb('payload_summary'),
    error: text('error'),
    startedAt: timestamp('started_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    ...createdTimestamp,
  },
  (_table) => [
    statusCheck('chk_job_records_status', 'status', JOB_STATUS_VALUES),
  ],
);

// ──────────────────────────────────────────────
// FEATURE FLAGS
// ──────────────────────────────────────────────

export const featureFlags = pgTable(
  'feature_flags',
  {
    id: pkUuid(),
    key: varchar('key', { length: 50 }).notNull(),
    value: boolean('value').notNull().default(false),
    description: text('description'),
    updatedBy: uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
    ...timestamps,
  },
  (table) => [
    unique('uq_feature_flags_key').on(table.key),
  ],
);

// ──────────────────────────────────────────────
// SYSTEM SETTINGS
// ──────────────────────────────────────────────

export const systemSettings = pgTable(
  'system_settings',
  {
    id: pkUuid(),
    key: varchar('key', { length: 100 }).notNull(),
    value: text('value').notNull(),
    valueType: varchar('value_type', { length: 20 }).notNull(),
    description: text('description'),
    updatedBy: uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
    ...timestamps,
  },
  (table) => [
    unique('uq_system_settings_key').on(table.key),
  ],
);
