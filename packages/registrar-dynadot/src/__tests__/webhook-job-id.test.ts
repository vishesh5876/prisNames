/**
 * PrisNames — Webhook Job ID Tests
 *
 * BullMQ custom job IDs must NOT contain ':'.
 * Tests prove determinism and BullMQ compatibility.
 */

import { describe, it, expect } from 'vitest';
import { generateWebhookJobId, isBullMQCompatibleJobId } from '../webhook-job-id.js';

describe('generateWebhookJobId', () => {
  it('produces a BullMQ-compatible ID (no colons)', () => {
    const jobId = generateWebhookJobId('dynadot', '12345');
    expect(jobId).not.toContain(':');
    expect(isBullMQCompatibleJobId(jobId)).toBe(true);
  });

  it('is deterministic for the same input', () => {
    const id1 = generateWebhookJobId('dynadot', '12345');
    const id2 = generateWebhookJobId('dynadot', '12345');
    expect(id1).toBe(id2);
  });

  it('uses event ID directly when safe', () => {
    const jobId = generateWebhookJobId('dynadot', '99001');
    expect(jobId).toBe('webhook_dynadot_99001');
  });

  it('uses hash for event IDs containing colons', () => {
    const jobId = generateWebhookJobId('dynadot', 'evt:123:abc');
    expect(jobId).not.toContain(':');
    expect(jobId).toMatch(/^webhook_dynadot_h_[0-9a-f]{32}$/);
  });

  it('uses hash for very long event IDs', () => {
    const longId = 'a'.repeat(200);
    const jobId = generateWebhookJobId('dynadot', longId);
    expect(jobId.length).toBeLessThan(200);
    expect(isBullMQCompatibleJobId(jobId)).toBe(true);
  });

  it('uses hash for event IDs with special characters', () => {
    const jobId = generateWebhookJobId('dynadot', 'evt/123@abc!');
    expect(jobId).not.toContain(':');
    expect(jobId).toMatch(/^webhook_dynadot_h_/);
  });

  it('produces different IDs for different event IDs', () => {
    const id1 = generateWebhookJobId('dynadot', '111');
    const id2 = generateWebhookJobId('dynadot', '222');
    expect(id1).not.toBe(id2);
  });

  it('produces different IDs for different providers', () => {
    const id1 = generateWebhookJobId('dynadot', '123');
    const id2 = generateWebhookJobId('other', '123');
    expect(id1).not.toBe(id2);
  });

  it('handles numeric-like string event IDs', () => {
    const jobId = generateWebhookJobId('dynadot', '0');
    expect(jobId).toBe('webhook_dynadot_0');
    expect(isBullMQCompatibleJobId(jobId)).toBe(true);
  });

  it('handles alphanumeric event IDs with dashes/dots/underscores', () => {
    const jobId = generateWebhookJobId('dynadot', 'evt-123_abc.456');
    expect(jobId).toBe('webhook_dynadot_evt-123_abc.456');
    expect(isBullMQCompatibleJobId(jobId)).toBe(true);
  });
});

describe('isBullMQCompatibleJobId', () => {
  it('returns true for valid IDs', () => {
    expect(isBullMQCompatibleJobId('webhook_dynadot_123')).toBe(true);
    expect(isBullMQCompatibleJobId('abc')).toBe(true);
  });

  it('returns false for IDs containing colons', () => {
    expect(isBullMQCompatibleJobId('dynadot-webhook:123')).toBe(false);
    expect(isBullMQCompatibleJobId('a:b')).toBe(false);
  });

  it('returns false for empty IDs', () => {
    expect(isBullMQCompatibleJobId('')).toBe(false);
  });

  it('returns false for very long IDs', () => {
    expect(isBullMQCompatibleJobId('x'.repeat(201))).toBe(false);
  });
});
