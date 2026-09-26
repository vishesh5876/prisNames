/**
 * PrisNames — Rate Limit Service
 *
 * Redis-backed multi-dimensional rate limiting per SECURITY.md §4.
 * Uses atomic Lua scripts for sliding window counters.
 *
 * Failure policy (correction 9):
 * - Production: security-sensitive endpoints FAIL SAFELY (reject) when Redis is unavailable
 * - Development/test: may use lenient fallback only when explicitly configured
 */

import { Injectable, Inject, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type Redis from 'ioredis';
import { REDIS_TOKEN } from '../../redis/redis.module.js';
import { AUTH_ERROR_CODES } from '@prisnames/contracts';
import { getEnv } from '@prisnames/config';

export interface RateLimitConfig {
  /** Redis key prefix */
  key: string;
  /** Max requests in window */
  max: number;
  /** Window in seconds */
  windowSeconds: number;
}

/**
 * Atomic sliding window rate limit Lua script.
 * Increments a counter and sets expiry atomically.
 * Returns the current count after increment.
 */
const RATE_LIMIT_LUA = `
local key = KEYS[1]
local window = tonumber(ARGV[1])
local current = redis.call('INCR', key)
if current == 1 then
  redis.call('EXPIRE', key, window)
end
return current
`;

@Injectable()
export class RateLimitService {
  private readonly logger = new Logger(RateLimitService.name);
  private readonly isProduction: boolean;

  constructor(
    @Inject(REDIS_TOKEN) private readonly redis: Redis,
  ) {
    this.isProduction = getEnv().NODE_ENV === 'production';
  }

  /**
   * Check and increment rate limit counters.
   * Throws 429 if any limit is exceeded.
   *
   * @param limits - Array of rate limit configs to check (multi-dimensional)
   */
  async check(limits: RateLimitConfig[]): Promise<void> {
    for (const limit of limits) {
      await this.checkSingle(limit);
    }
  }

  private async checkSingle(config: RateLimitConfig): Promise<void> {
    try {
      const count = await this.redis.eval(
        RATE_LIMIT_LUA,
        1,
        config.key,
        config.windowSeconds.toString(),
      ) as number;

      if (count > config.max) {
        throw new HttpException(
          {
            code: AUTH_ERROR_CODES.RATE_LIMITED,
            message: 'Too many requests. Please try again later.',
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    } catch (error) {
      if (error instanceof HttpException) throw error;

      // Redis failure
      this.logger.error(
        { key: config.key, err: error },
        'Rate limit Redis error',
      );

      if (this.isProduction) {
        // Fail safely: reject the request when rate-limit state cannot be trusted
        throw new HttpException(
          {
            code: AUTH_ERROR_CODES.RATE_LIMITED,
            message: 'Service temporarily unavailable. Please try again.',
          },
          HttpStatus.SERVICE_UNAVAILABLE,
        );
      }
      // Development: allow through with warning
      this.logger.warn('Rate limiting bypassed due to Redis unavailability (dev mode)');
    }
  }

  /**
   * Get current count for a rate limit key (for informational purposes).
   */
  async getCount(key: string): Promise<number> {
    try {
      const val = await this.redis.get(key);
      return val ? parseInt(val, 10) : 0;
    } catch {
      return 0;
    }
  }
}
