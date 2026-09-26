/**
 * PrisNames — Webhook DTO Tests
 */

import { describe, it, expect } from 'vitest';
import {
  DynadotWebhookEnvelopeSchema,
  normalizeEventId,
  WEBHOOK_ACK_RESPONSE,
} from '../dto/webhook.dto.js';

describe('DynadotWebhookEnvelopeSchema', () => {
  it('accepts valid envelope with numeric event_id', () => {
    const result = DynadotWebhookEnvelopeSchema.safeParse({
      event_id: 12345,
      event_type: 'domain_registered',
      data: { domain: 'example.com' },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.event_id).toBe(12345);
    }
  });

  it('accepts valid envelope with string event_id', () => {
    const result = DynadotWebhookEnvelopeSchema.safeParse({
      event_id: 'evt_12345',
      event_type: 'domain_registered',
    });
    expect(result.success).toBe(true);
  });

  it('rejects unsafe integer event_id (> MAX_SAFE_INTEGER)', () => {
    const result = DynadotWebhookEnvelopeSchema.safeParse({
      event_id: Number.MAX_SAFE_INTEGER + 1,
      event_type: 'test',
    });
    expect(result.success).toBe(false);
  });

  it('rejects negative event_id', () => {
    const result = DynadotWebhookEnvelopeSchema.safeParse({
      event_id: -1,
      event_type: 'test',
    });
    expect(result.success).toBe(false);
  });

  it('rejects floating point event_id', () => {
    const result = DynadotWebhookEnvelopeSchema.safeParse({
      event_id: 12.5,
      event_type: 'test',
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing event_type', () => {
    const result = DynadotWebhookEnvelopeSchema.safeParse({
      event_id: 1,
    });
    expect(result.success).toBe(false);
  });

  it('defaults data to empty object when missing', () => {
    const result = DynadotWebhookEnvelopeSchema.safeParse({
      event_id: 1,
      event_type: 'test',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.data).toEqual({});
    }
  });
});

describe('normalizeEventId', () => {
  it('converts numeric event_id to string', () => {
    expect(normalizeEventId(12345)).toBe('12345');
  });

  it('passes string event_id through', () => {
    expect(normalizeEventId('evt_12345')).toBe('evt_12345');
  });

  it('converts 0 to "0"', () => {
    expect(normalizeEventId(0)).toBe('0');
  });
});

describe('WEBHOOK_ACK_RESPONSE', () => {
  it('matches Dynadot documented format', () => {
    expect(WEBHOOK_ACK_RESPONSE).toEqual({ Status: '200' });
  });
});
