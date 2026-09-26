/**
 * PrisNames — Dynadot API Signature Service
 *
 * Outbound REST v2 request signing.
 * Uses API key + API secret credentials.
 *
 * String-to-sign format (from REST v2 docs §6.2):
 *   apiKey + "\n" + fullPathAndQuery + "\n" + (xRequestId || "") + "\n" + (requestBody || "")
 *   signature = base64(hmac-sha256(apiSecret, stringToSign))
 *
 * Rules:
 * - Construct the final URL once, preserve exact path + query order
 * - Create body string once, do NOT JSON.stringify twice
 * - fullPathAndQuery starts with /restful/v2/..., no scheme/host
 * - For GET/no-body requests, use empty body string
 * - Do NOT sort query parameters after signing
 * - Do NOT mutate body after signing
 *
 * This service is SEPARATE from DynadotWebhookSignatureVerifier.
 * Do not mix API credentials with webhook credentials.
 */

import { createHmac } from 'node:crypto';

export class DynadotApiSignatureService {
  private readonly apiKey: string;
  private readonly apiSecret: string;

  constructor(apiKey: string, apiSecret: string) {
    this.apiKey = apiKey;
    this.apiSecret = apiSecret;
  }

  /**
   * Sign an outbound API request.
   *
   * @param fullPathAndQuery - The path + query string, e.g. "/restful/v2/domains/example.com/register"
   *                           Must NOT include scheme or host.
   * @param xRequestId - The X-Request-ID header value (UUID)
   * @param body - The exact request body string (empty string for GET requests)
   * @returns Base64-encoded HMAC-SHA256 signature
   */
  sign(fullPathAndQuery: string, xRequestId: string, body: string): string {
    const stringToSign = this.apiKey + '\n' + fullPathAndQuery + '\n' + xRequestId + '\n' + body;
    return createHmac('sha256', this.apiSecret)
      .update(stringToSign)
      .digest('base64');
  }
}
