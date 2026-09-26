/**
 * PrisNames — Provider Webhook Event Types (Discriminated Union)
 *
 * Provider-neutral event types that registrar adapters emit.
 * Each event type exposes only provider-neutral, allowlisted fields.
 * No arbitrary metadata — typed discriminated union only.
 *
 * Reference: Phase 6 Implementation Plan §11.1
 */

// ──────────────────────────────────────────────
// PROVIDER WEBHOOK EVENTS
// ──────────────────────────────────────────────

export type ProviderWebhookEvent =
  | ProviderOrderCompletedEvent
  | ProviderDomainStatusChangedEvent
  | ProviderDomainExpiringEvent;

interface ProviderWebhookEventBase {
  readonly providerIdentity: string;
  readonly providerEventId: string;
  readonly occurredAt?: Date;
}

export interface ProviderOrderCompletedEvent extends ProviderWebhookEventBase {
  readonly eventType: 'ORDER_COMPLETED';
  readonly providerOrderId: string;
  readonly orderStatus: 'completed' | 'failed';
  readonly domain?: string;
  readonly operationType?: string;
  readonly expiresAt?: Date;
}

export interface ProviderDomainStatusChangedEvent extends ProviderWebhookEventBase {
  readonly eventType: 'DOMAIN_STATUS_CHANGED';
  readonly domain: string;
  readonly newStatus: string;
  readonly expiresAt?: Date;
}

export interface ProviderDomainExpiringEvent extends ProviderWebhookEventBase {
  readonly eventType: 'DOMAIN_EXPIRING';
  readonly domain: string;
  readonly expiresAt: Date;
}
