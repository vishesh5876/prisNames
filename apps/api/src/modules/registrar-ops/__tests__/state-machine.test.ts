/**
 * PrisNames — State Machine Tests
 *
 * Tests transition validity and terminal status detection.
 */

import { describe, it, expect } from 'vitest';
import {
  assertValidTransition,
  InvalidStateTransitionError,
  isTerminalStatus,
  VALID_OP_TRANSITIONS,
} from '../state-machine.js';

describe('State Machine', () => {
  describe('assertValidTransition', () => {
    it('should allow QUEUED → PROCESSING', () => {
      expect(() => assertValidTransition('QUEUED', 'PROCESSING')).not.toThrow();
    });

    it('should allow QUEUED → CANCELLED', () => {
      expect(() => assertValidTransition('QUEUED', 'CANCELLED')).not.toThrow();
    });

    it('should allow PROCESSING → SUCCEEDED', () => {
      expect(() => assertValidTransition('PROCESSING', 'SUCCEEDED')).not.toThrow();
    });

    it('should allow PROCESSING → ACCEPTED', () => {
      expect(() => assertValidTransition('PROCESSING', 'ACCEPTED')).not.toThrow();
    });

    it('should allow PROCESSING → UNKNOWN', () => {
      expect(() => assertValidTransition('PROCESSING', 'UNKNOWN')).not.toThrow();
    });

    it('should allow PROCESSING → FAILED', () => {
      expect(() => assertValidTransition('PROCESSING', 'FAILED')).not.toThrow();
    });

    it('should allow PROCESSING → RETRY_PENDING', () => {
      expect(() => assertValidTransition('PROCESSING', 'RETRY_PENDING')).not.toThrow();
    });

    it('should allow PROCESSING → MANUAL_REVIEW', () => {
      expect(() => assertValidTransition('PROCESSING', 'MANUAL_REVIEW')).not.toThrow();
    });

    it('should allow ACCEPTED → SUCCEEDED', () => {
      expect(() => assertValidTransition('ACCEPTED', 'SUCCEEDED')).not.toThrow();
    });

    it('should allow ACCEPTED → MANUAL_REVIEW', () => {
      expect(() => assertValidTransition('ACCEPTED', 'MANUAL_REVIEW')).not.toThrow();
    });

    it('should allow UNKNOWN → SUCCEEDED', () => {
      expect(() => assertValidTransition('UNKNOWN', 'SUCCEEDED')).not.toThrow();
    });

    it('should allow UNKNOWN → MANUAL_REVIEW', () => {
      expect(() => assertValidTransition('UNKNOWN', 'MANUAL_REVIEW')).not.toThrow();
    });

    it('should allow RETRY_PENDING → PROCESSING', () => {
      expect(() => assertValidTransition('RETRY_PENDING', 'PROCESSING')).not.toThrow();
    });

    it('should allow RETRY_PENDING → MANUAL_REVIEW', () => {
      expect(() => assertValidTransition('RETRY_PENDING', 'MANUAL_REVIEW')).not.toThrow();
    });

    it('should allow MANUAL_REVIEW → SUCCEEDED', () => {
      expect(() => assertValidTransition('MANUAL_REVIEW', 'SUCCEEDED')).not.toThrow();
    });

    it('should allow MANUAL_REVIEW → RETRY_PENDING', () => {
      expect(() => assertValidTransition('MANUAL_REVIEW', 'RETRY_PENDING')).not.toThrow();
    });

    // ─── Invalid transitions ──────────────────
    it('should reject SUCCEEDED → anything (terminal)', () => {
      expect(() => assertValidTransition('SUCCEEDED', 'PROCESSING')).toThrow(InvalidStateTransitionError);
      expect(() => assertValidTransition('SUCCEEDED', 'FAILED')).toThrow(InvalidStateTransitionError);
    });

    it('should reject FAILED → anything (terminal)', () => {
      expect(() => assertValidTransition('FAILED', 'PROCESSING')).toThrow(InvalidStateTransitionError);
      expect(() => assertValidTransition('FAILED', 'RETRY_PENDING')).toThrow(InvalidStateTransitionError);
    });

    it('should reject CANCELLED → anything (terminal)', () => {
      expect(() => assertValidTransition('CANCELLED', 'PROCESSING')).toThrow(InvalidStateTransitionError);
    });

    it('should reject UNKNOWN → RETRY_PENDING (reconciliation only)', () => {
      expect(() => assertValidTransition('UNKNOWN', 'RETRY_PENDING')).toThrow(InvalidStateTransitionError);
    });

    it('should reject QUEUED → SUCCEEDED (must go through PROCESSING)', () => {
      expect(() => assertValidTransition('QUEUED', 'SUCCEEDED')).toThrow(InvalidStateTransitionError);
    });

    it('should reject unknown source status', () => {
      expect(() => assertValidTransition('INVALID', 'PROCESSING')).toThrow(InvalidStateTransitionError);
    });
  });

  describe('isTerminalStatus', () => {
    it('should identify SUCCEEDED as terminal', () => {
      expect(isTerminalStatus('SUCCEEDED')).toBe(true);
    });

    it('should identify FAILED as terminal', () => {
      expect(isTerminalStatus('FAILED')).toBe(true);
    });

    it('should identify CANCELLED as terminal', () => {
      expect(isTerminalStatus('CANCELLED')).toBe(true);
    });

    it('should identify PROCESSING as non-terminal', () => {
      expect(isTerminalStatus('PROCESSING')).toBe(false);
    });

    it('should identify UNKNOWN as non-terminal', () => {
      expect(isTerminalStatus('UNKNOWN')).toBe(false);
    });

    it('should identify MANUAL_REVIEW as non-terminal', () => {
      expect(isTerminalStatus('MANUAL_REVIEW')).toBe(false);
    });
  });

  describe('VALID_OP_TRANSITIONS completeness', () => {
    it('should have entries for all known statuses', () => {
      const knownStatuses = [
        'QUEUED', 'PROCESSING', 'ACCEPTED', 'SUCCEEDED',
        'UNKNOWN', 'RETRY_PENDING', 'FAILED', 'MANUAL_REVIEW', 'CANCELLED',
      ];
      for (const status of knownStatuses) {
        expect(VALID_OP_TRANSITIONS).toHaveProperty(status);
      }
    });

    it('should have empty arrays for terminal statuses', () => {
      expect(VALID_OP_TRANSITIONS['SUCCEEDED']).toHaveLength(0);
      expect(VALID_OP_TRANSITIONS['FAILED']).toHaveLength(0);
      expect(VALID_OP_TRANSITIONS['CANCELLED']).toHaveLength(0);
    });
  });
});
