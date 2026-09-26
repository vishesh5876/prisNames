/**
 * PrisNames — Money Columns Test
 *
 * Validates that all monetary columns use BIGINT (not int4 or float).
 * Reference: User correction #6 — BIGINT for monetary minor-unit amounts.
 *
 * Drizzle uses { mode: 'bigint' } which maps to PostgreSQL BIGINT
 * and returns values as native BigInt in TypeScript.
 */

import { describe, it, expect } from 'vitest';
import { getTableColumns, getTableName } from 'drizzle-orm';
import * as schema from '../schema/index.js';

/**
 * Columns that represent money must end with _minor or be known money fields.
 */
const MONEY_COLUMN_PATTERNS = [
  /amount_minor$/,
  /subtotal_minor$/,
  /tax_minor$/,
  /discount_minor$/,
  /total_minor$/,
  /provider_cost_minor$/,
  /retail_amount_minor$/,
  /retail_price_minor$/,
  /promotion_price_minor$/,
];

function isMoneyColumn(columnName: string): boolean {
  return MONEY_COLUMN_PATTERNS.some((pattern) => pattern.test(columnName));
}

describe('Money Column Types', () => {
  const tables = [
    schema.orders,
    schema.orderItems,
    schema.quotes,
    schema.payments,
    schema.refunds,
    schema.invoices,
    schema.registrarProviderPrices,
  ];

  for (const table of tables) {
    const tableName = getTableName(table);
    const columns = getTableColumns(table);

    for (const [colName, colDef] of Object.entries(columns)) {
      const col = colDef as Record<string, unknown>;
      const sqlName = (col.name as string) || colName;
      if (isMoneyColumn(sqlName)) {
        it(`${tableName}.${sqlName} uses BIGINT (not integer or float)`, () => {
          // Drizzle bigint columns have dataType = 'bigint'
          expect(col.dataType).toBe('bigint');
          // Verify it's not a regular integer (int4)
          expect(col.columnType).not.toBe('PgInteger');
        });
      }
    }
  }

  it('found at least 10 money columns across the schema', () => {
    let moneyColumnCount = 0;
    for (const table of tables) {
      const columns = getTableColumns(table);
      for (const [_colName, colDef] of Object.entries(columns)) {
        const col = colDef as Record<string, unknown>;
        const sqlName = (col.name as string) || _colName;
        if (isMoneyColumn(sqlName)) {
          moneyColumnCount++;
        }
      }
    }
    expect(moneyColumnCount).toBeGreaterThanOrEqual(10);
  });
});
