/**
 * PrisNames — Circuit Breaker Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CircuitBreaker, CircuitState } from '../services/circuit-breaker.js';

describe('CircuitBreaker', () => {
  let breaker: CircuitBreaker;

  beforeEach(() => {
    breaker = new CircuitBreaker({
      failureThreshold: 3,
      resetTimeoutMs: 1000,
      halfOpenSuccessThreshold: 2,
    });
  });

  describe('initial state', () => {
    it('starts CLOSED', () => {
      expect(breaker.getState()).toBe(CircuitState.CLOSED);
      expect(breaker.canExecute()).toBe(true);
    });
  });

  describe('trip classification', () => {
    it.each([500, 502, 503, 504])('trips on HTTP %d (platform error)', (status) => {
      expect(breaker.shouldTrip(status)).toBe(true);
    });

    it('trips on network errors', () => {
      expect(breaker.shouldTrip(undefined, true)).toBe(true);
    });

    it.each([400, 401, 402, 403, 404, 409, 429, 501])(
      'does NOT trip on HTTP %d (business error)',
      (status) => {
        expect(breaker.shouldTrip(status)).toBe(false);
      },
    );

    it('does not trip on unknown status with no network error', () => {
      expect(breaker.shouldTrip(undefined, false)).toBe(false);
    });
  });

  describe('CLOSED → OPEN transition', () => {
    it('opens after consecutive platform failures reach threshold', () => {
      breaker.recordFailure(500);
      breaker.recordFailure(502);
      expect(breaker.getState()).toBe(CircuitState.CLOSED);

      breaker.recordFailure(503);
      expect(breaker.getState()).toBe(CircuitState.OPEN);
      expect(breaker.canExecute()).toBe(false);
    });

    it('resets failure count on success', () => {
      breaker.recordFailure(500);
      breaker.recordFailure(502);
      breaker.recordSuccess();
      breaker.recordFailure(500);
      breaker.recordFailure(502);
      // Only 2 consecutive, not 3
      expect(breaker.getState()).toBe(CircuitState.CLOSED);
    });

    it('does not count business errors toward threshold', () => {
      breaker.recordFailure(400);
      breaker.recordFailure(404);
      breaker.recordFailure(429);
      expect(breaker.getState()).toBe(CircuitState.CLOSED);
    });
  });

  describe('OPEN → HALF_OPEN transition', () => {
    it('transitions to HALF_OPEN after reset timeout', () => {
      vi.useFakeTimers();

      // Trip the breaker
      breaker.recordFailure(500);
      breaker.recordFailure(500);
      breaker.recordFailure(500);
      expect(breaker.canExecute()).toBe(false);

      // Advance time past reset timeout
      vi.advanceTimersByTime(1001);
      expect(breaker.canExecute()).toBe(true);
      expect(breaker.getState()).toBe(CircuitState.HALF_OPEN);

      vi.useRealTimers();
    });
  });

  describe('HALF_OPEN → CLOSED transition', () => {
    it('closes after sufficient successes', () => {
      vi.useFakeTimers();

      breaker.recordFailure(500);
      breaker.recordFailure(500);
      breaker.recordFailure(500);
      vi.advanceTimersByTime(1001);
      breaker.canExecute(); // trigger transition

      breaker.recordSuccess();
      expect(breaker.getState()).toBe(CircuitState.HALF_OPEN);

      breaker.recordSuccess();
      expect(breaker.getState()).toBe(CircuitState.CLOSED);

      vi.useRealTimers();
    });
  });

  describe('HALF_OPEN → OPEN transition', () => {
    it('reopens on any platform failure in HALF_OPEN', () => {
      vi.useFakeTimers();

      breaker.recordFailure(500);
      breaker.recordFailure(500);
      breaker.recordFailure(500);
      vi.advanceTimersByTime(1001);
      breaker.canExecute(); // trigger half-open

      breaker.recordFailure(500);
      expect(breaker.getState()).toBe(CircuitState.OPEN);

      vi.useRealTimers();
    });
  });

  describe('reset', () => {
    it('resets to CLOSED state', () => {
      breaker.recordFailure(500);
      breaker.recordFailure(500);
      breaker.recordFailure(500);
      expect(breaker.getState()).toBe(CircuitState.OPEN);

      breaker.reset();
      expect(breaker.getState()).toBe(CircuitState.CLOSED);
      expect(breaker.getConsecutiveFailures()).toBe(0);
    });
  });
});
