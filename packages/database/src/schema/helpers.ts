/**
 * PrisNames — Schema Helpers
 *
 * Reusable column builders for consistent schema definitions.
 * - UUID v4 primary keys
 * - Timestamps (created_at, updated_at, deleted_at)
 * - Money columns (BIGINT minor units + VARCHAR(3) currency)
 * - CHECK constraint helper
 */

import { uuid, timestamp, varchar, bigint, check } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// ──────────────────────────────────────────────
// Primary Key
// ──────────────────────────────────────────────

/**
 * UUID v4 primary key with default gen_random_uuid().
 */
export const pkUuid = (name = 'id') =>
  uuid(name).primaryKey().defaultRandom();

// ──────────────────────────────────────────────
// Timestamps
// ──────────────────────────────────────────────

/**
 * Standard created_at / updated_at columns.
 * Both default to now() and use TIMESTAMPTZ.
 */
export const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

/**
 * created_at only (for immutable entities like audit_logs, events).
 */
export const createdTimestamp = {
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
};

/**
 * Soft-delete column.
 */
export const softDelete = {
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
};

// ──────────────────────────────────────────────
// Money Columns
// ──────────────────────────────────────────────

/**
 * A money amount column pair: BIGINT minor units + VARCHAR(3) currency.
 *
 * PostgreSQL BIGINT safely holds amounts up to ~9.2 quintillion minor units.
 * Drizzle returns bigint as string from postgres.js — safe for large values.
 *
 * @param amountName - Column name for the amount (e.g. 'amount_minor')
 * @param currencyName - Column name for the currency (e.g. 'currency')
 */
export function moneyColumns(amountName: string, currencyName: string) {
  return {
    [amountName]: bigint(amountName, { mode: 'bigint' }).notNull(),
    [currencyName]: varchar(currencyName, { length: 3 }).notNull(),
  } as const;
}

/**
 * A nullable money amount column (e.g. promotional price).
 */
export function moneyColumnsNullable(amountName: string, currencyName?: string) {
  const cols: Record<string, ReturnType<typeof bigint> | ReturnType<typeof varchar>> = {
    [amountName]: bigint(amountName, { mode: 'bigint' }),
  };
  if (currencyName) {
    cols[currencyName] = varchar(currencyName, { length: 3 });
  }
  return cols;
}

// ──────────────────────────────────────────────
// CHECK Constraint Helper
// ──────────────────────────────────────────────

/**
 * Generate a SQL CHECK constraint for a VARCHAR status column.
 *
 * @param columnName - The SQL column name
 * @param values - Allowed values tuple
 * @returns A Drizzle check() constraint
 */
export function statusCheck(
  constraintName: string,
  columnName: string,
  values: readonly string[],
) {
  const valueList = values.map((v) => `'${v}'`).join(', ');
  return check(constraintName, sql.raw(`${columnName} IN (${valueList})`));
}
