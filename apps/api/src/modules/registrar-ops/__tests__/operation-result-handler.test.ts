/**
 * PrisNames — Operation Result Handler Tests
 *
 * Tests provider result classification.
 */

import { describe, it, expect } from 'vitest';
import {
  ProviderOperationStatus,
  ProviderErrorCode,
  type ProviderOperationResult,
} from '@prisnames/registrar-core';
import { OperationResultHandler } from '../operation-result-handler.js';

describe('OperationResultHandler', () => {
  const handler = new OperationResultHandler();

  describe('classifySuccess', () => {
    it('should classify SUCCEEDED as terminal SUCCEEDED', () => {
      const result: ProviderOperationResult = {
        status: ProviderOperationStatus.SUCCEEDED,
        providerRequestId: 'req-1',
        providerOrderId: '12345',
      };
      const classified = handler.classifySuccess(result);
      expect(classified.status).toBe('SUCCEEDED');
      expect(classified.isTerminal).toBe(true);
      expect(classified.needsReconciliation).toBe(false);
    });

    it('should classify ACCEPTED as non-terminal with reconciliation', () => {
      const result: ProviderOperationResult = {
        status: ProviderOperationStatus.ACCEPTED,
        providerRequestId: 'req-1',
        providerOrderId: '12345',
      };
      const classified = handler.classifySuccess(result);
      expect(classified.status).toBe('ACCEPTED');
      expect(classified.isTerminal).toBe(false);
      expect(classified.needsReconciliation).toBe(true);
    });

    it('should classify UNKNOWN as non-terminal with reconciliation', () => {
      const result: ProviderOperationResult = {
        status: ProviderOperationStatus.UNKNOWN,
        providerRequestId: 'req-1',
      };
      const classified = handler.classifySuccess(result);
      expect(classified.status).toBe('UNKNOWN');
      expect(classified.isTerminal).toBe(false);
      expect(classified.needsReconciliation).toBe(true);
    });
  });

  describe('classifyFailure', () => {
    it('should classify RATE_LIMITED as RETRY_PENDING (no transmission)', () => {
      const result: ProviderOperationResult = {
        status: ProviderOperationStatus.FAILED,
        failureCode: ProviderErrorCode.RATE_LIMITED,
        providerRequestId: 'req-1',
      };
      const classified = handler.classifyFailure(result);
      expect(classified.status).toBe('RETRY_PENDING');
      expect(classified.needsRetry).toBe(true);
      expect(classified.needsReconciliation).toBe(false);
    });

    it('should classify CIRCUIT_OPEN as RETRY_PENDING (no transmission)', () => {
      const result: ProviderOperationResult = {
        status: ProviderOperationStatus.FAILED,
        failureCode: ProviderErrorCode.CIRCUIT_OPEN,
        providerRequestId: 'req-1',
      };
      const classified = handler.classifyFailure(result);
      expect(classified.status).toBe('RETRY_PENDING');
    });

    it('should classify AUTHENTICATION_ERROR as MANUAL_REVIEW', () => {
      const result: ProviderOperationResult = {
        status: ProviderOperationStatus.FAILED,
        failureCode: ProviderErrorCode.AUTHENTICATION_ERROR,
        providerRequestId: 'req-1',
      };
      const classified = handler.classifyFailure(result);
      expect(classified.status).toBe('MANUAL_REVIEW');
      expect(classified.isTerminal).toBe(false);
    });

    it('should classify INSUFFICIENT_FUNDS as MANUAL_REVIEW', () => {
      const result: ProviderOperationResult = {
        status: ProviderOperationStatus.FAILED,
        failureCode: ProviderErrorCode.INSUFFICIENT_FUNDS,
        providerRequestId: 'req-1',
      };
      const classified = handler.classifyFailure(result);
      expect(classified.status).toBe('MANUAL_REVIEW');
    });

    it('should classify VALIDATION_ERROR as terminal FAILED', () => {
      const result: ProviderOperationResult = {
        status: ProviderOperationStatus.FAILED,
        failureCode: ProviderErrorCode.VALIDATION_ERROR,
        providerRequestId: 'req-1',
      };
      const classified = handler.classifyFailure(result);
      expect(classified.status).toBe('FAILED');
      expect(classified.isTerminal).toBe(true);
    });

    it('should classify DOMAIN_NOT_AVAILABLE as terminal FAILED', () => {
      const result: ProviderOperationResult = {
        status: ProviderOperationStatus.FAILED,
        failureCode: ProviderErrorCode.DOMAIN_NOT_AVAILABLE,
        providerRequestId: 'req-1',
      };
      const classified = handler.classifyFailure(result);
      expect(classified.status).toBe('FAILED');
      expect(classified.isTerminal).toBe(true);
    });

    it('should classify PROVIDER_TIMEOUT as UNKNOWN with reconciliation', () => {
      const result: ProviderOperationResult = {
        status: ProviderOperationStatus.FAILED,
        failureCode: ProviderErrorCode.PROVIDER_TIMEOUT,
        providerRequestId: 'req-1',
      };
      const classified = handler.classifyFailure(result);
      expect(classified.status).toBe('UNKNOWN');
      expect(classified.needsReconciliation).toBe(true);
    });

    it('should classify PROVIDER_UNAVAILABLE as UNKNOWN with reconciliation', () => {
      const result: ProviderOperationResult = {
        status: ProviderOperationStatus.FAILED,
        failureCode: ProviderErrorCode.PROVIDER_UNAVAILABLE,
        providerRequestId: 'req-1',
      };
      const classified = handler.classifyFailure(result);
      expect(classified.status).toBe('UNKNOWN');
      expect(classified.needsReconciliation).toBe(true);
    });

    it('should classify no-error-code failure as UNKNOWN (conservative)', () => {
      const result: ProviderOperationResult = {
        status: ProviderOperationStatus.FAILED,
        providerRequestId: 'req-1',
      };
      const classified = handler.classifyFailure(result);
      expect(classified.status).toBe('UNKNOWN');
      expect(classified.needsReconciliation).toBe(true);
    });
  });

  describe('classifyError (exception path)', () => {
    it('should classify exception before attempt as RETRY_PENDING', () => {
      const classified = handler.classifyError(undefined, false);
      expect(classified.status).toBe('RETRY_PENDING');
      expect(classified.attemptStatus).toBe('NOT_ATTEMPTED');
    });

    it('should classify exception after attempt as UNKNOWN', () => {
      const classified = handler.classifyError(undefined, true);
      expect(classified.status).toBe('UNKNOWN');
      expect(classified.attemptStatus).toBe('OUTCOME_UNKNOWN');
      expect(classified.needsReconciliation).toBe(true);
    });

    it('should classify known error code after attempt via classifyFailure', () => {
      const classified = handler.classifyError(ProviderErrorCode.RATE_LIMITED, true);
      expect(classified.status).toBe('RETRY_PENDING');
    });
  });
});
