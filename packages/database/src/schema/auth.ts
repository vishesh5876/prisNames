/**
 * PrisNames — Auth & Users Schema
 *
 * Tables: users, user_profiles, auth_identities, password_credentials,
 *         email_verifications, password_resets, sessions, roles, user_roles
 *
 * Reference: DATABASE.md §3.1, AUTH.md
 *
 * Canonical email strategy:
 * - email_canonical stores the lowercased email for uniqueness enforcement
 * - email stores the original casing for display purposes
 * - UNIQUE constraint is on email_canonical only
 */

import {
  pgTable,
  uuid,
  varchar,
  boolean,
  text,
  timestamp,
  integer,
  uniqueIndex,
  index,
  unique,
} from 'drizzle-orm/pg-core';
import { pkUuid, timestamps, createdTimestamp, softDelete, statusCheck } from './helpers.js';
import { ACCOUNT_STATUS_VALUES } from './enums.js';

// ──────────────────────────────────────────────
// USERS
// ──────────────────────────────────────────────

export const users = pgTable(
  'users',
  {
    id: pkUuid(),
    email: varchar('email', { length: 255 }).notNull(),
    emailCanonical: varchar('email_canonical', { length: 255 }).notNull(),
    emailVerified: boolean('email_verified').notNull().default(false),
    displayName: varchar('display_name', { length: 100 }),
    accountStatus: varchar('account_status', { length: 20 }).notNull().default('ACTIVE'),
    disabledAt: timestamp('disabled_at', { withTimezone: true }),
    disabledReason: text('disabled_reason'),
    ...timestamps,
    ...softDelete,
  },
  (table) => [
    uniqueIndex('idx_users_email_canonical').on(table.emailCanonical),
    statusCheck('chk_users_account_status', 'account_status', ACCOUNT_STATUS_VALUES),
  ],
);

// ──────────────────────────────────────────────
// USER PROFILES
// ──────────────────────────────────────────────

export const userProfiles = pgTable(
  'user_profiles',
  {
    id: pkUuid(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    firstName: varchar('first_name', { length: 100 }),
    lastName: varchar('last_name', { length: 100 }),
    company: varchar('company', { length: 200 }),
    phone: varchar('phone', { length: 30 }),
    country: varchar('country', { length: 2 }),
    timezone: varchar('timezone', { length: 50 }),
    ...timestamps,
  },
  (table) => [
    unique('uq_user_profiles_user_id').on(table.userId),
  ],
);

// ──────────────────────────────────────────────
// AUTH IDENTITIES
// ──────────────────────────────────────────────

export const authIdentities = pgTable(
  'auth_identities',
  {
    id: pkUuid(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    provider: varchar('provider', { length: 20 }).notNull(),
    providerId: varchar('provider_id', { length: 255 }).notNull(),
    ...createdTimestamp,
  },
  (table) => [
    unique('uq_auth_identities_provider_id').on(table.provider, table.providerId),
  ],
);

// ──────────────────────────────────────────────
// PASSWORD CREDENTIALS
// ──────────────────────────────────────────────

export const passwordCredentials = pgTable(
  'password_credentials',
  {
    id: pkUuid(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    passwordHash: varchar('password_hash', { length: 255 }).notNull(),
    changedAt: timestamp('changed_at', { withTimezone: true }).notNull().defaultNow(),
    ...createdTimestamp,
  },
  (table) => [
    unique('uq_password_credentials_user_id').on(table.userId),
  ],
);

// ──────────────────────────────────────────────
// EMAIL VERIFICATIONS
// ──────────────────────────────────────────────

export const emailVerifications = pgTable('email_verifications', {
  id: pkUuid(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  otpHash: varchar('otp_hash', { length: 255 }).notNull(),
  method: varchar('method', { length: 10 }).notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  attempts: integer('attempts').notNull().default(0),
  verifiedAt: timestamp('verified_at', { withTimezone: true }),
  invalidated: boolean('invalidated').notNull().default(false),
  ...createdTimestamp,
});

// ──────────────────────────────────────────────
// PASSWORD RESETS
// ──────────────────────────────────────────────

export const passwordResets = pgTable('password_resets', {
  id: pkUuid(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: varchar('token_hash', { length: 255 }).notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  usedAt: timestamp('used_at', { withTimezone: true }),
  ...createdTimestamp,
});

// ──────────────────────────────────────────────
// SESSIONS
// ──────────────────────────────────────────────

export const sessions = pgTable(
  'sessions',
  {
    id: pkUuid(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: varchar('token_hash', { length: 64 }).notNull(),
    ipAddress: varchar('ip_address', { length: 45 }),
    userAgent: text('user_agent'),
    lastActiveAt: timestamp('last_active_at', { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    ...createdTimestamp,
  },
  (table) => [
    uniqueIndex('uq_sessions_token_hash').on(table.tokenHash),
    index('idx_sessions_user_id').on(table.userId),
  ],
);

// ──────────────────────────────────────────────
// ROLES
// ──────────────────────────────────────────────

export const roles = pgTable(
  'roles',
  {
    id: pkUuid(),
    name: varchar('name', { length: 30 }).notNull(),
    description: text('description'),
    ...createdTimestamp,
  },
  (table) => [
    unique('uq_roles_name').on(table.name),
  ],
);

// ──────────────────────────────────────────────
// USER ROLES
// ──────────────────────────────────────────────

export const userRoles = pgTable(
  'user_roles',
  {
    id: pkUuid(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    roleId: uuid('role_id')
      .notNull()
      .references(() => roles.id, { onDelete: 'restrict' }),
    assignedBy: uuid('assigned_by').references(() => users.id, { onDelete: 'set null' }),
    ...createdTimestamp,
  },
  (table) => [
    unique('uq_user_roles_user_role').on(table.userId, table.roleId),
  ],
);
