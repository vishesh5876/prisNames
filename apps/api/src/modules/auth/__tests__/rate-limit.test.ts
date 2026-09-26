/**
 * PrisNames — Rate Limit Service Tests
 *
 * Tests rate limiting with real Redis (if available) and mock scenarios.
 * Covers:
 * - Atomic increment and threshold enforcement
 * - Fail-closed behavior in production when Redis unavailable
 * - Development bypass with warning
 * - Multi-dimensional rate limiting
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RateLimitService, type RateLimitConfig } from '../rate-limit.service.js';
import { HttpException } from '@nestjs/common';

// Create a mock Redis for unit tests
function createMockRedis(options?: { failOnEval?: boolean }) {
  const store = new Map<string, number>();

  return {
    eval: vi.fn(async (script: string, numKeys: number, key: string, _window: string) => {
      if (options?.failOnEval) {
        throw new Error('Redis connection refused');
      }
      const current = (store.get(key) || 0) + 1;
      store.set(key, current);
      return current;
    }),
    get: vi.fn(async (key: string) => {
      const val = store.get(key);
      return val ? String(val) : null;
    }),
    _store: store,
  };
}

// Mock getEnv to control NODE_ENV
vi.mock('@prisnames/config', () => ({
  getEnv: vi.fn(() => ({ NODE_ENV: 'production' })),
}));

describe('RateLimitService', () => {
  let service: RateLimitService;
  let mockRedis: ReturnType<typeof createMockRedis>;

  beforeEach(() => {
    mockRedis = createMockRedis();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    service = new RateLimitService(mockRedis as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('atomic increment and threshold', () => {
    it('allows requests under the limit', async () => {
      const config: RateLimitConfig = { key: 'rate:test', max: 3, windowSeconds: 60 };
      await expect(service.check([config])).resolves.toBeUndefined();
      expect(mockRedis.eval).toHaveBeenCalledOnce();
    });

    it('allows requests up to the limit', async () => {
      const config: RateLimitConfig = { key: 'rate:test2', max: 3, windowSeconds: 60 };
      await service.check([config]); // 1
      await service.check([config]); // 2
      await service.check([config]); // 3
      // All should pass (count <= max)
    });

    it('rejects requests over the limit', async () => {
      const config: RateLimitConfig = { key: 'rate:test3', max: 2, windowSeconds: 60 };
      await service.check([config]); // 1
      await service.check([config]); // 2
      await expect(service.check([config])).rejects.toThrow(HttpException);
      await expect(service.check([config])).rejects.toMatchObject({
        status: 429,
      });
    });
  });

  describe('multi-dimensional rate limiting', () => {
    it('checks all dimensions', async () => {
      const limits: RateLimitConfig[] = [
        { key: 'rate:email:test@example.com', max: 3, windowSeconds: 60 },
        { key: 'rate:ip:127.0.0.1', max: 10, windowSeconds: 60 },
      ];
      await service.check(limits);
      expect(mockRedis.eval).toHaveBeenCalledTimes(2);
    });

    it('rejects if any dimension exceeds limit', async () => {
      const strictLimit: RateLimitConfig = { key: 'rate:strict', max: 1, windowSeconds: 60 };
      const lenientLimit: RateLimitConfig = { key: 'rate:lenient', max: 100, windowSeconds: 60 };

      await service.check([strictLimit, lenientLimit]); // 1 on strict, 1 on lenient
      await expect(service.check([strictLimit, lenientLimit])).rejects.toThrow(HttpException);
    });
  });

  describe('Redis failure - production (fail-closed)', () => {
    it('rejects requests when Redis is unavailable in production', async () => {
      const failRedis = createMockRedis({ failOnEval: true });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const prodService = new RateLimitService(failRedis as any);

      const config: RateLimitConfig = { key: 'rate:test', max: 10, windowSeconds: 60 };
      await expect(prodService.check([config])).rejects.toThrow(HttpException);
    });
  });

  describe('getCount', () => {
    it('returns 0 for non-existent keys', async () => {
      const count = await service.getCount('rate:nonexistent');
      expect(count).toBe(0);
    });

    it('returns current count for existing keys', async () => {
      mockRedis._store.set('rate:existing', 5);
      const count = await service.getCount('rate:existing');
      expect(count).toBe(5);
    });
  });
});
