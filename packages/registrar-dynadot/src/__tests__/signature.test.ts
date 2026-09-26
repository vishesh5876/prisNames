/**
 * PrisNames — Signature Tests (API + Webhook)
 *
 * Tests for both outbound API signing and inbound webhook verification.
 * Covers Base64 encoding, 4-part signed message, golden vectors,
 * and all required security edge cases.
 *
 * GOLDEN VECTOR PROVENANCE:
 * All expected signatures below were computed by an independent Node.js
 * reference script (not using the implementation under test).
 * Do NOT regenerate them using DynadotApiSignatureService.
 *
 * API signature string-to-sign:
 *   apiKey + "\n" + fullPathAndQuery + "\n" + (xRequestId || "") + "\n" + (requestBody || "")
 *   signature = base64(hmac-sha256(apiSecret, stringToSign))
 *
 * Webhook signature string-to-sign:
 *   webhookKey + "\n" + fullPathAndQuery + "\n" + (xRequestId || "") + "\n" + (requestBody || "")
 *   signature = base64(hmac-sha256(webhookSecret, stringToSign))
 *
 * The HTTP method is NOT part of the signed string (either direction).
 * The path and query are ONE exact value: fullPathAndQuery.
 * The X-Request-ID IS part of the signed string.
 */

import { describe, it, expect } from 'vitest';
import { createHmac } from 'node:crypto';
import { DynadotApiSignatureService } from '../api-signature.js';
import { DynadotWebhookSignatureVerifier } from '../webhook-signature.js';

// ── Test Constants ──

const API_KEY = 'test_api_key';
const API_SECRET = 'test_api_secret';
const WEBHOOK_KEY = 'wh-key-test-001';
const WEBHOOK_SECRET = 'wh-secret-test-001';

// ── Immutable Golden Vectors (computed independently, NOT by the SUT) ──

const GOLDEN = {
  /** Signed GET: path=/restful/v2/accounts/info, reqId=550e8400..., body="" */
  GET_ACCOUNT: 'cv+kSRJswKcuHlPnviuhQEVDyg2DB5Fkspnoo8iuy+s=',

  /** Signed GET with query: ?a=1&b=2 */
  QUERY_AB: 'TRIt0VMDE7y5spiS5Iv2arzgQckQ300Oa/8ET0UuN6I=',

  /** Signed GET with reversed query: ?b=2&a=1 */
  QUERY_BA: 'ox0fcONGXIF5K9A+fbPN9B4OmrO72Dzf1BWvLxcwL9o=',

  /** Signed POST: body={"domain":"example.com","years":1} */
  POST_REGISTER: 'mGoB/Yw9CLw4PhJ5y5Q6agSFrRAuCBb0OWEn96Vnd88=',

  /** Same as GET_ACCOUNT but with different API key */
  DIFF_API_KEY: '+StqSBGtwYgFLJHSfJJabYmkhAhaed4V2GmeIjrbIPI=',

  /** Same as GET_ACCOUNT but with empty request ID */
  NO_REQUEST_ID: 'OR98Qs87nWS22JKGRJlXxz6bFNjGh3wcKt9uvp2zYlw=',

  /** POST with compact JSON body {"x":1} */
  BODY_COMPACT: 'PJJb25cEaSFd9EhccKcNUw3b77JStAeAy3nEFuep2rY=',

  /** POST with pretty JSON body { "x": 1 } */
  BODY_PRETTY: 'Un3JxN8i7Th26zxGH4QpgZO/XFDuBTgBEy/Xk/HiYEE=',
} as const;

// Shared fixture values
const FIXED_UUID = '550e8400-e29b-41d4-a716-446655440000';
const FIXED_UUID_2 = '660e8400-e29b-41d4-a716-446655440001';

// ──────────────────────────────────────────────
// API SIGNATURE TESTS (outbound)
// ──────────────────────────────────────────────

describe('DynadotApiSignatureService', () => {
  const signer = new DynadotApiSignatureService(API_KEY, API_SECRET);

  // ── Golden Vectors (immutable, independently computed) ──

  describe('golden vectors', () => {
    it('GV1: signed GET — account info', () => {
      const sig = signer.sign('/restful/v2/accounts/info', FIXED_UUID, '');
      expect(sig).toBe(GOLDEN.GET_ACCOUNT);
    });

    it('GV2a: signed GET with query ?a=1&b=2', () => {
      const sig = signer.sign('/restful/v2/domains/search?a=1&b=2', FIXED_UUID, '');
      expect(sig).toBe(GOLDEN.QUERY_AB);
    });

    it('GV2b: signed GET with reversed query ?b=2&a=1 produces DIFFERENT signature', () => {
      const sig = signer.sign('/restful/v2/domains/search?b=2&a=1', FIXED_UUID, '');
      expect(sig).toBe(GOLDEN.QUERY_BA);
      expect(sig).not.toBe(GOLDEN.QUERY_AB);
    });

    it('GV3: signed POST with JSON body', () => {
      const body = '{"domain":"example.com","years":1}';
      const sig = signer.sign('/restful/v2/domains/example.com/register', FIXED_UUID_2, body);
      expect(sig).toBe(GOLDEN.POST_REGISTER);
    });
  });

  // ── Input Sensitivity ──

  describe('input sensitivity', () => {
    it('changing API key changes signature', () => {
      const otherSigner = new DynadotApiSignatureService('different_api_key', API_SECRET);
      const sig = otherSigner.sign('/restful/v2/accounts/info', FIXED_UUID, '');
      expect(sig).toBe(GOLDEN.DIFF_API_KEY);
      expect(sig).not.toBe(GOLDEN.GET_ACCOUNT);
    });

    it('changing API secret changes signature', () => {
      const otherSigner = new DynadotApiSignatureService(API_KEY, 'different_secret');
      const sig = otherSigner.sign('/restful/v2/accounts/info', FIXED_UUID, '');
      expect(sig).not.toBe(GOLDEN.GET_ACCOUNT);
    });

    it('changing request ID changes signature', () => {
      const sig1 = signer.sign('/restful/v2/accounts/info', 'req-1', '');
      const sig2 = signer.sign('/restful/v2/accounts/info', 'req-2', '');
      expect(sig1).not.toBe(sig2);
    });

    it('changing one body byte changes signature', () => {
      const sig1 = signer.sign('/restful/v2/test', FIXED_UUID, '{"a":1}');
      const sig2 = signer.sign('/restful/v2/test', FIXED_UUID, '{"a":2}');
      expect(sig1).not.toBe(sig2);
    });

    it('changing path changes signature', () => {
      const sig1 = signer.sign('/restful/v2/domains/a.com/info', FIXED_UUID, '');
      const sig2 = signer.sign('/restful/v2/domains/b.com/info', FIXED_UUID, '');
      expect(sig1).not.toBe(sig2);
    });

    it('body whitespace changes signature', () => {
      const sigCompact = signer.sign(
        '/restful/v2/domains/example.com/register', FIXED_UUID_2, '{"x":1}'
      );
      const sigPretty = signer.sign(
        '/restful/v2/domains/example.com/register', FIXED_UUID_2, '{ "x": 1 }'
      );
      expect(sigCompact).toBe(GOLDEN.BODY_COMPACT);
      expect(sigPretty).toBe(GOLDEN.BODY_PRETTY);
      expect(sigCompact).not.toBe(sigPretty);
    });

    it('missing request ID uses empty string in signed message', () => {
      const sig = signer.sign('/restful/v2/accounts/info', '', '');
      expect(sig).toBe(GOLDEN.NO_REQUEST_ID);
      expect(sig).not.toBe(GOLDEN.GET_ACCOUNT);
    });
  });

  // ── Method Independence ──

  describe('method independence', () => {
    it('HTTP method does NOT affect the signature', () => {
      // The signer.sign() does not take method — it only signs
      // apiKey + path + reqId + body. Two requests with different methods
      // but same path/body/reqId produce the SAME signature.
      // This is correct per Dynadot REST v2 docs.
      const sig = signer.sign('/restful/v2/accounts/info', FIXED_UUID, '');
      expect(sig).toBe(GOLDEN.GET_ACCOUNT);
      // If this were a POST to the same path with same body, same sig.
      // The signer API intentionally does not accept method.
    });

    it('signer API does not accept HTTP method parameter', () => {
      // Verify the .sign() method signature only takes 3 args
      expect(signer.sign.length).toBe(3);
    });
  });

  // ── Encoding ──

  describe('encoding', () => {
    it('produces valid standard Base64', () => {
      const sig = signer.sign('/restful/v2/accounts/info', FIXED_UUID, '');
      const decoded = Buffer.from(sig, 'base64');
      // Round-trip: decode then encode should give same string
      expect(decoded.toString('base64')).toBe(sig);
      // SHA-256 output is always 32 bytes
      expect(decoded.length).toBe(32);
    });

    it('output does NOT contain hex characters only', () => {
      const sig = signer.sign('/restful/v2/test', FIXED_UUID, '{"test":true}');
      // Base64 typically contains +, /, = which hex doesn't
      // At minimum, the length should be 44 (base64 of 32 bytes)
      expect(sig.length).toBe(44);
      // Hex would be 64 characters
      expect(sig.length).not.toBe(64);
    });
  });
});

// ──────────────────────────────────────────────
// WEBHOOK SIGNATURE TESTS (inbound)
// ──────────────────────────────────────────────

describe('DynadotWebhookSignatureVerifier', () => {
  const verifier = new DynadotWebhookSignatureVerifier({
    webhookKey: WEBHOOK_KEY,
    webhookSecret: WEBHOOK_SECRET,
  });

  // Helper: compute the correct signature independently for a test
  function computeExpected(
    path: string,
    requestId: string,
    body: string,
  ): string {
    const stringToSign = WEBHOOK_KEY + '\n' + path + '\n' + requestId + '\n' + body;
    return createHmac('sha256', WEBHOOK_SECRET).update(stringToSign).digest('base64');
  }

  describe('computeSignature', () => {
    it('produces standard Base64 encoded HMAC-SHA256', () => {
      const rawBody = Buffer.from('{"event_type":"domain.create","event_id":12345}');
      const sig = verifier.computeSignature('/api/v1/webhooks/dynadot', 'req-1', rawBody);

      const decoded = Buffer.from(sig, 'base64');
      expect(decoded.toString('base64')).toBe(sig); // valid canonical Base64
      expect(decoded.length).toBe(32); // SHA-256 = 32 bytes
    });

    it('golden vector: matches independently computed HMAC', () => {
      const path = '/api/v1/webhooks/dynadot';
      const requestId = 'req-golden-1';
      const bodyStr = '{"event_type":"domain.create","event_id":12345}';
      const rawBody = Buffer.from(bodyStr);

      const expected = computeExpected(path, requestId, bodyStr);
      const actual = verifier.computeSignature(path, requestId, rawBody);
      expect(actual).toBe(expected);
    });
  });

  describe('verifySignature', () => {
    const testPath = '/api/v1/webhooks/dynadot';
    const testRequestId = 'req-verify-1';
    const testBody = '{"event_type":"domain.create","event_id":99999}';
    const testRawBody = Buffer.from(testBody);

    it('valid Base64 signature succeeds', () => {
      const validSig = computeExpected(testPath, testRequestId, testBody);
      const result = verifier.verifySignature({
        fullPathAndQuery: testPath,
        xRequestId: testRequestId,
        rawBody: testRawBody,
        providedSignature: validSig,
      });
      expect(result).toBe(true);
    });

    it('hex signature fails (wrong encoding)', () => {
      // Compute correct HMAC but encode as hex instead of Base64
      const stringToSign = WEBHOOK_KEY + '\n' + testPath + '\n' + testRequestId + '\n' + testBody;
      const hexSig = createHmac('sha256', WEBHOOK_SECRET).update(stringToSign).digest('hex');

      const result = verifier.verifySignature({
        fullPathAndQuery: testPath,
        xRequestId: testRequestId,
        rawBody: testRawBody,
        providedSignature: hexSig,
      });
      expect(result).toBe(false);
    });

    it('wrong path fails', () => {
      const validSig = computeExpected(testPath, testRequestId, testBody);
      const result = verifier.verifySignature({
        fullPathAndQuery: '/api/v2/webhooks/dynadot', // wrong path
        xRequestId: testRequestId,
        rawBody: testRawBody,
        providedSignature: validSig,
      });
      expect(result).toBe(false);
    });

    it('changed query ordering fails', () => {
      const pathA = '/api/v1/webhooks/dynadot?a=1&b=2';
      const pathB = '/api/v1/webhooks/dynadot?b=2&a=1';
      const rawBody = Buffer.from(testBody);

      const sigForA = computeExpected(pathA, testRequestId, testBody);

      // Signature computed for ?a=1&b=2 must NOT verify against ?b=2&a=1
      const result = verifier.verifySignature({
        fullPathAndQuery: pathB,
        xRequestId: testRequestId,
        rawBody: rawBody,
        providedSignature: sigForA,
      });
      expect(result).toBe(false);

      // But it must verify against the original path
      const correctResult = verifier.verifySignature({
        fullPathAndQuery: pathA,
        xRequestId: testRequestId,
        rawBody: rawBody,
        providedSignature: sigForA,
      });
      expect(correctResult).toBe(true);
    });

    it('changed X-Request-ID fails', () => {
      const validSig = computeExpected(testPath, testRequestId, testBody);
      const result = verifier.verifySignature({
        fullPathAndQuery: testPath,
        xRequestId: 'different-request-id',
        rawBody: testRawBody,
        providedSignature: validSig,
      });
      expect(result).toBe(false);
    });

    it('one-byte body modification fails', () => {
      const validSig = computeExpected(testPath, testRequestId, testBody);
      // Modify one byte in body
      const modified = Buffer.from(testBody);
      modified[modified.length - 2] = modified[modified.length - 2]! + 1;

      const result = verifier.verifySignature({
        fullPathAndQuery: testPath,
        xRequestId: testRequestId,
        rawBody: modified,
        providedSignature: validSig,
      });
      expect(result).toBe(false);
    });

    it('JSON reserialization fails when bytes differ', () => {
      // Original has no spaces
      const originalBody = '{"event_type":"domain.create","event_id":12345}';
      const validSig = computeExpected(testPath, testRequestId, originalBody);

      // Pretty-printed is semantically identical JSON but different bytes
      const reserializedBody = '{ "event_type": "domain.create", "event_id": 12345 }';

      const result = verifier.verifySignature({
        fullPathAndQuery: testPath,
        xRequestId: testRequestId,
        rawBody: Buffer.from(reserializedBody),
        providedSignature: validSig,
      });
      expect(result).toBe(false);
    });

    it('standard Base64 expected value matches independently generated vector', () => {
      // Fully independent: compute everything from scratch
      const path = '/webhook/test';
      const reqId = 'independent-req-id';
      const body = '{"test":"vector"}';

      const stringToSign = WEBHOOK_KEY + '\n' + path + '\n' + reqId + '\n' + body;
      const independentSig = createHmac('sha256', WEBHOOK_SECRET).update(stringToSign).digest('base64');

      // Create a fresh verifier to avoid any shared state
      const freshVerifier = new DynadotWebhookSignatureVerifier({
        webhookKey: WEBHOOK_KEY,
        webhookSecret: WEBHOOK_SECRET,
      });

      const result = freshVerifier.verifySignature({
        fullPathAndQuery: path,
        xRequestId: reqId,
        rawBody: Buffer.from(body),
        providedSignature: independentSig,
      });
      expect(result).toBe(true);
    });

    it('rejects empty signature', () => {
      const result = verifier.verifySignature({
        fullPathAndQuery: testPath,
        xRequestId: testRequestId,
        rawBody: testRawBody,
        providedSignature: '',
      });
      expect(result).toBe(false);
    });

    it('rejects malformed Base64 (invalid chars)', () => {
      const result = verifier.verifySignature({
        fullPathAndQuery: testPath,
        xRequestId: testRequestId,
        rawBody: testRawBody,
        providedSignature: '!!!not-base64!!!',
      });
      expect(result).toBe(false);
    });

    it('rejects truncated Base64 (wrong length after decode)', () => {
      // Valid Base64 but decodes to 16 bytes instead of 32
      const shortSig = Buffer.alloc(16, 0xab).toString('base64');
      const result = verifier.verifySignature({
        fullPathAndQuery: testPath,
        xRequestId: testRequestId,
        rawBody: testRawBody,
        providedSignature: shortSig,
      });
      expect(result).toBe(false);
    });

    it('rejects overlong Base64 (wrong length after decode)', () => {
      const longSig = Buffer.alloc(64, 0xcd).toString('base64');
      const result = verifier.verifySignature({
        fullPathAndQuery: testPath,
        xRequestId: testRequestId,
        rawBody: testRawBody,
        providedSignature: longSig,
      });
      expect(result).toBe(false);
    });
  });

  describe('verifyBearerKey (constant-time)', () => {
    it('correct Bearer key returns true', () => {
      expect(verifier.verifyBearerKey(WEBHOOK_KEY)).toBe(true);
    });

    it('wrong Bearer key returns false', () => {
      expect(verifier.verifyBearerKey('wrong-key')).toBe(false);
    });

    it('empty Bearer key returns false', () => {
      expect(verifier.verifyBearerKey('')).toBe(false);
    });

    it('different length key returns false', () => {
      expect(verifier.verifyBearerKey('short')).toBe(false);
    });

    it('near-match key returns false', () => {
      // Same length, one char different
      const nearMatch = WEBHOOK_KEY.slice(0, -1) + 'X';
      expect(verifier.verifyBearerKey(nearMatch)).toBe(false);
    });
  });

  describe('credential isolation', () => {
    it('webhook verifier uses different credentials than API signer', () => {
      const apiSigner = new DynadotApiSignatureService(API_KEY, API_SECRET);
      const webhookVerifier = new DynadotWebhookSignatureVerifier({
        webhookKey: WEBHOOK_KEY,
        webhookSecret: WEBHOOK_SECRET,
      });

      // Same inputs, different outputs (different keys)
      const path = '/restful/v2/test';
      const reqId = 'req-1';
      const body = '{"test":true}';
      const rawBody = Buffer.from(body);

      const apiSig = apiSigner.sign(path, reqId, body);
      const webhookSig = webhookVerifier.computeSignature(path, reqId, rawBody);

      expect(apiSig).not.toBe(webhookSig);
    });

    it('API signature does NOT verify as webhook signature', () => {
      const apiSigner = new DynadotApiSignatureService(API_KEY, API_SECRET);
      const webhookVerifier = new DynadotWebhookSignatureVerifier({
        webhookKey: WEBHOOK_KEY,
        webhookSecret: WEBHOOK_SECRET,
      });

      const path = '/api/v1/webhooks/dynadot';
      const reqId = 'req-cross-1';
      const body = '{"event_type":"test"}';

      const apiSig = apiSigner.sign(path, reqId, body);
      const result = webhookVerifier.verifySignature({
        fullPathAndQuery: path,
        xRequestId: reqId,
        rawBody: Buffer.from(body),
        providedSignature: apiSig,
      });
      expect(result).toBe(false);
    });
  });
});
