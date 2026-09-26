/**
 * PrisNames — Migration Chain Verification Test
 *
 * Verifies that all 3 migrations (0000→0001→0002) have been applied
 * and the database schema contains the expected tables, constraints,
 * columns, and indexes.
 *
 * Usage:
 *   DATABASE_URL=... pnpm --filter @prisnames/database test:migrations
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import postgres from 'postgres';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = resolve(__dirname, '../../drizzle');

const baseUrl = process.env.DATABASE_URL;
const SKIP = !baseUrl;

describe.skipIf(SKIP)('Migration chain verification', () => {
  let sql: ReturnType<typeof postgres>;

  beforeAll(async () => {
    if (!baseUrl) return;
    sql = postgres(baseUrl, { max: 1 });
  }, 10_000);

  afterAll(async () => {
    if (sql) await sql.end();
  });

  // ── Journal integrity ──

  it('migration journal has all 3 entries in correct order', () => {
    const journalPath = resolve(MIGRATIONS_DIR, 'meta/_journal.json');
    const journal = JSON.parse(readFileSync(journalPath, 'utf-8'));

    expect(journal.entries.length).toBe(3);
    expect(journal.entries[0].tag).toBe('0000_0000_phase2_baseline');
    expect(journal.entries[1].tag).toBe('0001_0001_add_session_token_hash');
    expect(journal.entries[2].tag).toBe('0002_0002_webhook_processing_states');
  });

  it('all migration SQL files exist and are non-empty', () => {
    const journalPath = resolve(MIGRATIONS_DIR, 'meta/_journal.json');
    const journal = JSON.parse(readFileSync(journalPath, 'utf-8'));

    for (const entry of journal.entries) {
      const sqlFile = resolve(MIGRATIONS_DIR, `${entry.tag}.sql`);
      const content = readFileSync(sqlFile, 'utf-8');
      expect(content.length).toBeGreaterThan(50);
    }
  });

  // ── Table existence (migration 0000) ──

  it('has all core tables from baseline migration (0000)', async () => {
    const tables = await sql<{ tablename: string }[]>`
      SELECT tablename FROM pg_tables
      WHERE schemaname = 'public'
      AND tablename != '__drizzle_migrations'
      ORDER BY tablename
    `;

    const tableNames = tables.map(t => t.tablename);

    // Core tables from baseline
    expect(tableNames).toContain('users');
    expect(tableNames).toContain('sessions');
    expect(tableNames).toContain('domains');
    expect(tableNames).toContain('webhook_events');
    expect(tableNames).toContain('user_roles');
    expect(tableNames).toContain('audit_logs');
    expect(tableNames).toContain('registrar_operations');
    expect(tableNames).toContain('orders');
    expect(tableNames).toContain('tlds');
  });

  // ── Email uniqueness (migration 0000) ──

  it('users has canonical email uniqueness index', async () => {
    const indexes = await sql<{ indexname: string; indexdef: string }[]>`
      SELECT indexname, indexdef FROM pg_indexes
      WHERE tablename = 'users'
      AND schemaname = 'public'
    `;

    // The index is named idx_users_email_canonical and uses UNIQUE
    const hasCanonicalUnique = indexes.some(i =>
      i.indexdef.includes('email_canonical') && i.indexdef.includes('UNIQUE')
    );
    expect(hasCanonicalUnique).toBe(true);
  });

  // ── Account status CHECK (migration 0000) ──

  it('users has account_status CHECK constraint', async () => {
    const constraints = await sql<{ conname: string; consrc: string }[]>`
      SELECT c.conname, pg_get_constraintdef(c.oid) as consrc
      FROM pg_constraint c
      WHERE conrelid = 'users'::regclass
      AND c.contype = 'c'
    `;

    const statusCheck = constraints.find(c => c.conname === 'chk_users_account_status');
    expect(statusCheck).toBeDefined();
    expect(statusCheck!.consrc).toContain('ACTIVE');
    expect(statusCheck!.consrc).toContain('DISABLED');
    expect(statusCheck!.consrc).toContain('SUSPENDED');
  });

  // ── Session token_hash (migration 0001) ──

  it('sessions has token_hash column from migration 0001', async () => {
    const columns = await sql<{ column_name: string }[]>`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'sessions'
      AND table_schema = 'public'
    `;

    expect(columns.map(c => c.column_name)).toContain('token_hash');
  });

  // ── Webhook processing states (migration 0002) ──

  it('webhook_events has updated processing_status constraint (0002)', async () => {
    const constraints = await sql<{ conname: string; consrc: string }[]>`
      SELECT c.conname, pg_get_constraintdef(c.oid) as consrc
      FROM pg_constraint c
      WHERE conrelid = 'webhook_events'::regclass
      AND c.contype = 'c'
    `;

    const statusConstraint = constraints.find(c => c.conname === 'chk_webhook_events_status');
    expect(statusConstraint).toBeDefined();
    // New values from 0002
    expect(statusConstraint!.consrc).toContain('RECEIVED');
    expect(statusConstraint!.consrc).toContain('QUEUED');
    expect(statusConstraint!.consrc).toContain('PROCESSING');
    expect(statusConstraint!.consrc).toContain('PROCESSED');
    expect(statusConstraint!.consrc).toContain('FAILED');
    // Old values should NOT be present
    expect(statusConstraint!.consrc).not.toContain("'PENDING'");
    expect(statusConstraint!.consrc).not.toContain("'COMPLETED'");
  });

  it('webhook_events has queued_at and processing_attempts (0002)', async () => {
    const columns = await sql<{ column_name: string }[]>`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'webhook_events'
      AND table_schema = 'public'
      ORDER BY ordinal_position
    `;

    const columnNames = columns.map(c => c.column_name);
    expect(columnNames).toContain('queued_at');
    expect(columnNames).toContain('processing_attempts');
    expect(columnNames).toContain('processing_status');
    expect(columnNames).toContain('received_at');
    expect(columnNames).toContain('provider');
    expect(columnNames).toContain('provider_event_id');
  });

  // ── Provider-scoped webhook uniqueness ──

  it('webhook_events has provider-scoped uniqueness index', async () => {
    const indexes = await sql<{ indexname: string; indexdef: string }[]>`
      SELECT indexname, indexdef FROM pg_indexes
      WHERE tablename = 'webhook_events'
      AND schemaname = 'public'
    `;

    const indexDefs = indexes.map(i => i.indexdef.toLowerCase()).join(' ');
    const hasProviderIndex = indexDefs.includes('provider') &&
      (indexDefs.includes('provider_event_id') || indexDefs.includes('event_id'));
    expect(hasProviderIndex).toBe(true);
  });

  // ── Migration tracking ──

  it('migration tracking table records all 3 applied migrations', async () => {
    const applied = await sql<{ hash: string }[]>`
      SELECT hash FROM "__drizzle_migrations" ORDER BY id
    `;
    expect(applied.length).toBeGreaterThanOrEqual(3);

    const hashes = applied.map(a => a.hash);
    expect(hashes).toContain('0000_0000_phase2_baseline');
    expect(hashes).toContain('0001_0001_add_session_token_hash');
    expect(hashes).toContain('0002_0002_webhook_processing_states');
  });
});
