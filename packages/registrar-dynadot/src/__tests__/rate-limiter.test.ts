/**
 * PrisNames — Rate Limiter Unit Tests (ioredis-mock)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import RedisMock from 'ioredis-mock';
import type Redis from 'ioredis';
import { DynadotRateLimiter } from '../rate-limiter.js';

describe('DynadotRateLimiter (ioredis-mock)', () => {
  let redis: InstanceType<typeof RedisMock>;
  let limiter: DynadotRateLimiter;

  beforeEach(() => {
    redis = new RedisMock();
    limiter = new DynadotRateLimiter(redis as unknown as Redis, {
      maxRequests: 3,
      windowSeconds: 60,
      maxConcurrent: 2,
      leaseTtlSeconds: 10,
      defaultCooldownSeconds: 30,
      keyPrefix: 'test:ratelimit',
    });
  });

  describe('acquireLease', () => {
    it('acquires lease when under limits', async () => {
      const result = await limiter.acquireLease();
      expect(result.acquired).toBe(true);
      expect(result.leaseId).toBeTruthy();
    });

    it('generates unique lease IDs', async () => {
      const r1 = await limiter.acquireLease();
      const r2 = await limiter.acquireLease();
      expect(r1.leaseId).not.toBe(r2.leaseId);
    });
  });

  describe('releaseLease', () => {
    it('is idempotent (double release is safe)', async () => {
      const { leaseId } = await limiter.acquireLease();
      // First release
      await expect(limiter.releaseLease(leaseId)).resolves.toBeUndefined();
      // Second release (should not throw)
      await expect(limiter.releaseLease(leaseId)).resolves.toBeUndefined();
    });

    it('releasing a non-existent lease is safe', async () => {
      await expect(limiter.releaseLease('non-existent-lease')).resolves.toBeUndefined();
    });
  });

  describe('cooldown', () => {
    it('reports no cooldown initially', async () => {
      expect(await limiter.isInCooldown()).toBe(false);
    });

    it('sets and checks cooldown', async () => {
      await limiter.setCooldown(60);
      expect(await limiter.isInCooldown()).toBe(true);
    });
  });
});
