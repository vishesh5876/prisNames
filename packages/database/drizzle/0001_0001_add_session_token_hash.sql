-- Phase 3: Add session token_hash column
-- Safe migration strategy for existing sessions:
-- 1. Add token_hash as nullable
-- 2. Delete/revoke legacy sessions that lack opaque token credentials
-- 3. Create UNIQUE index
-- 4. Enforce NOT NULL
-- Existing sessions are force-invalidated (users must re-login after migration)

-- Step 1: Add nullable token_hash column
ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "token_hash" varchar(64);

-- Step 2: Delete legacy sessions that cannot possess the new opaque credential
-- These sessions were created before the token_hash architecture was implemented.
-- Users will be required to log in again.
DELETE FROM "sessions" WHERE "token_hash" IS NULL;

-- Step 3: Create UNIQUE index (only after orphan rows are removed)
CREATE UNIQUE INDEX IF NOT EXISTS "uq_sessions_token_hash" ON "sessions" USING btree ("token_hash");

-- Step 4: Enforce NOT NULL constraint
ALTER TABLE "sessions" ALTER COLUMN "token_hash" SET NOT NULL;