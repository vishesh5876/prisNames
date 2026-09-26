/**
 * PrisNames — Deterministic Webhook Job ID
 *
 * BullMQ custom job IDs must NOT contain ':' (reserved as separator).
 * Provider event IDs may contain unsafe/unbounded characters.
 *
 * Strategy:
 * - If the providerEventId is safe (alphanumeric, dash, underscore, dot, ≤100 chars),
 *   use it directly.
 * - Otherwise, derive a deterministic safe ID using sha256 hash.
 *
 * The database UNIQUE(provider, provider_event_id) constraint remains
 * the primary deduplication authority.
 * BullMQ job ID is the queue-level secondary protection.
 */

import { createHash } from 'node:crypto';

/** Characters that are safe for BullMQ job IDs */
const SAFE_CHARS_RE = /^[a-zA-Z0-9._-]+$/;
const MAX_SAFE_LENGTH = 100;

/**
 * Generate a deterministic, BullMQ-compatible job ID for a webhook event.
 *
 * @param provider - Provider identifier (e.g. "dynadot")
 * @param providerEventId - The provider's event ID (may be numeric or string)
 * @returns A deterministic job ID safe for BullMQ (no ':' characters)
 */
export function generateWebhookJobId(provider: string, providerEventId: string): string {
  const prefix = `webhook_${provider}_`;

  // If the event ID is safe and short enough, use it directly
  if (
    providerEventId.length <= MAX_SAFE_LENGTH &&
    SAFE_CHARS_RE.test(providerEventId) &&
    !providerEventId.includes(':')
  ) {
    return `${prefix}${providerEventId}`;
  }

  // Otherwise derive a safe deterministic ID via hash
  const hash = createHash('sha256')
    .update(`${provider}:${providerEventId}`)
    .digest('hex')
    .slice(0, 32); // 128 bits of uniqueness is sufficient

  return `${prefix}h_${hash}`;
}

/**
 * Validate that a job ID is BullMQ-compatible.
 * BullMQ job IDs must not contain ':' (used as Redis key separator).
 */
export function isBullMQCompatibleJobId(jobId: string): boolean {
  return !jobId.includes(':') && jobId.length > 0 && jobId.length <= 200;
}
