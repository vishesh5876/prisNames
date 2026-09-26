/**
 * PrisNames — Dynadot Webhook Controller
 *
 * Receives webhooks from Dynadot, validates signature, and persists durably.
 *
 * Flow:
 * 1. Verify HMAC-SHA256 signature on raw bytes (constant-time)
 * 2. Parse + validate envelope (safe integer event_id)
 * 3. Encrypt raw payload → envelope encryption
 * 4. Atomic INSERT with ON CONFLICT DO NOTHING (database dedup)
 * 5. Queue deterministic BullMQ job (secondary dedup)
 * 6. Update processing_status: RECEIVED → QUEUED
 * 7. Return HTTP 200 + { "Status": "200" }
 *
 * Security:
 * - @Public() — bypasses auth guard (webhooks are not user-authenticated)
 * - CSRF naturally bypassed (no session cookie on webhook requests)
 * - Content-Type enforcement: application/json only
 * - Body size enforcement via Fastify limits
 *
 * Provider retry behavior:
 * - 401/403 → invalid auth/signature
 * - 4xx → malformed request
 * - 5xx → infrastructure failure (return so provider may retry)
 * - Provider retry schedule is UNKNOWN until verified (correction #6)
 *
 * Reference: REGISTRAR_ARCHITECTURE.md §Webhook Ingestion
 */

import {
  Controller,
  Post,
  Req,
  Res,
  Logger,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { Public } from '../auth/decorators/public.decorator.js';
import type { WebhookIngestionService } from './webhook-ingestion.service.js';

@Controller('webhooks/dynadot')
export class DynadotWebhookController {
  private readonly logger = new Logger(DynadotWebhookController.name);

  constructor(
    private readonly ingestionService: WebhookIngestionService,
  ) {}

  /**
   * POST /api/v1/webhooks/dynadot
   *
   * @Public — no auth guard or session required
   * CSRF bypassed naturally — no session cookie present
   */
  @Public()
  @Post()
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Req() request: FastifyRequest,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    const requestId = (request.headers['x-request-id'] as string) || '';

    // Verify content type
    const contentType = request.headers['content-type'];
    if (!contentType?.includes('application/json')) {
      this.logger.warn(`Webhook rejected: invalid content-type [${requestId}]`);
      reply.status(HttpStatus.UNSUPPORTED_MEDIA_TYPE).send({
        error: 'Content-Type must be application/json',
      });
      return;
    }

    // Get raw body (enabled via rawBody: true in bootstrap)
    const rawBody = (request as FastifyRequest & { rawBody?: Buffer }).rawBody;
    if (!rawBody || rawBody.length === 0) {
      this.logger.warn(`Webhook rejected: empty body [${requestId}]`);
      reply.status(HttpStatus.BAD_REQUEST).send({
        error: 'Empty request body',
      });
      return;
    }

    // Get signature header
    const signature = request.headers['x-signature'] as string | undefined;
    if (!signature) {
      this.logger.warn(`Webhook rejected: missing X-Signature [${requestId}]`);
      reply.status(HttpStatus.UNAUTHORIZED).send({
        error: 'Missing X-Signature header',
      });
      return;
    }

    // Extract Bearer token from Authorization header (correction #10)
    const authHeader = request.headers['authorization'] as string | undefined;
    let bearerToken: string | undefined;
    if (authHeader?.startsWith('Bearer ')) {
      bearerToken = authHeader.slice(7);
    }

    if (!bearerToken) {
      this.logger.warn(`Webhook rejected: missing or invalid Authorization Bearer [${requestId}]`);
      reply.status(HttpStatus.UNAUTHORIZED).send({
        error: 'Missing or invalid Authorization Bearer',
      });
      return;
    }

    try {
      // Use the original raw HTTP request URL to preserve exact path + query ordering.
      // INFRASTRUCTURE REQUIREMENT: The public webhook path must not be rewritten by
      // a reverse proxy between Dynadot and the application in a way that changes the
      // path/query that Dynadot signed. If production ingress rewrites paths, explicitly
      // preserve/recover the original signed request target.
      const fullPathAndQuery = request.raw.url || request.url;

      const result = await this.ingestionService.ingest(
        rawBody,
        signature,
        fullPathAndQuery,
        requestId,
        bearerToken,
      );

      if (result.duplicate) {
        this.logger.debug(`Duplicate webhook acknowledged [${requestId}] event=${result.providerEventId}`);
      } else {
        this.logger.log(
          `Webhook ingested [${requestId}] event=${result.providerEventId} type=${result.eventType}`,
        );
      }

      // Exact documented response: HTTP 200 + { "Status": "200" }
      reply.status(HttpStatus.OK).send({ Status: '200' });
    } catch (error) {
      if (error instanceof AuthorizationError) {
        this.logger.warn(`Webhook rejected: invalid Bearer key [${requestId}]`);
        reply.status(HttpStatus.UNAUTHORIZED).send({
          error: 'Invalid authorization',
        });
        return;
      }

      if (error instanceof SignatureError) {
        this.logger.warn(`Webhook rejected: invalid signature [${requestId}]`);
        reply.status(HttpStatus.FORBIDDEN).send({
          error: 'Invalid signature',
        });
        return;
      }

      if (error instanceof ValidationError) {
        this.logger.warn(
          `Webhook rejected: validation error [${requestId}]: ${error.message}`,
        );
        reply.status(HttpStatus.BAD_REQUEST).send({
          error: 'Invalid webhook payload',
        });
        return;
      }

      // Infrastructure failure → 500 (provider may retry, but behavior UNKNOWN)
      this.logger.error(
        `Webhook ingestion failed [${requestId}]: ${error instanceof Error ? error.message : 'Unknown'}`,
      );
      reply.status(HttpStatus.INTERNAL_SERVER_ERROR).send({
        error: 'Internal server error',
      });
    }
  }
}

// ── Error Types ──

export class AuthorizationError extends Error {
  constructor(message = 'Invalid webhook authorization') {
    super(message);
    this.name = 'AuthorizationError';
  }
}

export class SignatureError extends Error {
  constructor(message = 'Invalid webhook signature') {
    super(message);
    this.name = 'SignatureError';
  }
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}
