/**
 * PrisNames — Account Models
 */

import type { MoneyAmount } from './money.js';

export interface AccountInfo {
  readonly balance?: MoneyAmount;
  readonly currency?: string;
  readonly accountId?: string;
}

/**
 * Per-process local health telemetry. NOT globally authoritative.
 * API and worker processes each have different state.
 * For global health use metrics/observability/Redis in a later phase.
 */
export interface ProviderHealthStatus {
  readonly providerId: string;
  readonly isCircuitOpen: boolean;
  readonly consecutiveFailures: number;
  readonly lastSuccessAt?: Date;
  readonly lastFailureAt?: Date;
  readonly averageLatencyMs?: number;
  readonly totalRequests: number;
  readonly totalErrors: number;
}
