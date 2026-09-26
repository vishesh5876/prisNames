/**
 * PrisNames — Dynadot Webhook Signature Verifier
 *
 * Inbound webhook signature verification.
 * Uses WEBHOOK key + WEBHOOK secret credentials (separate from API credentials).
 *
 * Signed message format (REST v2 docs §3.2):
 *   webhookKey + "\n" + fullPathAndQuery + "\n" + (xRequestId || "") + "\n" + (requestBody || "")
 *
 * HMAC key: webhookSecret
 * Encoding: standard Base64
 *
 * The configured webhookKey is always used as part of the signed message.
 * The Bearer token from the Authorization header is compared INDEPENDENTLY
 * against the configured webhookKey — it is NOT used as signing key material.
 *
 * Security:
 * - Operates on raw byte arrays — never re-parse/re-serialize
 * - Uses constant-time comparison via timingSafeEqual
 * - Validates Base64 format and decoded HMAC length before comparison
 * - Bearer key comparison also uses timingSafeEqual where practical
 */

import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Configuration for the webhook signature verifier.
 * Both fields come from the Dynadot webhook configuration.
 */
export interface WebhookVerifierConfig {
  /** The webhook key (used as part of the signed message AND for Bearer auth comparison). */
  readonly webhookKey: string;
  /** The webhook secret (used as the HMAC key). */
  readonly webhookSecret: string;
}

/**
 * Parameters for signature verification.
 * All fields come from the incoming HTTP request.
 */
export interface WebhookVerifyParams {
  /** The original raw URL path + query string (e.g. "/api/v1/webhooks/dynadot?foo=bar"). */
  readonly fullPathAndQuery: string;
  /** The X-Request-ID header value (empty string if absent). */
  readonly xRequestId: string;
  /** The exact raw request body bytes — NEVER re-serialized. */
  readonly rawBody: Buffer;
  /** The X-Signature header value (expected: standard Base64 encoded HMAC-SHA256). */
  readonly providedSignature: string;
}

const HMAC_SHA256_DIGEST_LENGTH = 32;

export class DynadotWebhookSignatureVerifier {
  private readonly webhookKey: string;
  private readonly webhookSecret: string;

  constructor(config: WebhookVerifierConfig) {
    this.webhookKey = config.webhookKey;
    this.webhookSecret = config.webhookSecret;
  }

  /**
   * Compute the Base64 HMAC-SHA256 signature for a webhook request.
   *
   * @returns Standard Base64 encoded HMAC-SHA256 digest
   */
  computeSignature(fullPathAndQuery: string, xRequestId: string, rawBody: Buffer): string {
    const stringToSign =
      this.webhookKey + '\n' +
      fullPathAndQuery + '\n' +
      (xRequestId || '') + '\n' +
      rawBody.toString('utf-8');

    return createHmac('sha256', this.webhookSecret)
      .update(stringToSign)
      .digest('base64');
  }

  /**
   * Verify that a provided X-Signature matches the expected HMAC.
   *
   * Steps:
   * 1. Reject empty/missing inputs
   * 2. Compute expected HMAC over webhookKey + "\n" + path + "\n" + requestId + "\n" + body
   * 3. Validate provided signature is valid standard Base64
   * 4. Decode both to binary and verify length == 32 bytes
   * 5. Compare with timingSafeEqual
   */
  verifySignature(params: WebhookVerifyParams): boolean {
    const { fullPathAndQuery, xRequestId, rawBody, providedSignature } = params;

    if (!providedSignature || !this.webhookSecret || !this.webhookKey) {
      return false;
    }

    // Step 1: Compute expected signature (base64)
    const expectedBase64 = this.computeSignature(fullPathAndQuery, xRequestId, rawBody);

    // Step 2: Validate provided signature is valid standard Base64
    let providedBytes: Buffer;
    try {
      providedBytes = Buffer.from(providedSignature, 'base64');
      // Reject non-canonical Base64 (roundtrip check)
      if (providedBytes.toString('base64') !== providedSignature) {
        return false;
      }
    } catch {
      return false;
    }

    // Step 3: Verify decoded length is exactly 32 bytes (SHA-256 digest)
    if (providedBytes.length !== HMAC_SHA256_DIGEST_LENGTH) {
      return false;
    }

    // Step 4: Decode expected signature
    const expectedBytes = Buffer.from(expectedBase64, 'base64');
    if (expectedBytes.length !== HMAC_SHA256_DIGEST_LENGTH) {
      // Should never happen with SHA-256, but defensive
      return false;
    }

    // Step 5: Constant-time comparison
    return timingSafeEqual(expectedBytes, providedBytes);
  }

  /**
   * Verify that the presented Bearer token matches the configured webhook key.
   * Uses constant-time comparison to prevent timing attacks.
   *
   * This is independent of HMAC signature verification.
   * The Bearer token must match the configured webhookKey BEFORE HMAC is checked.
   */
  verifyBearerKey(presentedBearerToken: string): boolean {
    if (!presentedBearerToken || !this.webhookKey) {
      return false;
    }

    // Use constant-time comparison for Bearer key
    try {
      const presentedBuf = Buffer.from(presentedBearerToken, 'utf-8');
      const expectedBuf = Buffer.from(this.webhookKey, 'utf-8');

      if (presentedBuf.length !== expectedBuf.length) {
        return false;
      }

      return timingSafeEqual(presentedBuf, expectedBuf);
    } catch {
      return false;
    }
  }
}
