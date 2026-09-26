/**
 * PrisNames — Provider Health Tracker Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ProviderHealthTracker } from '../services/provider-health.js';
import { CircuitBreaker } from '../services/circuit-breaker.js';

describe('ProviderHealthTracker', () => {
  let tracker: ProviderHealthTracker;
  let breaker: CircuitBreaker;

  beforeEach(() => {
    breaker = new CircuitBreaker({ failureThreshold: 3 });
    tracker = new ProviderHealthTracker('dynadot', breaker);
  });

  it('starts with empty health status', () => {
    const status = tracker.getHealthStatus();
    expect(status.providerId).toBe('dynadot');
    expect(status.totalRequests).toBe(0);
    expect(status.totalErrors).toBe(0);
    expect(status.isCircuitOpen).toBe(false);
    expect(status.consecutiveFailures).toBe(0);
    expect(status.lastSuccessAt).toBeUndefined();
    expect(status.lastFailureAt).toBeUndefined();
    expect(status.averageLatencyMs).toBeUndefined();
  });

  it('records successes', () => {
    tracker.recordSuccess(100);
    tracker.recordSuccess(200);

    const status = tracker.getHealthStatus();
    expect(status.totalRequests).toBe(2);
    expect(status.totalErrors).toBe(0);
    expect(status.averageLatencyMs).toBe(150);
    expect(status.lastSuccessAt).toBeInstanceOf(Date);
  });

  it('records failures', () => {
    tracker.recordFailure(50, 500);

    const status = tracker.getHealthStatus();
    expect(status.totalRequests).toBe(1);
    expect(status.totalErrors).toBe(1);
    expect(status.lastFailureAt).toBeInstanceOf(Date);
  });

  it('integrates with circuit breaker', () => {
    tracker.recordFailure(50, 500);
    tracker.recordFailure(50, 502);
    tracker.recordFailure(50, 503);

    const status = tracker.getHealthStatus();
    expect(status.isCircuitOpen).toBe(true);
    expect(status.consecutiveFailures).toBe(3);
  });

  it('tracks per-process state only (documented non-authoritative)', () => {
    // This is a documentation/design test — two independent trackers
    // sharing a provider ID have completely different state
    const breaker2 = new CircuitBreaker({ failureThreshold: 3 });
    const tracker2 = new ProviderHealthTracker('dynadot', breaker2);

    tracker.recordSuccess(100);
    tracker2.recordFailure(200, 500);

    expect(tracker.getHealthStatus().totalErrors).toBe(0);
    expect(tracker2.getHealthStatus().totalErrors).toBe(1);
  });
});
