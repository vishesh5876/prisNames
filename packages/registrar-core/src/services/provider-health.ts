/**
 * PrisNames — Provider Health Tracker
 *
 * Per-process local telemetry. NOT globally authoritative.
 * API and worker processes each maintain independent state.
 *
 * For global operational health, use metrics/observability/Redis in a later phase.
 */

import type { ProviderHealthStatus } from '../models/account.js';
import { CircuitBreaker } from './circuit-breaker.js';

export class ProviderHealthTracker {
  private readonly providerId: string;
  private readonly circuitBreaker: CircuitBreaker;

  private totalRequests = 0;
  private totalErrors = 0;
  private lastSuccessAt?: Date;
  private lastFailureAt?: Date;
  private latencies: number[] = [];
  private readonly maxLatencySamples: number;

  constructor(
    providerId: string,
    circuitBreaker: CircuitBreaker,
    maxLatencySamples = 100,
  ) {
    this.providerId = providerId;
    this.circuitBreaker = circuitBreaker;
    this.maxLatencySamples = maxLatencySamples;
  }

  recordSuccess(latencyMs: number): void {
    this.totalRequests++;
    this.lastSuccessAt = new Date();
    this.addLatency(latencyMs);
    this.circuitBreaker.recordSuccess();
  }

  recordFailure(latencyMs: number, httpStatus?: number, isNetworkError = false): void {
    this.totalRequests++;
    this.totalErrors++;
    this.lastFailureAt = new Date();
    this.addLatency(latencyMs);
    this.circuitBreaker.recordFailure(httpStatus, isNetworkError);
  }

  getHealthStatus(): ProviderHealthStatus {
    return {
      providerId: this.providerId,
      isCircuitOpen: !this.circuitBreaker.canExecute(),
      consecutiveFailures: this.circuitBreaker.getConsecutiveFailures(),
      lastSuccessAt: this.lastSuccessAt,
      lastFailureAt: this.lastFailureAt,
      averageLatencyMs: this.getAverageLatency(),
      totalRequests: this.totalRequests,
      totalErrors: this.totalErrors,
    };
  }

  private addLatency(latencyMs: number): void {
    this.latencies.push(latencyMs);
    if (this.latencies.length > this.maxLatencySamples) {
      this.latencies.shift();
    }
  }

  private getAverageLatency(): number | undefined {
    if (this.latencies.length === 0) return undefined;
    const sum = this.latencies.reduce((a, b) => a + b, 0);
    return Math.round(sum / this.latencies.length);
  }
}
