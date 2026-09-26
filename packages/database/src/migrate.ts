/**
 * PrisNames — Migration Runner
 *
 * Custom migration runner that works with the 'public' schema
 * without requiring CREATE SCHEMA privileges.
 *
 * Drizzle ORM's built-in migrate() always runs CREATE SCHEMA IF NOT EXISTS,
 * which fails when the DB user lacks CREATE privilege on the database.
 * This runner manually handles migration state in public.__drizzle_migrations.
 */

import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { config } from 'dotenv';
import { createDb } from './client.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env from monorepo root
config({ path: resolve(__dirname, '../../../.env') });

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('❌ DATABASE_URL is not set');
  process.exit(1);
}

const MIGRATIONS_DIR = resolve(__dirname, '../drizzle');
const MIGRATIONS_TABLE = '__drizzle_migrations';

/**
 * SQL-aware statement splitter.
 * Splits on top-level semicolons while respecting:
 * - Parenthesized expressions (nested parens)
 * - Single-quoted string literals (with '' escaping)
 * - SQL comments (-- line comments, /* block comments *\/)
 */
function splitSqlStatements(sql: string): string[] {
  const statements: string[] = [];
  let current = '';
  let depth = 0; // paren nesting
  let inString = false;
  let inLineComment = false;
  let inBlockComment = false;

  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];
    const next = sql[i + 1];

    if (inLineComment) {
      current += ch;
      if (ch === '\n') inLineComment = false;
      continue;
    }

    if (inBlockComment) {
      current += ch;
      if (ch === '*' && next === '/') {
        current += next;
        i++;
        inBlockComment = false;
      }
      continue;
    }

    if (inString) {
      current += ch;
      if (ch === "'" && next === "'") {
        current += next; // escaped quote
        i++;
      } else if (ch === "'") {
        inString = false;
      }
      continue;
    }

    // Not in any special context
    if (ch === '-' && next === '-') {
      inLineComment = true;
      current += ch;
      continue;
    }
    if (ch === '/' && next === '*') {
      inBlockComment = true;
      current += ch + next;
      i++;
      continue;
    }
    if (ch === "'") {
      inString = true;
      current += ch;
      continue;
    }
    if (ch === '(') { depth++; current += ch; continue; }
    if (ch === ')') { depth--; current += ch; continue; }

    if (ch === ';' && depth === 0) {
      const trimmed = current.trim();
      if (trimmed.length > 0) {
        // Skip pure comment-only blocks
        const stripped = trimmed.replace(/--[^\n]*\n?/g, '').trim();
        if (stripped.length > 0) {
          statements.push(trimmed);
        }
      }
      current = '';
      continue;
    }

    current += ch;
  }

  // Remaining content
  const trimmed = current.trim();
  if (trimmed.length > 0) {
    const stripped = trimmed.replace(/--[^\n]*\n?/g, '').trim();
    if (stripped.length > 0) {
      statements.push(trimmed);
    }
  }

  return statements;
}

async function main() {
  console.log('🔄 Running migrations...');

  const { sql } = createDb(connectionString!);

  try {
    // Create migration tracking table if it doesn't exist
    await sql.unsafe(`
      CREATE TABLE IF NOT EXISTS "${MIGRATIONS_TABLE}" (
        id SERIAL PRIMARY KEY,
        hash TEXT NOT NULL,
        created_at BIGINT NOT NULL
      )
    `);

    // Get already-applied migration hashes
    const applied = await sql.unsafe<{ hash: string }[]>(
      `SELECT hash FROM "${MIGRATIONS_TABLE}" ORDER BY id`
    );
    const appliedHashes = new Set(applied.map((r) => r.hash));

    // Read migration journal
    const journalPath = resolve(MIGRATIONS_DIR, 'meta/_journal.json');
    const journal = JSON.parse(readFileSync(journalPath, 'utf-8')) as {
      entries: Array<{ idx: number; when: number; tag: string; breakpoints: boolean }>;
    };

    let migrationsApplied = 0;

    for (const entry of journal.entries) {
      // Drizzle uses the tag as the hash
      if (appliedHashes.has(entry.tag)) {
        console.log(`  ⏭️  Already applied: ${entry.tag}`);
        continue;
      }

      const sqlFile = resolve(MIGRATIONS_DIR, `${entry.tag}.sql`);
      const migrationSql = readFileSync(sqlFile, 'utf-8');

      console.log(`  ▶️  Applying: ${entry.tag}`);

      // Strip explicit BEGIN/COMMIT (runner provides its own transaction)
      const cleanedSql = migrationSql
        .replace(/^\s*BEGIN\s*;\s*$/gm, '')
        .replace(/^\s*COMMIT\s*;\s*$/gm, '')
        .trim();

      // If migration uses Drizzle statement-breakpoint markers, split on those.
      // Otherwise, use a proper SQL-aware semicolon splitter that respects
      // parenthesized expressions, string literals, and multi-line statements.
      let executableStatements: string[];

      if (/-->\s*statement-breakpoint/.test(cleanedSql)) {
        executableStatements = cleanedSql
          .split(/-->\s*statement-breakpoint/)
          .map((s) => s.trim())
          .filter((s) => s.length > 0 && !s.startsWith('--'));
      } else {
        // SQL-aware split: split on semicolons that are NOT inside parentheses or string literals
        executableStatements = splitSqlStatements(cleanedSql);
      }

      await sql.begin(async (tx) => {
        for (const stmt of executableStatements) {
          await tx.unsafe(stmt);
        }
        // Record the migration
        await tx.unsafe(
          `INSERT INTO "${MIGRATIONS_TABLE}" (hash, created_at) VALUES ($1, $2)`,
          [entry.tag, Date.now()],
        );
      });

      migrationsApplied++;
      console.log(`  ✅  Applied: ${entry.tag}`);
    }

    if (migrationsApplied === 0) {
      console.log('✅ No pending migrations');
    } else {
      console.log(`✅ Applied ${migrationsApplied} migration(s)`);
    }
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

main();
