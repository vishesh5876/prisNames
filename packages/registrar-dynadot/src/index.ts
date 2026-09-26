/**
 * PrisNames — registrar-dynadot
 *
 * Dynadot REST v2 API adapter for the registrar abstraction layer.
 *
 * IMPORTANT: DTOs are internal and NOT exported from this package root.
 * Tests use relative imports for DTOs.
 */

export { DynadotRegistrarProvider } from './provider.js';
export { getDynadotConfig, clearDynadotConfigCache, createDynadotConfig } from './config.js';
export type { DynadotConfig } from './config.js';
export { DynadotApiSignatureService } from './api-signature.js';
export { DynadotWebhookSignatureVerifier } from './webhook-signature.js';
export type { WebhookVerifierConfig, WebhookVerifyParams } from './webhook-signature.js';
export { DynadotRateLimiter } from './rate-limiter.js';
export type { RateLimiterConfig, LeaseResult } from './rate-limiter.js';
export { DynadotHttpClient } from './http-client.js';
export type { HttpClientConfig, DynadotApiResponse, RequestOptions } from './http-client.js';
export { DynadotApiError, mapDynadotErrorCode } from './errors.js';
export { ENDPOINTS } from './endpoints.js';
export type { EndpointDescriptor, EndpointName } from './endpoints.js';
export {
  generateWebhookJobId,
  isBullMQCompatibleJobId,
} from './webhook-job-id.js';
export {
  WEBHOOK_ACK_RESPONSE,
  DYNADOT_WEBHOOK_EVENT_TYPES,
  normalizeEventId,
  DynadotWebhookEnvelopeSchema,
} from './dto/webhook.dto.js';
