/**
 * PrisNames — Database Client
 *
 * Creates and manages the Drizzle ORM + postgres.js connection.
 * postgres.js handles connection pooling natively — no separate pool manager needed.
 *
 * BigInt handling:
 * - postgres.js returns BIGINT as string by default
 * - Drizzle with mode: 'bigint' uses native BigInt
 * - Application code must use BigInt arithmetic, never Number coercion for money
 */

import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema/index.js';
import * as relations from './relations/index.js';

export type Database = PostgresJsDatabase<typeof schema & typeof relations>;

let _db: Database | null = null;
let _sql: ReturnType<typeof postgres> | null = null;

/**
 * Create a new database connection.
 * Does NOT use the singleton — useful for migrations, seeds, scripts.
 */
export function createDb(connectionString: string): {
  db: Database;
  sql: ReturnType<typeof postgres>;
} {
  const sqlClient = postgres(connectionString, {
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
  });

  const db = drizzle(sqlClient, { schema: { ...schema, ...relations } });

  return { db, sql: sqlClient };
}

/**
 * Get or create the singleton database instance.
 * Connection string must be provided on first call.
 */
export function getDb(connectionString?: string): Database {
  if (_db) return _db;

  if (!connectionString) {
    throw new Error(
      'Database not initialized. Provide a connection string on first call to getDb().',
    );
  }

  const { db, sql: sqlClient } = createDb(connectionString);
  _db = db;
  _sql = sqlClient;
  return _db;
}

/**
 * Close the singleton database connection.
 */
export async function closeDb(): Promise<void> {
  if (_sql) {
    await _sql.end();
    _sql = null;
    _db = null;
  }
}
