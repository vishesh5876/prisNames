/**
 * PrisNames — Rate Limiter Integration Tests (Real Redis)
 *
 * Tests Lua script atomicity, quota enforcement, concurrency leases,
 * and distributed 429 cooldown against a real Redis instance.
 *
 * Run:
 *   REDIS_URL=redis://localhost:6379 pnpm --filter @prisnames/registrar-dynadot test:redis
 *
 * Skipped when REDIS_URL is not set.
 */

import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import Redis from 'ioredis';
import { DynadotRateLimiter } from '../rate-limiter.js';

const REDIS_URL = process.env.REDIS_URL;
const SKIP = !REDIS_URL;

describe.skipIf(SKIP)('DynadotRateLimiter (Real Redis)', () => {
  let redis: Redis;
  const KEY_PREFIX = 'test:ratelimit:' + Date.now();

  beforeEach(async () => {
    // Ensure clean state
    redis = new Redis(REDIS_URL!, { maxRetriesPerRequest: null });
    const keys = await redis.keys(`${KEY_PREFIX}:*`);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  });

  afterAll(async () => {
    if (redis) {
      const keys = await redis.keys(`${KEY_PREFIX}:*`);
      if (keys.length > 0) {
        await redis.del(...keys);
      }
      await redis.quit();
    }
  });

  // ────────────────────────────────────────────────
  // Lua Atomicity
  // ────────────────────────────────────────────────

  describe('Lua atomicity', () => {
    it('acquire + release is atomic (no partial state)', async () => {
      const limiter = new DynadotRateLimiter(redis, {
        maxRequests: 100,
        windowSeconds: 60,
        maxConcurrent: 1,
        leaseTtlSeconds: 10,
        defaultCooldownSeconds: 30,
        keyPrefix: KEY_PREFIX,
      });

      const result = await limiter.acquireLease();
      expect(result.acquired).toBe(true);

      // Verify lease exists in Redis
      const concKeys = await redis.hgetall(`${KEY_PREFIX}:conc`);
      expect(Object.keys(concKeys)).toHaveLength(1);
      expect(Object.keys(concKeys)[0]).toBe(result.leaseId);

      await limiter.releaseLease(result.leaseId);

      // Verify lease was removed
      const concKeysAfter = await redis.hgetall(`${KEY_PREFIX}:conc`);
      expect(Object.keys(concKeysAfter)).toHaveLength(0);
    });
  });

  // ────────────────────────────────────────────────
  // Per-second / Per-minute Quota
  // ────────────────────────────────────────────────

  describe('per-window quota', () => {
    it('enforces per-window rate limit (3 requests per 2s)', async () => {
      const limiter = new DynadotRateLimiter(redis, {
        maxRequests: 3,
        windowSeconds: 2,
        maxConcurrent: 10,
        leaseTtlSeconds: 10,
        defaultCooldownSeconds: 30,
        keyPrefix: KEY_PREFIX,
      });

      // Acquire 3 leases (all should succeed)
      const results = [];
      for (let i = 0; i < 3; i++) {
        const r = await limiter.acquireLease();
        results.push(r);
        await limiter.releaseLease(r.leaseId);
      }
      expect(results.every(r => r.acquired)).toBe(true);

      // 4th should fail (rate limit exceeded)
      const denied = await limiter.acquireLease();
      expect(denied.acquired).toBe(false);
      expect(denied.retryAfterMs).toBeGreaterThan(0);
    });

    it('quota resets after window expires', async () => {
      const limiter = new DynadotRateLimiter(redis, {
        maxRequests: 1,
        windowSeconds: 1,
        maxConcurrent: 10,
        leaseTtlSeconds: 10,
        defaultCooldownSeconds: 30,
        keyPrefix: KEY_PREFIX,
      });

      // First request succeeds
      const r1 = await limiter.acquireLease();
      expect(r1.acquired).toBe(true);
      await limiter.releaseLease(r1.leaseId);

      // Second immediately fails
      const r2 = await limiter.acquireLease();
      expect(r2.acquired).toBe(false);

      // Wait for window to expire
      await new Promise(r => setTimeout(r, 1100));

      // Now succeeds again
      const r3 = await limiter.acquireLease();
      expect(r3.acquired).toBe(true);
      await limiter.releaseLease(r3.leaseId);
    }, 5000);
  });

  // ────────────────────────────────────────────────
  // Concurrency Capacity
  // ────────────────────────────────────────────────

  describe('concurrency capacity', () => {
    it('enforces concurrency limit (max 2 concurrent)', async () => {
      const limiter = new DynadotRateLimiter(redis, {
        maxRequests: 100,
        windowSeconds: 60,
        maxConcurrent: 2,
        leaseTtlSeconds: 10,
        defaultCooldownSeconds: 30,
        keyPrefix: KEY_PREFIX,
      });

      // Acquire 2 concurrent leases
      const lease1 = await limiter.acquireLease();
      const lease2 = await limiter.acquireLease();
      expect(lease1.acquired).toBe(true);
      expect(lease2.acquired).toBe(true);

      // 3rd should fail (concurrency limit)
      const lease3 = await limiter.acquireLease();
      expect(lease3.acquired).toBe(false);

      // Release one, then 4th should succeed
      await limiter.releaseLease(lease1.leaseId);
      const lease4 = await limiter.acquireLease();
      expect(lease4.acquired).toBe(true);

      // Clean up
      await limiter.releaseLease(lease2.leaseId);
      await limiter.releaseLease(lease4.leaseId);
    });

    it('50+ simultaneous contenders correctly bounded', async () => {
      const limiter = new DynadotRateLimiter(redis, {
        maxRequests: 100,
        windowSeconds: 60,
        maxConcurrent: 5,
        leaseTtlSeconds: 10,
        defaultCooldownSeconds: 30,
        keyPrefix: KEY_PREFIX,
      });

      // Fire 50 simultaneous acquire requests
      const promises = Array.from({ length: 50 }, () => limiter.acquireLease());
      const results = await Promise.all(promises);

      const acquired = results.filter(r => r.acquired);
      const denied = results.filter(r => !r.acquired);

      // Exactly 5 should acquire (concurrency limit)
      expect(acquired.length).toBe(5);
      expect(denied.length).toBe(45);

      // Clean up acquired leases
      for (const r of acquired) {
        await limiter.releaseLease(r.leaseId);
      }
    });
  });

  // ────────────────────────────────────────────────
  // Lease Ownership
  // ────────────────────────────────────────────────

  describe('lease ownership', () => {
    it('each lease has a unique ownership ID', async () => {
      const limiter = new DynadotRateLimiter(redis, {
        maxRequests: 100,
        windowSeconds: 60,
        maxConcurrent: 10,
        leaseTtlSeconds: 10,
        defaultCooldownSeconds: 30,
        keyPrefix: KEY_PREFIX,
      });

      const lease1 = await limiter.acquireLease();
      const lease2 = await limiter.acquireLease();

      expect(lease1.leaseId).not.toBe(lease2.leaseId);

      await limiter.releaseLease(lease1.leaseId);
      await limiter.releaseLease(lease2.leaseId);
    });
  });

  // ────────────────────────────────────────────────
  // Double Release
  // ────────────────────────────────────────────────

  describe('double release', () => {
    it('double release is harmless (idempotent)', async () => {
      const limiter = new DynadotRateLimiter(redis, {
        maxRequests: 100,
        windowSeconds: 60,
        maxConcurrent: 2,
        leaseTtlSeconds: 10,
        defaultCooldownSeconds: 30,
        keyPrefix: KEY_PREFIX,
      });

      const lease = await limiter.acquireLease();
      expect(lease.acquired).toBe(true);

      // First release
      await limiter.releaseLease(lease.leaseId);
      // Second release — must NOT throw
      await limiter.releaseLease(lease.leaseId);
      // Third release — still safe
      await limiter.releaseLease(lease.leaseId);
    });
  });

  // ────────────────────────────────────────────────
  // Stale Lease Release / Expiry
  // ────────────────────────────────────────────────

  describe('stale lease', () => {
    it('releasing a non-existent (stale) lease is safe', async () => {
      const limiter = new DynadotRateLimiter(redis, {
        maxRequests: 100,
        windowSeconds: 60,
        maxConcurrent: 2,
        leaseTtlSeconds: 10,
        defaultCooldownSeconds: 30,
        keyPrefix: KEY_PREFIX,
      });

      // Release a lease ID that was never acquired
      await limiter.releaseLease('stale_lease_that_never_existed');
      // Must not throw
    });

    it('lease expires after TTL (concurrency slot freed)', async () => {
      const limiter = new DynadotRateLimiter(redis, {
        maxRequests: 100,
        windowSeconds: 60,
        maxConcurrent: 1,
        leaseTtlSeconds: 1, // 1 second TTL
        defaultCooldownSeconds: 30,
        keyPrefix: KEY_PREFIX,
      });

      // Acquire sole slot
      const lease1 = await limiter.acquireLease();
      expect(lease1.acquired).toBe(true);

      // Can't acquire another immediately
      const lease2 = await limiter.acquireLease();
      expect(lease2.acquired).toBe(false);

      // Wait for TTL to expire
      await new Promise(r => setTimeout(r, 1200));

      // Now should be able to acquire (stale lease expired)
      const lease3 = await limiter.acquireLease();
      expect(lease3.acquired).toBe(true);

      await limiter.releaseLease(lease3.leaseId);
    }, 5000);
  });

  // ────────────────────────────────────────────────
  // Permit Reuse / No Permit Leak
  // ────────────────────────────────────────────────

  describe('permit reuse', () => {
    it('released permit is reusable', async () => {
      const limiter = new DynadotRateLimiter(redis, {
        maxRequests: 100,
        windowSeconds: 60,
        maxConcurrent: 1,
        leaseTtlSeconds: 10,
        defaultCooldownSeconds: 30,
        keyPrefix: KEY_PREFIX,
      });

      // Acquire → release → acquire again
      for (let i = 0; i < 5; i++) {
        const lease = await limiter.acquireLease();
        expect(lease.acquired).toBe(true);
        await limiter.releaseLease(lease.leaseId);
      }
    });

    it('no permit leak (concurrency keys clean after release)', async () => {
      const limiter = new DynadotRateLimiter(redis, {
        maxRequests: 100,
        windowSeconds: 60,
        maxConcurrent: 3,
        leaseTtlSeconds: 10,
        defaultCooldownSeconds: 30,
        keyPrefix: KEY_PREFIX,
      });

      // Acquire 3, release all
      const leases = [];
      for (let i = 0; i < 3; i++) {
        const r = await limiter.acquireLease();
        leases.push(r);
      }
      for (const l of leases) {
        await limiter.releaseLease(l.leaseId);
      }

      // Concurrency hash should be empty
      const concKeys = await redis.hgetall(`${KEY_PREFIX}:conc`);
      expect(Object.keys(concKeys)).toHaveLength(0);
    });
  });

  // ────────────────────────────────────────────────
  // Distributed 429 Cooldown
  // ────────────────────────────────────────────────

  describe('distributed 429 cooldown', () => {
    it('cooldown blocks all leases', async () => {
      const limiter = new DynadotRateLimiter(redis, {
        maxRequests: 100,
        windowSeconds: 60,
        maxConcurrent: 10,
        leaseTtlSeconds: 10,
        defaultCooldownSeconds: 2,
        keyPrefix: KEY_PREFIX,
      });

      // Set cooldown
      await limiter.setCooldown(2);

      // Verify cooldown active
      expect(await limiter.isInCooldown()).toBe(true);

      // All lease attempts should fail during cooldown
      const result = await limiter.acquireLease();
      expect(result.acquired).toBe(false);
    });

    it('cooldown expires after duration', async () => {
      const limiter = new DynadotRateLimiter(redis, {
        maxRequests: 100,
        windowSeconds: 60,
        maxConcurrent: 10,
        leaseTtlSeconds: 10,
        defaultCooldownSeconds: 1,
        keyPrefix: KEY_PREFIX,
      });

      await limiter.setCooldown(1);
      expect(await limiter.isInCooldown()).toBe(true);

      // Wait for cooldown to expire
      await new Promise(r => setTimeout(r, 1100));

      expect(await limiter.isInCooldown()).toBe(false);

      // Can acquire again
      const result = await limiter.acquireLease();
      expect(result.acquired).toBe(true);
      await limiter.releaseLease(result.leaseId);
    }, 5000);
  });

  // ────────────────────────────────────────────────
  // Combined Quota Behavior
  // ────────────────────────────────────────────────

  describe('combined quota behavior', () => {
    it('rate limit + concurrency enforced simultaneously', async () => {
      const limiter = new DynadotRateLimiter(redis, {
        maxRequests: 5,
        windowSeconds: 60,
        maxConcurrent: 2,
        leaseTtlSeconds: 10,
        defaultCooldownSeconds: 30,
        keyPrefix: KEY_PREFIX,
      });

      // Acquire 2 concurrent (at concurrency limit)
      const l1 = await limiter.acquireLease();
      const l2 = await limiter.acquireLease();
      expect(l1.acquired).toBe(true);
      expect(l2.acquired).toBe(true);

      // 3rd blocked by concurrency, not rate
      const l3 = await limiter.acquireLease();
      expect(l3.acquired).toBe(false);

      // Release both
      await limiter.releaseLease(l1.leaseId);
      await limiter.releaseLease(l2.leaseId);

      // Acquire 3 more (total: 5 of 5 rate limit)
      const l4 = await limiter.acquireLease();
      const l5 = await limiter.acquireLease();
      expect(l4.acquired).toBe(true);
      expect(l5.acquired).toBe(true);
      await limiter.releaseLease(l4.leaseId);
      await limiter.releaseLease(l5.leaseId);

      const l6 = await limiter.acquireLease();
      expect(l6.acquired).toBe(true);
      await limiter.releaseLease(l6.leaseId);

      // 6th should fail (rate limit exhausted at 5 per window)
      const l7 = await limiter.acquireLease();
      expect(l7.acquired).toBe(false);
    });
  });
});
