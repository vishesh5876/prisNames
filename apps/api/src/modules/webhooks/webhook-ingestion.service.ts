/**
 * PrisNames — Webhook Ingestion Service
 *
 * Durable webhook processing pipeline:
 * 1. Verify HMAC-SHA256 signature (constant-time, raw bytes)
 * 2. Parse/validate webhook envelope (safe integer event_id)
 * 3. Encrypt raw payload BEFORE insert (envelope encryption)
 * 4. Atomic INSERT with ON CONFLICT DO NOTHING RETURNING id
 * 5. Queue deterministic BullMQ job (no colons in ID)
 * 6. Update processing_status: RECEIVED → QUEUED
 *
 * Recovery (correction #5):
 * - Events stuck in RECEIVED (BullMQ add failed after DB insert)
 *   are recovered by a periodic scan that re-queues with deterministic IDs
 * - Multi-instance safe via deterministic BullMQ job IDs + idempotent workers
 *
 * Failure modes:
 * - DB insert succeeds → BullMQ add succeeds → QUEUED ✓
 * - DB insert succeeds → BullMQ add fails → stays RECEIVED → recovery picks up
 * - DB insert succeeds → BullMQ add succeeds → DB update fails → recovery reconciles
 * - Worker completes → DB update fails → idempotent re-processing is safe
 */

import { Injectable, Inject, Logger } from '@nestjs/common';
import { Queue } from 'bullmq';
import type Redis from 'ioredis';
import { eq, and, sql } from 'drizzle-orm';
import type { Database } from '@prisnames/database';

import { DynadotWebhookSignatureVerifier } from '@prisnames/registrar-dynadot';
import {
  generateWebhookJobId,
  normalizeEventId,
  DynadotWebhookEnvelopeSchema,
} from '@prisnames/registrar-dynadot';
import { createQueueEncryption, type EnvelopeEncryption } from '@prisnames/security';
import { getEnv } from '@prisnames/config';
import { webhookEvents } from '@prisnames/database';

import { REDIS_TOKEN } from '../../redis/redis.module.js';
import { DATABASE_TOKEN } from '../../database/database.module.js';
import {
  AuthorizationError,
  SignatureError,
  ValidationError,
} from './dynadot-webhook.controller.js';

// ──────────────────────────────────────────────
// CONSTANTS
// ──────────────────────────────────────────────

const WEBHOOK_QUEUE_NAME = 'dynadot-webhooks';
const RAW_PAYLOAD_RETENTION_DAYS = 30;

// ──────────────────────────────────────────────
// RESULT TYPE
// ──────────────────────────────────────────────

export interface IngestionResult {
  providerEventId: string;
  eventType: string;
  duplicate: boolean;
  webhookEventId?: string;
}

// ──────────────────────────────────────────────
// SERVICE
// ──────────────────────────────────────────────

@Injectable()
export class WebhookIngestionService {
  private readonly logger = new Logger(WebhookIngestionService.name);
  private readonly signatureVerifier: DynadotWebhookSignatureVerifier;
  private readonly encryption: EnvelopeEncryption;
  private readonly queue: Queue;

  constructor(
    @Inject(REDIS_TOKEN) redis: Redis,
    @Inject(DATABASE_TOKEN) private readonly db: Database,
  ) {
    const env = getEnv();

    this.signatureVerifier = new DynadotWebhookSignatureVerifier({
      webhookKey: env.DYNADOT_WEBHOOK_KEY,
      webhookSecret: env.DYNADOT_WEBHOOK_SECRET,
    });
    this.encryption = createQueueEncryption(
      env.QUEUE_ENCRYPTION_KEY,
      env.QUEUE_ENCRYPTION_KEY_ID,
    );

    this.queue = new Queue(WEBHOOK_QUEUE_NAME, {
      connection: redis,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: { age: 86400 },
        removeOnFail: { age: 604800 },
      },
    });
  }

  /**
   * Ingest a webhook event durably.
   *
   * @param rawBody - Exact raw bytes from the request
   * @param signature - X-Signature header value (Base64 HMAC-SHA256)
   * @param fullPathAndQuery - Original raw request URL path + query string
   * @param requestId - X-Request-ID for correlation
   * @param bearerToken - Bearer token from Authorization header
   */
  async ingest(
    rawBody: Buffer,
    signature: string,
    fullPathAndQuery: string,
    requestId: string,
    bearerToken?: string,
  ): Promise<IngestionResult> {
    // Step 0: Verify Bearer key (constant-time comparison, correction #10)
    if (!bearerToken || !this.signatureVerifier.verifyBearerKey(bearerToken)) {
      throw new AuthorizationError();
    }

    // Step 1: Verify X-Signature (4-part message, Base64 HMAC-SHA256)
    const signatureValid = this.signatureVerifier.verifySignature({
      fullPathAndQuery,
      xRequestId: requestId,
      rawBody,
      providedSignature: signature,
    });
    if (!signatureValid) {
      throw new SignatureError();
    }

    // Step 2: Parse and validate envelope
    let parsed;
    try {
      const json = JSON.parse(rawBody.toString('utf-8'));
      parsed = DynadotWebhookEnvelopeSchema.parse(json);
    } catch (error) {
      throw new ValidationError(
        `Invalid webhook envelope: ${error instanceof Error ? error.message : 'parse error'}`,
      );
    }

    const providerEventId = normalizeEventId(parsed.event_id);
    const eventType = parsed.event_type;

    // Step 3: Encrypt raw payload BEFORE insert
    const encryptedPayload = this.encryption.encrypt(rawBody.toString('utf-8'));

    // Step 4: Atomic INSERT with ON CONFLICT DO NOTHING
    const expiresAt = new Date(Date.now() + RAW_PAYLOAD_RETENTION_DAYS * 24 * 60 * 60 * 1000);

    const insertResult = await this.db
      .insert(webhookEvents)
      .values({
        provider: 'dynadot',
        providerEventId,
        eventType,
        rawPayload: encryptedPayload,
        encryptionKeyId: getEnv().QUEUE_ENCRYPTION_KEY_ID,
        rawPayloadExpiresAt: expiresAt,
        signatureValid: true,
        processingStatus: 'RECEIVED',
        processingAttempts: '0',
      })
      .onConflictDoNothing({
        target: [webhookEvents.provider, webhookEvents.providerEventId],
      })
      .returning({ id: webhookEvents.id });

    // If no rows returned, this is a duplicate
    if (!insertResult || insertResult.length === 0) {
      return { providerEventId, eventType, duplicate: true };
    }

    const webhookEventId = insertResult[0]?.id;
    if (!webhookEventId) {
      return { providerEventId, eventType, duplicate: true };
    }

    // Step 5: Queue deterministic BullMQ job
    const jobId = generateWebhookJobId('dynadot', providerEventId);
    try {
      await this.queue.add(
        'process-webhook',
        {
          webhookEventId,
          providerEventId,
          eventType,
          provider: 'dynadot',
        },
        { jobId },
      );

      // Step 6: Update processing_status RECEIVED → QUEUED
      await this.db
        .update(webhookEvents)
        .set({
          processingStatus: 'QUEUED',
          queuedAt: new Date(),
        })
        .where(eq(webhookEvents.id, webhookEventId));
    } catch (error) {
      // BullMQ add or DB update failed — event stays RECEIVED
      // Recovery service will pick it up later
      this.logger.warn(
        { webhookEventId, providerEventId, error: error instanceof Error ? error.message : 'Unknown' },
        'Failed to queue webhook event — will be recovered',
      );
    }

    return { providerEventId, eventType, duplicate: false, webhookEventId };
  }

  /**
   * Recovery scan: find RECEIVED events that weren't queued (correction #5).
   * Multi-instance safe via deterministic BullMQ job IDs.
   *
   * If two processes scan simultaneously:
   * - Both try to add the same deterministic job ID → BullMQ rejects duplicate
   * - DB update is idempotent (RECEIVED → QUEUED is safe to attempt multiple times)
   */
  async recoverStrandedEvents(maxEvents = 50): Promise<number> {
    // Find events stuck in RECEIVED for more than 60 seconds
    const staleThreshold = new Date(Date.now() - 60_000);

    const strandedEvents = await this.db
      .select({
        id: webhookEvents.id,
        providerEventId: webhookEvents.providerEventId,
        eventType: webhookEvents.eventType,
      })
      .from(webhookEvents)
      .where(
        and(
          eq(webhookEvents.processingStatus, 'RECEIVED'),
          sql`${webhookEvents.receivedAt} < ${staleThreshold}`,
        ),
      )
      .limit(maxEvents);

    let recovered = 0;
    for (const event of strandedEvents) {
      const jobId = generateWebhookJobId('dynadot', event.providerEventId);
      try {
        await this.queue.add(
          'process-webhook',
          {
            webhookEventId: event.id,
            providerEventId: event.providerEventId,
            eventType: event.eventType,
            provider: 'dynadot',
          },
          { jobId },
        );

        await this.db
          .update(webhookEvents)
          .set({
            processingStatus: 'QUEUED',
            queuedAt: new Date(),
          })
          .where(
            and(
              eq(webhookEvents.id, event.id),
              eq(webhookEvents.processingStatus, 'RECEIVED'),
            ),
          );

        recovered++;
      } catch {
        // Job already exists (deterministic ID) or DB update failed
        // Either way, safe to skip — next recovery pass will reconcile
        this.logger.debug(
          { webhookEventId: event.id, providerEventId: event.providerEventId },
          'Recovery: event already queued or failed to re-queue',
        );
      }
    }

    if (recovered > 0) {
      this.logger.log(`Recovered ${recovered} stranded webhook events`);
    }

    return recovered;
  }
}
