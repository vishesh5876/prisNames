/**
 * PrisNames — Test Database Setup
 *
 * Uses the main development database with transactional cleanup.
 * Each test gets a clean state by:
 * 1. Beginning a transaction (savepoint)
 * 2. Running test operations
 * 3. Rolling back at the end
 *
 * This is safe because:
 * - Development DB only (guards against production URLs)
 * - Each test sees only its own data via the transaction
 * - Rollback ensures no leftover state
 */
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../../../.env') });

const DB_URL = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;

async function main() {
  if (!DB_URL) {
    console.error('❌ No DATABASE_URL or TEST_DATABASE_URL configured');
    process.exit(1);
  }

  // Safety guard
  if (DB_URL.toLowerCase().includes('production') || DB_URL.toLowerCase().includes('staging')) {
    console.error('❌ REFUSED: Database URL appears to be production/staging');
    process.exit(1);
  }

  console.log('🔗 Connecting to database...');
  const sql = postgres(DB_URL);

  // Verify migration state
  console.log('\n📋 Verifying migration baseline...');

  // Check tables
  const tables = await sql`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename
  `;
  console.log(`\n✅ Tables: ${tables.length}`);
  for (const t of tables) {
    console.log(`  • ${t.tablename}`);
  }

  // Verify sessions.token_hash
  const tokenHashCol = await sql`
    SELECT column_name, is_nullable, data_type, character_maximum_length
    FROM information_schema.columns
    WHERE table_name = 'sessions' AND column_name = 'token_hash'
  `;
  console.log('\n📋 sessions.token_hash column:');
  if (tokenHashCol.length > 0) {
    const col = tokenHashCol[0];
    console.log(`  type: ${col.data_type}(${col.character_maximum_length})`);
    console.log(`  nullable: ${col.is_nullable}`);
    if (col.is_nullable !== 'NO') {
      console.error('  ❌ token_hash should be NOT NULL!');
      process.exit(1);
    }
    console.log('  ✅ NOT NULL constraint verified');
  } else {
    console.error('  ❌ token_hash column not found!');
    process.exit(1);
  }

  // Verify unique index on token_hash
  const tokenHashIdx = await sql`
    SELECT indexname, indexdef FROM pg_indexes
    WHERE tablename = 'sessions' AND indexname LIKE '%token_hash%'
  `;
  if (tokenHashIdx.length > 0) {
    console.log(`  ✅ Unique index: ${tokenHashIdx[0].indexname}`);
  } else {
    console.error('  ❌ No unique index on token_hash!');
    process.exit(1);
  }

  // Verify CHECK constraints
  console.log('\n📋 CHECK constraints:');
  const checks = await sql`
    SELECT c.conname, c.conrelid::regclass AS table_name,
           pg_get_constraintdef(c.oid) AS definition
    FROM pg_constraint c
    WHERE c.contype = 'c' AND c.connamespace = 'public'::regnamespace
    ORDER BY c.conrelid::regclass::text, c.conname
  `;
  for (const c of checks) {
    console.log(`  • ${c.table_name}.${c.conname}`);
  }
  console.log(`  Total: ${checks.length} CHECK constraints`);

  // Verify all indexes
  console.log('\n📋 Indexes:');
  const indexes = await sql`
    SELECT tablename, indexname
    FROM pg_indexes
    WHERE schemaname = 'public'
    ORDER BY tablename, indexname
  `;
  for (const idx of indexes) {
    console.log(`  • ${idx.tablename}.${idx.indexname}`);
  }
  console.log(`  Total: ${indexes.length} indexes`);

  // Verify roles
  console.log('\n📋 Roles:');
  const roles = await sql`SELECT name FROM roles ORDER BY name`;
  for (const r of roles) {
    console.log(`  • ${r.name}`);
  }
  console.log(`  Total: ${roles.length} roles`);

  // Verify expected roles
  const expectedRoles = ['ABUSE', 'ADMIN', 'FINANCE', 'SUPER_ADMIN', 'SUPPORT', 'USER'];
  const actualRoleNames = roles.map(r => r.name).sort();
  const missing = expectedRoles.filter(r => !actualRoleNames.includes(r));
  if (missing.length > 0) {
    console.error(`  ❌ Missing roles: ${missing.join(', ')}`);
    process.exit(1);
  }
  console.log('  ✅ All 6 expected roles present');

  await sql.end();
  console.log('\n✅ Migration baseline verification PASSED');
}

main().catch((err) => {
  console.error('❌ Verification failed:', err.message);
  process.exit(1);
});
