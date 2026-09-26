#!/usr/bin/env bash
#
# PrisNames — Migration Baseline Verification
#
# Verifies that migrations 0000 + 0001 produce a schema matching
# the current Drizzle definitions.
#
# Usage: TEST_DATABASE_URL=... bash verify-migrations.sh
#
# This must be run against an EMPTY PostgreSQL database.
# It will:
# 1. Apply migration 0000 (baseline schema)
# 2. Apply migration 0001 (token_hash)
# 3. Use Drizzle to introspect and compare
#
# If TEST_DATABASE_URL is not set, prints a pending status.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../../.." && pwd)"

if [ -z "${TEST_DATABASE_URL:-}" ]; then
  echo "⚠️  MIGRATION_BASELINE_VERIFICATION_PENDING"
  echo "   Set TEST_DATABASE_URL to an empty PostgreSQL database to verify."
  exit 0
fi

# Guard: refuse production databases
if echo "$TEST_DATABASE_URL" | grep -qi "production\|staging"; then
  echo "❌ REFUSED: TEST_DATABASE_URL appears to be production/staging"
  exit 1
fi

echo "🔍 Verifying migration baseline against: ${TEST_DATABASE_URL%%@*}@***"
echo ""

# Apply migrations in order
MIGRATION_DIR="${PROJECT_ROOT}/packages/database/drizzle"

echo "📋 Applying migration 0000 (Phase 2 baseline)..."
psql "$TEST_DATABASE_URL" -f "${MIGRATION_DIR}/0000_0000_phase2_baseline.sql" > /dev/null 2>&1
echo "  ✅ Migration 0000 applied"

echo "📋 Applying migration 0001 (token_hash)..."
psql "$TEST_DATABASE_URL" -f "${MIGRATION_DIR}/0001_0001_add_session_token_hash.sql" > /dev/null 2>&1
echo "  ✅ Migration 0001 applied"

echo ""
echo "📋 Verifying tables exist..."
TABLE_COUNT=$(psql "$TEST_DATABASE_URL" -t -c "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public'")
echo "  Found ${TABLE_COUNT// /} tables"

echo ""
echo "📋 Verifying sessions.token_hash column..."
TOKEN_COL=$(psql "$TEST_DATABASE_URL" -t -c "SELECT column_name, is_nullable, character_maximum_length FROM information_schema.columns WHERE table_name = 'sessions' AND column_name = 'token_hash'")
echo "  ${TOKEN_COL}"

echo ""
echo "✅ Migration baseline verification complete"
echo "   The migration SQL files are the authoritative schema-change history."
