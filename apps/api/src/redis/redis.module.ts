/**
 * PrisNames — Redis Module
 *
 * Provides ioredis client via NestJS DI.
 *
 * Redis failure policy (per correction 9):
 * - Production: auth-critical endpoints fail safely when Redis is unavailable
 * - Development/test: may use lenient fallback only when explicitly configured
 * - Never silently fall back to in-memory rate limiting in production
 */

import { Module, Global, type OnModuleDestroy, Inject, Logger } from '@nestjs/common';
import Redis from 'ioredis';
import { getEnv } from '@prisnames/config';

export const REDIS_TOKEN = 'REDIS';

@Global()
@Module({
  providers: [
    {
      provide: REDIS_TOKEN,
      useFactory: (): Redis => {
        const env = getEnv();
        const redis = new Redis(env.REDIS_URL, {
          maxRetriesPerRequest: 3,
          retryStrategy: (times: number) => {
            if (times > 5) return null; // Stop retrying
            return Math.min(times * 200, 2000);
          },
          lazyConnect: true,
        });

        redis.on('error', (err) => {
          Logger.error(`Redis connection error: ${err.message}`, 'RedisModule');
        });

        redis.connect().catch((err) => {
          Logger.error(`Redis initial connect failed: ${err.message}`, 'RedisModule');
        });

        return redis;
      },
    },
  ],
  exports: [REDIS_TOKEN],
})
export class RedisModule implements OnModuleDestroy {
  constructor(@Inject(REDIS_TOKEN) private readonly redis: Redis) {}

  async onModuleDestroy(): Promise<void> {
    try {
      await this.redis.quit();
    } catch {
      // Ignore disconnect errors during shutdown
    }
  }
}
