/**
 * PrisNames — Compliance & Legal Schema
 *
 * Tables: audit_logs, admin_actions, abuse_cases, abuse_evidence,
 *         compliance_cases, legal_requests, data_disclosures,
 *         legal_documents, legal_document_versions, user_legal_acceptances
 *
 * Reference: DATABASE.md §3.6, COMPLIANCE.md
 *
 * Design notes:
 * - audit_logs and admin_actions are append-only (no updated_at)
 * - legal_document_versions has UNIQUE(legal_document_id, version)
 * - user_legal_acceptances: FK on delete RESTRICT to preserve legal retention
 * - data_disclosures.data_categories uses TEXT[] (PostgreSQL array)
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
  foreignKey,
} from 'drizzle-orm/pg-core';

import { pkUuid, timestamps, createdTimestamp, statusCheck } from './helpers.js';
import {
  ABUSE_CATEGORY_VALUES,
  ABUSE_STATUS_VALUES,
  COMPLIANCE_STATUS_VALUES,
} from './enums.js';
import { users } from './auth.js';

// Forward reference for domains/orders — use raw uuid
// (Avoid circular imports; relations define cross-module FKs)

// ──────────────────────────────────────────────
// AUDIT LOGS — Append-only
// ──────────────────────────────────────────────

export const auditLogs = pgTable(
  'audit_logs',
  {
    id: pkUuid(),
    actorId: uuid('actor_id').references(() => users.id, { onDelete: 'set null' }),
    actorType: varchar('actor_type', { length: 20 }).notNull(),
    action: varchar('action', { length: 100 }).notNull(),
    resourceType: varchar('resource_type', { length: 50 }).notNull(),
    resourceId: uuid('resource_id'),
    requestId: uuid('request_id'),
    ipAddress: varchar('ip_address', { length: 45 }),
    userAgent: text('user_agent'),
    metadata: jsonb('metadata'),
    beforeState: jsonb('before_state'),
    afterState: jsonb('after_state'),
    ...createdTimestamp,
  },
  (table) => [
    index('idx_audit_logs_actor_id').on(table.actorId),
    index('idx_audit_logs_resource').on(table.resourceType, table.resourceId),
    index('idx_audit_logs_created_at').on(table.createdAt),
  ],
);

// ──────────────────────────────────────────────
// ADMIN ACTIONS — Append-only
// ──────────────────────────────────────────────

export const adminActions = pgTable('admin_actions', {
  id: pkUuid(),
  adminId: uuid('admin_id')
    .notNull()
    .references(() => users.id, { onDelete: 'restrict' }),
  action: varchar('action', { length: 100 }).notNull(),
  targetType: varchar('target_type', { length: 50 }).notNull(),
  targetId: uuid('target_id'),
  reason: text('reason'),
  requestId: uuid('request_id'),
  ...createdTimestamp,
});

// ──────────────────────────────────────────────
// ABUSE CASES
// ──────────────────────────────────────────────

export const abuseCases = pgTable(
  'abuse_cases',
  {
    id: pkUuid(),
    domainId: uuid('domain_id'),
    // FK to domains defined in relations
    reporterEmail: varchar('reporter_email', { length: 255 }),
    category: varchar('category', { length: 30 }).notNull(),
    status: varchar('status', { length: 30 }).notNull().default('OPEN'),
    description: text('description'),
    internalNotes: text('internal_notes'),
    assignedTo: uuid('assigned_to').references(() => users.id, { onDelete: 'set null' }),
    escalatedAt: timestamp('escalated_at', { withTimezone: true }),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    index('idx_abuse_cases_status').on(table.status),
    index('idx_abuse_cases_domain_id').on(table.domainId),
    statusCheck('chk_abuse_cases_status', 'status', ABUSE_STATUS_VALUES),
    statusCheck('chk_abuse_cases_category', 'category', ABUSE_CATEGORY_VALUES),
  ],
);

// ──────────────────────────────────────────────
// ABUSE EVIDENCE
// ──────────────────────────────────────────────

export const abuseEvidence = pgTable('abuse_evidence', {
  id: pkUuid(),
  abuseCaseId: uuid('abuse_case_id')
    .notNull()
    .references(() => abuseCases.id, { onDelete: 'cascade' }),
  evidenceType: varchar('evidence_type', { length: 30 }).notNull(),
  description: text('description'),
  filePath: varchar('file_path', { length: 500 }),
  submittedBy: uuid('submitted_by').references(() => users.id, { onDelete: 'set null' }),
  ...createdTimestamp,
});

// ──────────────────────────────────────────────
// COMPLIANCE CASES
// ──────────────────────────────────────────────

export const complianceCases = pgTable(
  'compliance_cases',
  {
    id: pkUuid(),
    caseType: varchar('case_type', { length: 30 }).notNull(),
    status: varchar('status', { length: 30 }).notNull(),
    description: text('description'),
    domainId: uuid('domain_id'),
    // FK to domains in relations
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    assignedTo: uuid('assigned_to').references(() => users.id, { onDelete: 'set null' }),
    dueDate: timestamp('due_date', { withTimezone: true }),
    ...timestamps,
  },
  (_table) => [
    statusCheck('chk_compliance_cases_status', 'status', COMPLIANCE_STATUS_VALUES),
  ],
);

// ──────────────────────────────────────────────
// LEGAL REQUESTS
// ──────────────────────────────────────────────

export const legalRequests = pgTable('legal_requests', {
  id: pkUuid(),
  requestType: varchar('request_type', { length: 30 }).notNull(),
  requestingAuthority: varchar('requesting_authority', { length: 255 }).notNull(),
  description: text('description'),
  complianceCaseId: uuid('compliance_case_id').references(() => complianceCases.id, {
    onDelete: 'set null',
  }),
  receivedAt: timestamp('received_at', { withTimezone: true }).notNull(),
  responseDeadline: timestamp('response_deadline', { withTimezone: true }),
  respondedAt: timestamp('responded_at', { withTimezone: true }),
  ...createdTimestamp,
});

// ──────────────────────────────────────────────
// DATA DISCLOSURES
// ──────────────────────────────────────────────

export const dataDisclosures = pgTable('data_disclosures', {
  id: pkUuid(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  domainId: uuid('domain_id'),
  // FK to domains in relations
  legalRequestId: uuid('legal_request_id').references(() => legalRequests.id, {
    onDelete: 'set null',
  }),
  disclosedTo: varchar('disclosed_to', { length: 255 }).notNull(),
  dataCategories: text('data_categories')
    .array()
    .notNull(),
  disclosedBy: uuid('disclosed_by')
    .notNull()
    .references(() => users.id, { onDelete: 'restrict' }),
  ...createdTimestamp,
});

// ──────────────────────────────────────────────
// LEGAL DOCUMENTS
// ──────────────────────────────────────────────

export const legalDocuments = pgTable(
  'legal_documents',
  {
    id: pkUuid(),
    slug: varchar('slug', { length: 50 }).notNull(),
    title: varchar('title', { length: 200 }).notNull(),
    isRequired: boolean('is_required').notNull().default(true),
    ...timestamps,
  },
  (table) => [
    unique('uq_legal_documents_slug').on(table.slug),
  ],
);

// ──────────────────────────────────────────────
// LEGAL DOCUMENT VERSIONS
// ──────────────────────────────────────────────

export const legalDocumentVersions = pgTable(
  'legal_document_versions',
  {
    id: pkUuid(),
    legalDocumentId: uuid('legal_document_id').notNull(),
    version: varchar('version', { length: 20 }).notNull(),
    contentHash: varchar('content_hash', { length: 64 }).notNull(),
    contentUrl: varchar('content_url', { length: 500 }).notNull(),
    effectiveAt: timestamp('effective_at', { withTimezone: true }).notNull(),
    isActive: boolean('is_active').notNull().default(false),
    ...createdTimestamp,
  },
  (table) => [
    unique('uq_legal_doc_versions_doc_version').on(table.legalDocumentId, table.version),
    foreignKey({
      name: 'fk_legal_doc_ver_doc',
      columns: [table.legalDocumentId],
      foreignColumns: [legalDocuments.id],
    }).onDelete('restrict'),
  ],
);

// ──────────────────────────────────────────────
// USER LEGAL ACCEPTANCES
// ──────────────────────────────────────────────

export const userLegalAcceptances = pgTable('user_legal_acceptances', {
  id: pkUuid(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'restrict' }),
  legalDocumentVersionId: uuid('legal_document_version_id').notNull(),
  orderId: uuid('order_id'),
  // FK to orders in relations
  domain: varchar('domain', { length: 255 }),
  ipAddress: varchar('ip_address', { length: 45 }),
  acceptedAt: timestamp('accepted_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  foreignKey({
    name: 'fk_legal_accept_ver',
    columns: [table.legalDocumentVersionId],
    foreignColumns: [legalDocumentVersions.id],
  }).onDelete('restrict'),
]);
