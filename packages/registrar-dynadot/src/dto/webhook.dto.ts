/**
 * PrisNames — Dynadot Webhook DTOs
 *
 * Strict validation for webhook event envelopes.
 *
 * event_id handling (correction #7):
 * - Dynadot sends numeric event_id
 * - Accept as safe integer only: z.number().int().safe().nonnegative()
 * - Normalize to string immediately for database deduplication
 * - Reject unsafe JavaScript integers (> Number.MAX_SAFE_INTEGER)
 *
 * Response format (correction #10):
 * - Acknowledge with HTTP 200 + { "Status": "200" }
 * - Do NOT use 201, 202, or 204 for webhook acknowledgement
 */

import { z } from 'zod';

// ──────────────────────────────────────────────
// WEBHOOK ENVELOPE
// ──────────────────────────────────────────────

/**
 * The outer webhook envelope from Dynadot.
 * event_id is numeric in the documented examples.
 */
export const DynadotWebhookEnvelopeSchema = z.object({
  event_id: z.union([
    // Numeric form — must be safe integer
    z.number().int().safe().nonnegative(),
    // String form — allow for forward compatibility
    z.string().min(1).max(100),
  ]),
  event_type: z.string().min(1).max(100),
  event_date: z.string().optional(),
  data: z.record(z.unknown()).optional().default({}),
});

export type DynadotWebhookEnvelope = z.infer<typeof DynadotWebhookEnvelopeSchema>;

/**
 * Normalize the event_id to a string for database storage/deduplication.
 * Safe integers are converted directly; strings pass through.
 */
export function normalizeEventId(eventId: number | string): string {
  return String(eventId);
}

// ──────────────────────────────────────────────
// WEBHOOK ACKNOWLEDGEMENT
// ──────────────────────────────────────────────

/**
 * Standard webhook acknowledgement response per Dynadot documentation.
 * HTTP 200 + this body.
 */
export const WEBHOOK_ACK_RESPONSE = { Status: '200' } as const;

// ──────────────────────────────────────────────
// KNOWN EVENT TYPES
// ──────────────────────────────────────────────

export const DYNADOT_WEBHOOK_EVENT_TYPES = {
  DOMAIN_REGISTERED: 'domain_registered',
  DOMAIN_RENEWED: 'domain_renewed',
  DOMAIN_TRANSFERRED_IN: 'domain_transferred_in',
  DOMAIN_TRANSFERRED_AWAY: 'domain_transferred_away',
  DOMAIN_EXPIRED: 'domain_expired',
  DOMAIN_DELETED: 'domain_deleted',
  DOMAIN_RESTORED: 'domain_restored',
  TRANSFER_STATUS_CHANGED: 'transfer_status_changed',
  DOMAIN_AUTO_RENEWED: 'domain_auto_renewed',
} as const;
