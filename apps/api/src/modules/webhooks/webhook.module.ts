/**
 * PrisNames — Webhook Module
 *
 * API-side webhook ingestion only.
 * Processing worker and recovery scheduler live in apps/worker.
 *
 * API responsibility:
 *   receive → authenticate → verify → persist → enqueue → acknowledge
 *
 * Worker responsibility:
 *   consume → decrypt → normalize → process infrastructure state
 */

import { Module } from '@nestjs/common';
import { DynadotWebhookController } from './dynadot-webhook.controller.js';
import { WebhookIngestionService } from './webhook-ingestion.service.js';

@Module({
  controllers: [DynadotWebhookController],
  providers: [WebhookIngestionService],
  exports: [WebhookIngestionService],
})
export class WebhookModule {}
