/**
 * PrisNames — Dynadot HTTP Client
 *
 * Centralized HTTP transport for Dynadot REST v2 API.
 *
 * Features:
 * - Endpoint descriptor-driven (method, signature requirement from ENDPOINTS)
 * - Outbound X-Signature via DynadotApiSignatureService
 * - Rate limiter integration (acquire/release per request)
 * - Circuit breaker integration
 * - Request ID propagation (X-Request-ID)
 * - Timeout enforcement
 * - 429 distributed cooldown handling
 * - Dynadot application-envelope parsing (HTTP 200 + app code >= 400)
 * - Pre/post-transmission error classification:
 *   - Pre-transmission (validation, rate limit, circuit open) → FAILED
 *   - Post-transmission ambiguity (timeout, socket close) → UNKNOWN
 *
 * Response processing order (§7 of user spec):
 *   HTTP response → safely parse → inspect provider envelope →
 *   reject/normalize error → ONLY THEN return success data → mapper → model
 *
 * Signing rules:
 * 1. Construct the final URL once
 * 2. Preserve exact path + query order
 * 3. Create body string once
 * 4. Generate X-Request-ID
 * 5. Sign: apiKey + "\n" + fullPathAndQuery + "\n" + xRequestId + "\n" + body
 * 6. Send exactly that body and URL
 * Do NOT sort query params after signing, JSON.stringify twice, or mutate after signing
 */

import { ProviderErrorCode } from '@prisnames/registrar-core';
import type { OperationContext } from '@prisnames/registrar-core';
import type { DynadotConfig } from './config.js';
import type { DynadotRateLimiter } from './rate-limiter.js';
import { DynadotApiError, mapDynadotErrorCode } from './errors.js';
import type { CircuitBreaker } from '@prisnames/registrar-core';
import type { ProviderHealthTracker } from '@prisnames/registrar-core';
import { DynadotApiSignatureService } from './api-signature.js';
import type { EndpointDescriptor } from './endpoints.js';
import { parseDynadotEnvelope, createAppLevelError } from './response-envelope.js';

// ──────────────────────────────────────────────
// TYPES
// ──────────────────────────────────────────────

export interface HttpClientConfig {
  timeoutMs: number;
  maxRetries: number;
  retryDelayMs: number;
}

export interface DynadotApiResponse<T = unknown> {
  status: number;
  data: T;
  requestId: string;
  /** Dynadot application-level status code (extracted from envelope) */
  appCode?: number;
}

export interface RequestOptions {
  /** Path relative to base URL, e.g. "domains/example.com/register" */
  path: string;
  /** Query parameters (appended to URL before signing) */
  params?: Record<string, string>;
  /** Request body (for POST/PUT/DELETE) */
  body?: unknown;
  /** Operation context for correlation */
  context?: OperationContext;
}

const DEFAULT_HTTP_CONFIG: HttpClientConfig = {
  timeoutMs: 30_000,
  maxRetries: 2,
  retryDelayMs: 1000,
};

// ──────────────────────────────────────────────
// HTTP CLIENT
// ──────────────────────────────────────────────

export class DynadotHttpClient {
  private readonly config: DynadotConfig;
  private readonly httpConfig: HttpClientConfig;
  private readonly rateLimiter: DynadotRateLimiter;
  private readonly circuitBreaker: CircuitBreaker;
  private readonly healthTracker: ProviderHealthTracker;
  private readonly signer: DynadotApiSignatureService;

  constructor(
    config: DynadotConfig,
    rateLimiter: DynadotRateLimiter,
    circuitBreaker: CircuitBreaker,
    healthTracker: ProviderHealthTracker,
    httpConfig?: Partial<HttpClientConfig>,
  ) {
    this.config = config;
    this.rateLimiter = rateLimiter;
    this.circuitBreaker = circuitBreaker;
    this.healthTracker = healthTracker;
    this.httpConfig = { ...DEFAULT_HTTP_CONFIG, ...httpConfig };
    this.signer = new DynadotApiSignatureService(config.apiKey, config.apiSecret);
  }

  /**
   * Execute an API request using an endpoint descriptor.
   * The descriptor determines HTTP method and whether X-Signature is required.
   * Callers never decide signature policy themselves.
   */
  async request<T = unknown>(
    endpoint: EndpointDescriptor,
    options: RequestOptions,
  ): Promise<DynadotApiResponse<T>> {
    return this.executeRequest<T>(endpoint, options);
  }

  // ── Core Execution ──

  private async executeRequest<T>(
    endpoint: EndpointDescriptor,
    options: RequestOptions,
  ): Promise<DynadotApiResponse<T>> {
    const requestId = options.context?.requestId ?? crypto.randomUUID();
    const startTime = Date.now();

    // Pre-transmission check: circuit breaker
    if (!this.circuitBreaker.canExecute()) {
      throw new DynadotApiError(ProviderErrorCode.CIRCUIT_OPEN, 'Circuit breaker is open', {
        providerRequestId: requestId,
        retryable: false,
      });
    }

    // Pre-transmission check: rate limiter
    const lease = await this.rateLimiter.acquireLease();
    if (!lease.acquired) {
      throw new DynadotApiError(ProviderErrorCode.RATE_LIMITED, 'Rate limit exceeded', {
        providerRequestId: requestId,
        retryable: true,
      });
    }

    try {
      // Step 1: Construct the final URL once
      const url = this.buildUrl(options.path, options.params);

      // Step 2: Create body string once (before signing)
      let bodyString = '';
      if (options.body && endpoint.method !== 'GET') {
        bodyString = JSON.stringify(options.body);
      }

      // Step 3: Build headers
      const headers: Record<string, string> = {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'X-Request-ID': requestId,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      };

      // Step 4: Sign if required (using exact path + query, exact body)
      if (endpoint.signed) {
        const urlObj = new URL(url);
        const fullPathAndQuery = urlObj.pathname + urlObj.search;
        const signature = this.signer.sign(fullPathAndQuery, requestId, bodyString);
        headers['X-Signature'] = signature;
      }

      // Step 5: Build fetch options with the EXACT body that was signed
      const fetchOptions: RequestInit = {
        method: endpoint.method,
        headers,
        signal: AbortSignal.timeout(this.httpConfig.timeoutMs),
      };

      if (bodyString && endpoint.method !== 'GET') {
        fetchOptions.body = bodyString;
      }

      // POST-TRANSMISSION: request is sent to the wire
      const response = await fetch(url, fetchOptions);
      const latencyMs = Date.now() - startTime;

      // ── LAYER 1: HTTP-status errors (non-2xx always fails first) ──

      // Handle 429 — set distributed cooldown
      if (response.status === 429) {
        const retryAfter = this.parseRetryAfter(response.headers.get('Retry-After'));
        await this.rateLimiter.setCooldown(retryAfter);

        this.healthTracker.recordFailure(latencyMs, 429);

        throw new DynadotApiError(
          ProviderErrorCode.RATE_LIMITED,
          'Provider rate limit exceeded (HTTP 429)',
          {
            httpStatus: 429,
            providerRequestId: requestId,
            retryable: true,
          },
        );
      }

      // Parse response body (always attempt even for errors — Dynadot returns JSON errors)
      const responseText = await response.text();
      let parsedBody: unknown;
      try {
        parsedBody = JSON.parse(responseText);
      } catch {
        parsedBody = responseText;
      }

      // Non-2xx HTTP status — always a provider failure
      if (!response.ok) {
        const errorCode = mapDynadotErrorCode(response.status);
        this.healthTracker.recordFailure(latencyMs, response.status);
        this.circuitBreaker.recordFailure(response.status);

        // Try to extract app-level error details for better diagnostics
        const envelope = parseDynadotEnvelope(parsedBody);
        let errorDesc: string | undefined;
        if (envelope.status === 'APP_ERROR' || envelope.status === 'SUCCESS' || envelope.status === 'PROTOCOL_ERROR') {
          errorDesc = envelope.meta.errorDescription;
        }

        throw new DynadotApiError(errorCode, `Dynadot API error: HTTP ${response.status}`, {
          httpStatus: response.status,
          providerRequestId: requestId,
          retryable: response.status >= 500,
          dynadotErrorMessage: errorDesc,
        });
      }

      // ── LAYER 2: Application-envelope inspection (HTTP 2xx) ──
      // This is CRITICAL: Dynadot may return HTTP 200 with code: 400/401/etc.

      const envelope = parseDynadotEnvelope(parsedBody);

      switch (envelope.status) {
        case 'SUCCESS': {
          // HTTP 2xx + app code 200/201 → genuine success
          this.healthTracker.recordSuccess(latencyMs);
          this.circuitBreaker.recordSuccess();
          return {
            status: response.status,
            data: envelope.data as T,
            requestId,
            appCode: envelope.meta.code,
          };
        }

        case 'ACCEPTED': {
          // HTTP 2xx + app code 202 → transactional async accepted
          this.healthTracker.recordSuccess(latencyMs);
          this.circuitBreaker.recordSuccess();
          return {
            status: response.status,
            data: envelope.data as T,
            requestId,
            appCode: 202,
          };
        }

        case 'APP_ERROR': {
          // HTTP 2xx + app code >= 400 → provider error masquerading as success
          const appCode = envelope.meta.code ?? 500;
          this.healthTracker.recordFailure(latencyMs, appCode);

          // Rate limiting at application level
          if (appCode === 429) {
            await this.rateLimiter.setCooldown(undefined);
            throw new DynadotApiError(
              ProviderErrorCode.RATE_LIMITED,
              'Provider rate limit exceeded (app code 429)',
              {
                httpStatus: 200,
                providerRequestId: requestId,
                retryable: true,
              },
            );
          }

          // Circuit breaker for 5xx app codes
          if (appCode >= 500) {
            this.circuitBreaker.recordFailure(appCode);
          }

          throw createAppLevelError(envelope.meta, requestId);
        }

        case 'PROTOCOL_ERROR': {
          // HTTP 2xx + unrecognized app code → do NOT silently treat as success
          this.healthTracker.recordFailure(latencyMs, envelope.meta.code);

          throw new DynadotApiError(
            ProviderErrorCode.PROVIDER_UNAVAILABLE,
            `Dynadot protocol error: unexpected application code ${envelope.meta.code}`,
            {
              httpStatus: response.status,
              providerRequestId: requestId,
              retryable: false,
            },
          );
        }

        case 'NO_ENVELOPE': {
          // No top-level application code — allow endpoint-specific DTO handling
          // This path is for endpoints where docs confirm no envelope structure
          this.healthTracker.recordSuccess(latencyMs);
          this.circuitBreaker.recordSuccess();
          return {
            status: response.status,
            data: envelope.rawData as T,
            requestId,
          };
        }
      }
    } catch (error) {
      // POST-TRANSMISSION ambiguity: request may have reached provider
      if (error instanceof DynadotApiError) {
        throw error; // Already classified
      }

      const latencyMs = Date.now() - startTime;

      // Timeout — POST-TRANSMISSION ambiguity → UNKNOWN for transactional ops
      if (error instanceof DOMException && error.name === 'TimeoutError') {
        this.healthTracker.recordFailure(latencyMs, undefined, false);
        this.circuitBreaker.recordFailure(undefined, true);

        throw new DynadotApiError(
          ProviderErrorCode.PROVIDER_TIMEOUT,
          `Dynadot API timeout after ${this.httpConfig.timeoutMs}ms`,
          {
            providerRequestId: requestId,
            retryable: false, // Transactional timeouts must produce UNKNOWN, not auto-retry
            cause: error,
          },
        );
      }

      // Network error — POST-TRANSMISSION ambiguity
      this.healthTracker.recordFailure(latencyMs, undefined, true);
      this.circuitBreaker.recordFailure(undefined, true);

      throw new DynadotApiError(
        ProviderErrorCode.PROVIDER_UNAVAILABLE,
        `Dynadot API network error: ${error instanceof Error ? error.message : 'Unknown'}`,
        {
          providerRequestId: requestId,
          retryable: false, // Post-transmission — UNKNOWN for transactional ops
          cause: error instanceof Error ? error : undefined,
        },
      );
    } finally {
      await this.rateLimiter.releaseLease(lease.leaseId).catch(() => {
        // Best effort — stale leases auto-expire via TTL
      });
    }
  }

  // ── Helpers ──

  private buildUrl(path: string, params?: Record<string, string>): string {
    // Construct URL: baseUrl already includes /restful/v2
    const url = new URL(`${this.config.baseUrl}/${path}`);
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        url.searchParams.set(key, value);
      }
    }
    return url.toString();
  }

  /**
   * Parse Retry-After header (optional — not guaranteed by Dynadot).
   */
  private parseRetryAfter(header: string | null): number | undefined {
    if (!header) return undefined;

    const seconds = Number(header);
    if (Number.isFinite(seconds) && seconds > 0) {
      return Math.ceil(seconds);
    }

    try {
      const date = new Date(header);
      if (!isNaN(date.getTime())) {
        const diffSeconds = Math.ceil((date.getTime() - Date.now()) / 1000);
        return diffSeconds > 0 ? diffSeconds : undefined;
      }
    } catch {
      // Ignore parse errors
    }

    return undefined;
  }
}
