/**
 * PrisNames — Circuit Breaker
 *
 * State machine: CLOSED → OPEN → HALF_OPEN → CLOSED/OPEN
 *
 * TRIP CLASSIFICATION — Documented explicitly:
 *
 * TRIPS on (platform failures):
 *   - Network errors (ECONNREFUSED, ENOTFOUND, ETIMEDOUT)
 *   - HTTP 500 (Internal Server Error)
 *   - HTTP 502 (Bad Gateway)
 *   - HTTP 503 (Service Unavailable)
 *   - HTTP 504 (Gateway Timeout)
 *   - Repeated provider timeouts
 *
 * DOES NOT TRIP on (business/client errors):
 *   - 400 (validation)
 *   - 401/403 (credentials — alert admin, not circuit-break)
 *   - 402 (insufficient provider balance)
 *   - 404 (business lookup)
 *   - 409 (conflict/domain state)
 *   - 429 (rate limit — handled by rate limiter)
 *   - 501 (unsupported capability, not outage)
 */

export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

export interface CircuitBreakerConfig {
  /** Number of consecutive platform failures to open the circuit */
  failureThreshold: number;
  /** Time in ms before transitioning from OPEN to HALF_OPEN */
  resetTimeoutMs: number;
  /** Number of successful requests in HALF_OPEN to close the circuit */
  halfOpenSuccessThreshold: number;
}

const DEFAULT_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  resetTimeoutMs: 30_000,
  halfOpenSuccessThreshold: 2,
};

/**
 * HTTP status codes that indicate platform/provider failures (trip the breaker).
 */
const TRIPPING_STATUS_CODES = new Set([500, 502, 503, 504]);

/**
 * HTTP status codes that do NOT trip the breaker (business/client errors).
 */
const NON_TRIPPING_STATUS_CODES = new Set([400, 401, 402, 403, 404, 409, 429, 501]);

export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private consecutiveFailures = 0;
  private halfOpenSuccesses = 0;
  private lastFailureTime = 0;
  private readonly config: CircuitBreakerConfig;

  constructor(config?: Partial<CircuitBreakerConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /** Check if a request should be allowed through. */
  canExecute(): boolean {
    if (this.state === CircuitState.CLOSED) return true;

    if (this.state === CircuitState.OPEN) {
      // Check if reset timeout has elapsed
      if (Date.now() - this.lastFailureTime >= this.config.resetTimeoutMs) {
        this.state = CircuitState.HALF_OPEN;
        this.halfOpenSuccesses = 0;
        return true;
      }
      return false;
    }

    // HALF_OPEN — allow limited requests
    return true;
  }

  /** Record a successful request. */
  recordSuccess(): void {
    if (this.state === CircuitState.HALF_OPEN) {
      this.halfOpenSuccesses++;
      if (this.halfOpenSuccesses >= this.config.halfOpenSuccessThreshold) {
        this.state = CircuitState.CLOSED;
        this.consecutiveFailures = 0;
      }
    } else {
      this.consecutiveFailures = 0;
    }
  }

  /**
   * Record a failure and determine if it should trip the breaker.
   *
   * @param httpStatus - HTTP status code (if available)
   * @param isNetworkError - True if the failure was a network-level error
   */
  recordFailure(httpStatus?: number, isNetworkError = false): void {
    // Only trip on platform failures
    if (!this.shouldTrip(httpStatus, isNetworkError)) return;

    this.consecutiveFailures++;
    this.lastFailureTime = Date.now();

    if (this.state === CircuitState.HALF_OPEN) {
      // Any platform failure in HALF_OPEN reopens the circuit
      this.state = CircuitState.OPEN;
      return;
    }

    if (this.consecutiveFailures >= this.config.failureThreshold) {
      this.state = CircuitState.OPEN;
    }
  }

  /** Determine if this failure type should trip the breaker. */
  shouldTrip(httpStatus?: number, isNetworkError = false): boolean {
    if (isNetworkError) return true;
    if (httpStatus === undefined) return false;
    if (NON_TRIPPING_STATUS_CODES.has(httpStatus)) return false;
    return TRIPPING_STATUS_CODES.has(httpStatus);
  }

  getState(): CircuitState {
    return this.state;
  }

  getConsecutiveFailures(): number {
    return this.consecutiveFailures;
  }

  /** Reset the circuit breaker to closed state. */
  reset(): void {
    this.state = CircuitState.CLOSED;
    this.consecutiveFailures = 0;
    this.halfOpenSuccesses = 0;
  }
}
