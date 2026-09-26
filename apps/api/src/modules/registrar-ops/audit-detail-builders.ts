/**
 * PrisNames — Audit Detail Builders
 *
 * Typed, allowlisted, redaction-enforced builders for audit log details.
 * Only normalized fields pass through — secret/PII shaped keys are rejected.
 *
 * Reference: Phase 6 Implementation Plan §13
 */

// ──────────────────────────────────────────────
// SECRET/PII DETECTION
// ──────────────────────────────────────────────

const FORBIDDEN_KEY_PATTERNS = [
  'api_key', 'secret', 'authorization', 'x-signature', 'password',
  'token', 'cookie', 'credential', 'auth_code', 'private_key',
];

const FORBIDDEN_VALUE_PATTERNS = [
  /^Bearer\s+/i,
  /^sk_[a-zA-Z0-9]/,
  /^[A-Za-z0-9+/]{20,}={0,2}$/,  // base64-ish long strings
];

const PII_KEY_PATTERNS = [
  'email', 'phone', 'address', 'contact', 'first_name', 'last_name',
  'postal_code', 'zip_code',
];

function isForbiddenKey(key: string): boolean {
  const lower = key.toLowerCase();
  return FORBIDDEN_KEY_PATTERNS.some(p => lower.includes(p))
    || PII_KEY_PATTERNS.some(p => lower.includes(p));
}

function isForbiddenValue(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  return FORBIDDEN_VALUE_PATTERNS.some(p => p.test(value));
}

// ──────────────────────────────────────────────
// REDACTION
// ──────────────────────────────────────────────

export type AuditDetails = Record<string, string | number | boolean | null>;

function sanitizeDetails(raw: Record<string, unknown>): AuditDetails {
  const result: AuditDetails = {};
  for (const [key, value] of Object.entries(raw)) {
    if (isForbiddenKey(key)) continue;
    if (isForbiddenValue(value)) continue;
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' || value === null) {
      result[key] = value;
    }
    // Skip objects/arrays — only flat, typed fields
  }
  return result;
}

// ──────────────────────────────────────────────
// BUILDERS
// ──────────────────────────────────────────────

export function statusChangeDetails(from: string, to: string, reason?: string): AuditDetails {
  return sanitizeDetails({ from_status: from, to_status: to, ...(reason ? { reason } : {}) });
}

export function providerResultDetails(httpStatus: number, errorCode?: string): AuditDetails {
  return sanitizeDetails({ http_status: httpStatus, ...(errorCode ? { error_code: errorCode } : {}) });
}

export function reconciliationAttemptDetails(
  attempt: number,
  method: string,
  found: boolean,
): AuditDetails {
  return sanitizeDetails({ attempt, method, found });
}

export function manualReviewDetails(
  action: string,
  reason: string,
  evidence?: string,
): AuditDetails {
  return sanitizeDetails({ action, reason, ...(evidence ? { evidence_ref: evidence } : {}) });
}

export function claimAcquiredDetails(workerId: string, claimVersion: number): AuditDetails {
  return sanitizeDetails({ worker_id: workerId, claim_version: claimVersion });
}

export function claimExpiredDetails(workerId: string, durationMs: number): AuditDetails {
  return sanitizeDetails({ worker_id: workerId, duration_ms: durationMs });
}

export function retryScheduledDetails(attempt: number, nextRetryAt: Date): AuditDetails {
  return sanitizeDetails({ attempt, next_retry_at: nextRetryAt.toISOString() });
}

export function webhookCorrelationDetails(
  providerEventId: string,
  matched: boolean,
): AuditDetails {
  return sanitizeDetails({ provider_event_id: providerEventId, matched });
}
