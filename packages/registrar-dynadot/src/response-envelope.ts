/**
 * PrisNames — Dynadot Response Envelope Parser
 *
 * Dynadot REST v2 wraps ALL responses in an application-level envelope:
 *
 *   { code: number, message: string, data?: T, error?: { description: string } }
 *
 * IMPORTANT: Dynadot may return HTTP 200 with an application-level error code
 * (e.g., code: 400, code: 401). This is observed sandbox behavior confirmed
 * 2026-09-13. The HTTP status and application code are INDEPENDENT layers.
 *
 * Capitalization: The sandbox returns lowercase `code`/`message`/`error`.
 * Documentation examples use `Code`/`Message`. We support both.
 *
 * Decision matrix:
 *
 * | HTTP Status | App Code   | Result                              |
 * |-------------|------------|-------------------------------------|
 * | non-2xx     | any        | Provider failure (HTTP takes priority) |
 * | 2xx         | 200/201    | SUCCESS                              |
 * | 2xx         | 202        | ACCEPTED (transactional async)       |
 * | 2xx         | >= 400     | Provider error (app-level failure)    |
 * | 2xx         | unknown    | PROTOCOL_ERROR                       |
 * | 2xx         | absent     | Allow endpoint-specific DTO handling  |
 */

import { ProviderErrorCode } from '@prisnames/registrar-core';
import { DynadotApiError } from './errors.js';

// ──────────────────────────────────────────────
// TYPES
// ──────────────────────────────────────────────

/**
 * Normalized Dynadot response envelope metadata.
 * Extracted from the top-level response body.
 */
export interface DynadotResponseMeta {
  /** Dynadot application-level status code (e.g. 200, 400, 401) */
  code?: number;
  /** Dynadot status message (e.g. "OK", "Bad Request") */
  message?: string;
  /** Dynadot error description (from error.description) */
  errorDescription?: string;
}

export type DynadotEnvelopeResult =
  | { status: 'SUCCESS'; meta: DynadotResponseMeta; data: unknown }
  | { status: 'ACCEPTED'; meta: DynadotResponseMeta; data: unknown }
  | { status: 'APP_ERROR'; meta: DynadotResponseMeta }
  | { status: 'PROTOCOL_ERROR'; meta: DynadotResponseMeta }
  | { status: 'NO_ENVELOPE'; rawData: unknown };

// ──────────────────────────────────────────────
// PARSER
// ──────────────────────────────────────────────

/**
 * Extract the Dynadot response envelope from a parsed JSON response body.
 *
 * Supports both observed casings:
 * - lowercase: code, message, error (sandbox observed)
 * - Pascal: Code, Message, Error (documentation examples)
 *
 * Does NOT recursively search nested objects for code fields.
 * Only inspects the top-level response object.
 */
export function parseDynadotEnvelope(body: unknown): DynadotEnvelopeResult {
  if (body === null || body === undefined || typeof body !== 'object') {
    return { status: 'NO_ENVELOPE', rawData: body };
  }

  const obj = body as Record<string, unknown>;

  // Extract code — support both casings
  const rawCode = obj.code ?? obj.Code;
  if (rawCode === undefined) {
    // No top-level application code — allow endpoint-specific handling
    return { status: 'NO_ENVELOPE', rawData: body };
  }

  const code = typeof rawCode === 'number' ? rawCode : Number(rawCode);
  if (!Number.isFinite(code)) {
    return { status: 'NO_ENVELOPE', rawData: body };
  }

  // Extract message — support both casings
  const rawMessage = obj.message ?? obj.Message;
  const message = typeof rawMessage === 'string' ? rawMessage : undefined;

  // Extract error description (from error.description)
  let errorDescription: string | undefined;
  const errorObj = obj.error ?? obj.Error;
  if (errorObj && typeof errorObj === 'object') {
    const desc = (errorObj as Record<string, unknown>).description ??
                 (errorObj as Record<string, unknown>).Description;
    if (typeof desc === 'string') {
      errorDescription = desc;
    }
  }

  const meta: DynadotResponseMeta = { code, message, errorDescription };

  // Decision matrix based on application code
  if (code === 200 || code === 201) {
    return { status: 'SUCCESS', meta, data: obj.data ?? obj.Data ?? obj };
  }

  if (code === 202) {
    return { status: 'ACCEPTED', meta, data: obj.data ?? obj.Data ?? obj };
  }

  if (code >= 400) {
    return { status: 'APP_ERROR', meta };
  }

  // Unrecognized application code — do not silently treat as success
  return { status: 'PROTOCOL_ERROR', meta };
}

// ──────────────────────────────────────────────
// ERROR MAPPING
// ──────────────────────────────────────────────

/**
 * Map a Dynadot application-level error code to our ProviderErrorCode taxonomy.
 * Centralizes both HTTP-layer and application-layer error classification.
 */
export function mapDynadotAppCode(appCode: number): ProviderErrorCode {
  if (appCode === 400) return ProviderErrorCode.VALIDATION_ERROR;
  if (appCode === 401) return ProviderErrorCode.AUTHENTICATION_ERROR;
  if (appCode === 402) return ProviderErrorCode.INSUFFICIENT_FUNDS;
  if (appCode === 403) return ProviderErrorCode.AUTHORIZATION_ERROR;
  if (appCode === 404) return ProviderErrorCode.DOMAIN_NOT_FOUND;
  if (appCode === 409) return ProviderErrorCode.DOMAIN_STATE_CONFLICT;
  if (appCode === 429) return ProviderErrorCode.RATE_LIMITED;
  if (appCode >= 500) return ProviderErrorCode.PROVIDER_UNAVAILABLE;
  return ProviderErrorCode.UNKNOWN;
}

/**
 * Create a DynadotApiError from an application-level envelope error.
 * Extracts only safe fields — does not expose raw Dynadot messages to customers.
 */
export function createAppLevelError(
  meta: DynadotResponseMeta,
  requestId: string,
): DynadotApiError {
  const errorCode = mapDynadotAppCode(meta.code ?? 500);

  // Build safe diagnostic message — no raw Dynadot error content exposed
  const safeMessage = `Dynadot application error: code ${meta.code}` +
    (meta.message ? ` (${meta.message})` : '');

  return new DynadotApiError(errorCode, safeMessage, {
    httpStatus: 200, // HTTP was 2xx but app code indicates error
    providerRequestId: requestId,
    retryable: meta.code === 429 || (meta.code !== undefined && meta.code >= 500),
    dynadotErrorCode: meta.code !== undefined ? String(meta.code) : undefined,
    dynadotErrorMessage: meta.errorDescription ?? meta.message,
  });
}
