-- Phase 5 Migration: Webhook processing states for durable ingestion
-- 
-- Changes:
-- 1. Update webhook_events processing_status check constraint
--    Old values: PENDING, PROCESSING, COMPLETED, FAILED
--    New values: RECEIVED, QUEUED, PROCESSING, PROCESSED, FAILED
-- 2. Add queued_at timestamp column
-- 3. Add processing_attempts column
-- 4. Change processing_status default from 'PENDING' to 'RECEIVED'
-- 5. Migrate existing PENDING rows to RECEIVED, COMPLETED to PROCESSED

BEGIN;

-- Step 1: Drop existing check constraint
ALTER TABLE "webhook_events"
  DROP CONSTRAINT IF EXISTS "chk_webhook_events_status";

-- Step 2: Migrate existing data
UPDATE "webhook_events"
  SET "processing_status" = 'RECEIVED'
  WHERE "processing_status" = 'PENDING';

UPDATE "webhook_events"
  SET "processing_status" = 'PROCESSED'
  WHERE "processing_status" = 'COMPLETED';

-- Step 3: Add new columns
ALTER TABLE "webhook_events"
  ADD COLUMN IF NOT EXISTS "queued_at" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "processing_attempts" VARCHAR(10) NOT NULL DEFAULT '0';

-- Step 4: Change default for processing_status
ALTER TABLE "webhook_events"
  ALTER COLUMN "processing_status" SET DEFAULT 'RECEIVED';

-- Step 5: Add new check constraint with updated values
ALTER TABLE "webhook_events"
  ADD CONSTRAINT "chk_webhook_events_status"
    CHECK ("processing_status" IN ('RECEIVED', 'QUEUED', 'PROCESSING', 'PROCESSED', 'FAILED'));

COMMIT;
