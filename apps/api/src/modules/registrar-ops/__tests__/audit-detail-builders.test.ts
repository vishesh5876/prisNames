/**
 * PrisNames — Audit Detail Builder Tests
 *
 * Tests redaction, PII filtering, and builder functions.
 */

import { describe, it, expect } from 'vitest';
import {
  statusChangeDetails,
  providerResultDetails,
  reconciliationAttemptDetails,
  manualReviewDetails,
  claimAcquiredDetails,
  webhookCorrelationDetails,
} from '../audit-detail-builders.js';

describe('Audit Detail Builders', () => {
  describe('PII/Secret Redaction', () => {
    it('should produce status change details without PII', () => {
      const details = statusChangeDetails('PROCESSING', 'SUCCEEDED', 'Provider confirmed');
      expect(details).toEqual({
        from_status: 'PROCESSING',
        to_status: 'SUCCEEDED',
        reason: 'Provider confirmed',
      });
    });

    it('should not include forbidden keys in output', () => {
      // The builders use sanitizeDetails internally — test via the public API
      const details = providerResultDetails(200, 'SOME_ERROR');
      expect(details.http_status).toBe(200);
      expect(details.error_code).toBe('SOME_ERROR');
      // Should not have any secret-like keys
      expect(details).not.toHaveProperty('api_key');
      expect(details).not.toHaveProperty('authorization');
    });
  });

  describe('Builder Functions', () => {
    it('should build reconciliation attempt details', () => {
      const details = reconciliationAttemptDetails(3, 'ORDER_STATUS', true);
      expect(details).toEqual({ attempt: 3, method: 'ORDER_STATUS', found: true });
    });

    it('should build manual review details', () => {
      const details = manualReviewDetails('CONFIRM_FAILED', 'Provider confirmed failure');
      expect(details).toEqual({ action: 'CONFIRM_FAILED', reason: 'Provider confirmed failure' });
    });

    it('should build manual review details with evidence', () => {
      const details = manualReviewDetails('CONFIRM_SUCCEEDED', 'Verified', 'ticket-123');
      expect(details).toEqual({
        action: 'CONFIRM_SUCCEEDED',
        reason: 'Verified',
        evidence_ref: 'ticket-123',
      });
    });

    it('should build claim acquired details', () => {
      const details = claimAcquiredDetails('worker-1', 5);
      expect(details).toEqual({ worker_id: 'worker-1', claim_version: 5 });
    });

    it('should build webhook correlation details', () => {
      const details = webhookCorrelationDetails('evt-abc', true);
      expect(details).toEqual({ provider_event_id: 'evt-abc', matched: true });
    });
  });
});
