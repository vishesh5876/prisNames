-- Migration: 0003_phase6_orchestration
-- Phase 6: Provider-Neutral Registration Fulfillment Orchestration
--
-- Prerequisites: 0000, 0001, 0002

BEGIN;

-- ──────────────────────────────────────────────────────
-- 1. registrar_operations — Attempt tracking
-- ──────────────────────────────────────────────────────

ALTER TABLE registrar_operations
  ADD COLUMN attempt_status VARCHAR(20) NOT NULL DEFAULT 'NOT_ATTEMPTED';

ALTER TABLE registrar_operations
  ADD CONSTRAINT chk_reg_ops_attempt_status
  CHECK (attempt_status IN ('NOT_ATTEMPTED', 'ATTEMPT_STARTED', 'OUTCOME_RECEIVED', 'OUTCOME_UNKNOWN'));

-- ──────────────────────────────────────────────────────
-- 2. registrar_operations — Fenced claims
-- ──────────────────────────────────────────────────────

ALTER TABLE registrar_operations
  ADD COLUMN claim_token UUID,
  ADD COLUMN claim_version INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN claimed_by VARCHAR(100),
  ADD COLUMN claimed_at TIMESTAMPTZ;

-- ──────────────────────────────────────────────────────
-- 3. registrar_operations — Retry scheduling
-- ──────────────────────────────────────────────────────

ALTER TABLE registrar_operations
  ADD COLUMN next_retry_at TIMESTAMPTZ;

-- ──────────────────────────────────────────────────────
-- 4. registrar_operations — Reconciliation tracking
-- ──────────────────────────────────────────────────────

ALTER TABLE registrar_operations
  ADD COLUMN reconciliation_attempts INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN max_reconciliation_attempts INTEGER NOT NULL DEFAULT 10,
  ADD COLUMN next_reconciliation_at TIMESTAMPTZ,
  ADD COLUMN last_reconciliation_at TIMESTAMPTZ,
  ADD COLUMN reconciliation_method VARCHAR(30),
  ADD COLUMN reconciliation_claim_token UUID,
  ADD COLUMN reconciliation_claimed_at TIMESTAMPTZ;

ALTER TABLE registrar_operations
  ADD CONSTRAINT chk_reg_ops_recon_method
  CHECK (reconciliation_method IS NULL OR reconciliation_method IN (
    'ORDER_STATUS', 'DOMAIN_INFO', 'ORDER_STATUS_THEN_DOMAIN_INFO'
  ));

-- ──────────────────────────────────────────────────────
-- 5. registrar_operations — Manual review fields
-- ──────────────────────────────────────────────────────

ALTER TABLE registrar_operations
  ADD COLUMN manual_review_reason VARCHAR(1000),
  ADD COLUMN manual_review_escalated_at TIMESTAMPTZ,
  ADD COLUMN resolved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN resolved_at TIMESTAMPTZ,
  ADD COLUMN resolution_action VARCHAR(30),
  ADD COLUMN resolution_reason VARCHAR(1000),
  ADD COLUMN resolution_evidence VARCHAR(2000);

ALTER TABLE registrar_operations
  ADD CONSTRAINT chk_reg_ops_resolution_action
  CHECK (resolution_action IS NULL OR resolution_action IN (
    'CONFIRM_SUCCEEDED', 'CONFIRM_FAILED', 'RETRY', 'CANCELLED'
  ));

-- ──────────────────────────────────────────────────────
-- 6. registrar_operations — Provider error normalization
-- ──────────────────────────────────────────────────────

ALTER TABLE registrar_operations
  ADD COLUMN provider_error_code VARCHAR(50),
  ADD COLUMN provider_error_retryable BOOLEAN;

-- ──────────────────────────────────────────────────────
-- 7. registrar_operations — Operation metadata
-- ──────────────────────────────────────────────────────

ALTER TABLE registrar_operations
  ADD COLUMN operation_metadata JSONB;

-- ──────────────────────────────────────────────────────
-- 8. registrar_operations — Provider order ID: INTEGER → VARCHAR
--    All external provider IDs are opaque strings.
-- ──────────────────────────────────────────────────────

ALTER TABLE registrar_operations
  ALTER COLUMN provider_order_id TYPE VARCHAR(100)
  USING provider_order_id::VARCHAR;

-- ──────────────────────────────────────────────────────
-- 9. registrar_operations — FQDN column for canonical lookup
-- ──────────────────────────────────────────────────────

ALTER TABLE registrar_operations
  ADD COLUMN fqdn VARCHAR(255);

-- ──────────────────────────────────────────────────────
-- 10. order_items — Link to registrar operation
-- ──────────────────────────────────────────────────────

ALTER TABLE order_items
  ADD COLUMN registrar_operation_id UUID
    REFERENCES registrar_operations(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX uq_order_items_reg_op
  ON order_items(registrar_operation_id)
  WHERE registrar_operation_id IS NOT NULL;

-- ──────────────────────────────────────────────────────
-- 11. Updated indexes for registrar_operations
-- ──────────────────────────────────────────────────────

-- Provider-scoped order ID lookup (replace single-column index)
DROP INDEX IF EXISTS idx_reg_ops_provider_order_id;

CREATE INDEX idx_reg_ops_provider_order
  ON registrar_operations(registrar_provider_id, provider_order_id)
  WHERE provider_order_id IS NOT NULL;

-- Reconciliation sweep
CREATE INDEX idx_reg_ops_reconciliation
  ON registrar_operations(next_reconciliation_at)
  WHERE status IN ('ACCEPTED', 'UNKNOWN')
    AND next_reconciliation_at IS NOT NULL;

-- Retry sweep
CREATE INDEX idx_reg_ops_retry
  ON registrar_operations(next_retry_at)
  WHERE status = 'RETRY_PENDING' AND next_retry_at IS NOT NULL;

-- Unclaimed QUEUED (orphan sweep)
CREATE INDEX idx_reg_ops_queued_orphan
  ON registrar_operations(created_at)
  WHERE status = 'QUEUED' AND claim_token IS NULL;

-- Stale claims
CREATE INDEX idx_reg_ops_stale_claim
  ON registrar_operations(claimed_at)
  WHERE status = 'PROCESSING' AND claim_token IS NOT NULL;

-- Manual review queue
CREATE INDEX idx_reg_ops_manual_review
  ON registrar_operations(manual_review_escalated_at)
  WHERE status = 'MANUAL_REVIEW';

-- FQDN lookup for active operations
CREATE INDEX idx_reg_ops_fqdn
  ON registrar_operations(fqdn)
  WHERE fqdn IS NOT NULL;

-- ──────────────────────────────────────────────────────
-- 12. Audit log table
-- ──────────────────────────────────────────────────────

CREATE TABLE registrar_operation_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_id UUID NOT NULL REFERENCES registrar_operations(id) ON DELETE RESTRICT,
  event_type VARCHAR(50) NOT NULL,
  from_status VARCHAR(20),
  to_status VARCHAR(20),
  attempt_number INTEGER,
  provider_request_id VARCHAR(100),
  provider_http_status INTEGER,
  provider_error_code VARCHAR(50),
  details JSONB,
  actor VARCHAR(100),
  resolved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_reg_op_audit_operation ON registrar_operation_audit_log(operation_id);
CREATE INDEX idx_reg_op_audit_created ON registrar_operation_audit_log(created_at);

-- ──────────────────────────────────────────────────────
-- 13. Webhook business outbox
-- ──────────────────────────────────────────────────────

CREATE TABLE webhook_business_outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_event_id UUID NOT NULL REFERENCES webhook_events(id) ON DELETE RESTRICT,
  provider_identity VARCHAR(30) NOT NULL,
  event_type VARCHAR(50) NOT NULL,
  event_payload JSONB NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  processed_at TIMESTAMPTZ,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE webhook_business_outbox
  ADD CONSTRAINT chk_webhook_outbox_status
  CHECK (status IN ('PENDING', 'COMPLETED', 'FAILED'));

CREATE INDEX idx_webhook_outbox_pending
  ON webhook_business_outbox(created_at)
  WHERE status = 'PENDING';

CREATE UNIQUE INDEX uq_webhook_outbox_event
  ON webhook_business_outbox(webhook_event_id);

-- ──────────────────────────────────────────────────────
-- 14. Contact profile snapshots (immutable, versioned)
--     Correction 5: real backing storage for registration snapshots
-- ──────────────────────────────────────────────────────

CREATE TABLE contact_profile_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Version is a content-addressable hash (SHA-256 of canonical fields)
  -- ensuring identical contact data resolves to the same version.
  version VARCHAR(64) NOT NULL,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  -- Contact data (encrypted at application layer like domain_contacts)
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  company VARCHAR(200),
  email VARCHAR(255),
  phone VARCHAR(30),
  address_line1 VARCHAR(255),
  address_line2 VARCHAR(255),
  city VARCHAR(100),
  state VARCHAR(100),
  postal_code VARCHAR(20),
  country VARCHAR(2),
  -- Immutable record
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Content-addressable: same version for same user = same snapshot
CREATE UNIQUE INDEX uq_contact_snapshot_version
  ON contact_profile_snapshots(user_id, version);

-- Lookup by user
CREATE INDEX idx_contact_snapshot_user
  ON contact_profile_snapshots(user_id);

COMMIT;
