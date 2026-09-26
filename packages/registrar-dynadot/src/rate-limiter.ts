/**
 * PrisNames — Dynadot Rate Limiter
 *
 * Distributed rate limiting via Redis Lua scripts.
 * Uses GCRA (Generic Cell Rate Algorithm) for smooth rate limiting.
 *
 * Features:
 * - Distributed 429 cooldown (shared across all API/worker processes)
 * - Ownership-token concurrency leases (unique leaseId, double-release harmless)
 * - Bounded waits with configurable retry
 * - Retry-After support (optional — may not be present per correction #11)
 */

import type Redis from 'ioredis';

// ──────────────────────────────────────────────
// CONFIGURATION
// ──────────────────────────────────────────────

export interface RateLimiterConfig {
  /** Maximum requests per window */
  maxRequests: number;
  /** Window size in seconds */
  windowSeconds: number;
  /** Concurrency limit for parallel requests */
  maxConcurrent: number;
  /** Lease TTL in seconds (auto-expire stale leases) */
  leaseTtlSeconds: number;
  /** Default cooldown in seconds when receiving 429 (if no Retry-After) */
  defaultCooldownSeconds: number;
  /** Key prefix for Redis keys */
  keyPrefix: string;
}

const DEFAULT_CONFIG: RateLimiterConfig = {
  maxRequests: 10,
  windowSeconds: 60,
  maxConcurrent: 3,
  leaseTtlSeconds: 30,
  defaultCooldownSeconds: 60,
  keyPrefix: 'dynadot:ratelimit',
};

// ──────────────────────────────────────────────
// LEASE RESULT
// ──────────────────────────────────────────────

export interface LeaseResult {
  acquired: boolean;
  leaseId: string;
  retryAfterMs?: number;
}

// ──────────────────────────────────────────────
// LUA SCRIPTS
// ──────────────────────────────────────────────

/**
 * GCRA rate limit check + concurrency lease acquisition.
 * Atomic: checks rate limit, concurrency, and 429 cooldown in one RTT.
 *
 * KEYS[1]: rate limit key (sorted set for sliding window)
 * KEYS[2]: concurrency key (hash of leaseId → expiry)
 * KEYS[3]: cooldown key (string with TTL)
 *
 * ARGV[1]: current timestamp (ms)
 * ARGV[2]: window size (ms)
 * ARGV[3]: max requests per window
 * ARGV[4]: max concurrent
 * ARGV[5]: lease ID (unique per request)
 * ARGV[6]: lease TTL (ms)
 *
 * Returns: [allowed (0/1), retryAfterMs (0 if allowed)]
 */
const ACQUIRE_LEASE_LUA = `
local rateKey = KEYS[1]
local concKey = KEYS[2]
local cooldownKey = KEYS[3]

local now = tonumber(ARGV[1])
local windowMs = tonumber(ARGV[2])
local maxRequests = tonumber(ARGV[3])
local maxConcurrent = tonumber(ARGV[4])
local leaseId = ARGV[5]
local leaseTtlMs = tonumber(ARGV[6])

-- Check 429 cooldown first
local cooldownTtl = redis.call('PTTL', cooldownKey)
if cooldownTtl > 0 then
  return {0, cooldownTtl}
end

-- Clean expired entries from sliding window
local windowStart = now - windowMs
redis.call('ZREMRANGEBYSCORE', rateKey, '-inf', windowStart)

-- Check rate limit
local currentCount = redis.call('ZCARD', rateKey)
if currentCount >= maxRequests then
  -- Calculate when the oldest entry expires
  local oldest = redis.call('ZRANGE', rateKey, 0, 0, 'WITHSCORES')
  local retryAfter = 0
  if #oldest >= 2 then
    retryAfter = tonumber(oldest[2]) + windowMs - now
    if retryAfter < 0 then retryAfter = 0 end
  end
  return {0, retryAfter}
end

-- Clean expired leases
local leases = redis.call('HGETALL', concKey)
for i = 1, #leases, 2 do
  local expiry = tonumber(leases[i + 1])
  if expiry and expiry < now then
    redis.call('HDEL', concKey, leases[i])
  end
end

-- Check concurrency
local activeLeases = redis.call('HLEN', concKey)
if activeLeases >= maxConcurrent then
  -- Find earliest lease expiry for retry hint
  local minExpiry = now + leaseTtlMs
  leases = redis.call('HGETALL', concKey)
  for i = 1, #leases, 2 do
    local expiry = tonumber(leases[i + 1])
    if expiry and expiry < minExpiry then
      minExpiry = expiry
    end
  end
  return {0, minExpiry - now}
end

-- All checks passed — acquire lease and record rate limit entry
redis.call('ZADD', rateKey, now, leaseId)
redis.call('PEXPIRE', rateKey, windowMs)
redis.call('HSET', concKey, leaseId, now + leaseTtlMs)
redis.call('PEXPIRE', concKey, leaseTtlMs)

return {1, 0}
`;

/**
 * Release a concurrency lease.
 * Idempotent — double-release is safe (HDEL of non-existent key is a no-op).
 *
 * KEYS[1]: concurrency key
 * ARGV[1]: lease ID
 *
 * Returns: 1 if released, 0 if didn't exist (stale/already released)
 */
const RELEASE_LEASE_LUA = `
return redis.call('HDEL', KEYS[1], ARGV[1])
`;

/**
 * Set 429 cooldown (distributed across all processes).
 *
 * KEYS[1]: cooldown key
 * ARGV[1]: cooldown duration (ms)
 *
 * Returns: "OK"
 */
const SET_COOLDOWN_LUA = `
redis.call('SET', KEYS[1], '1')
redis.call('PEXPIRE', KEYS[1], tonumber(ARGV[1]))
return 'OK'
`;

// ──────────────────────────────────────────────
// RATE LIMITER
// ──────────────────────────────────────────────

export class DynadotRateLimiter {
  private readonly redis: Redis;
  private readonly config: RateLimiterConfig;
  private leaseCounter = 0;

  constructor(redis: Redis, config?: Partial<RateLimiterConfig>) {
    this.redis = redis;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Attempt to acquire a rate limit slot and concurrency lease.
   * Returns a LeaseResult indicating whether the request can proceed.
   */
  async acquireLease(): Promise<LeaseResult> {
    const leaseId = this.generateLeaseId();
    const now = Date.now();

    const result = await this.redis.eval(
      ACQUIRE_LEASE_LUA,
      3,
      this.rateKey(),
      this.concurrencyKey(),
      this.cooldownKey(),
      now.toString(),
      (this.config.windowSeconds * 1000).toString(),
      this.config.maxRequests.toString(),
      this.config.maxConcurrent.toString(),
      leaseId,
      (this.config.leaseTtlSeconds * 1000).toString(),
    ) as [number, number];

    const [allowed, retryAfterMs] = result;

    return {
      acquired: allowed === 1,
      leaseId,
      retryAfterMs: allowed === 0 ? retryAfterMs : undefined,
    };
  }

  /**
   * Release a concurrency lease after request completes.
   * Idempotent — safe to call multiple times (double-release harmless).
   */
  async releaseLease(leaseId: string): Promise<void> {
    await this.redis.eval(
      RELEASE_LEASE_LUA,
      1,
      this.concurrencyKey(),
      leaseId,
    );
  }

  /**
   * Set a distributed 429 cooldown.
   * All processes sharing this Redis will respect this cooldown.
   *
   * @param retryAfterSeconds - Duration from Retry-After header, or default
   */
  async setCooldown(retryAfterSeconds?: number): Promise<void> {
    const cooldownMs = (retryAfterSeconds ?? this.config.defaultCooldownSeconds) * 1000;

    await this.redis.eval(
      SET_COOLDOWN_LUA,
      1,
      this.cooldownKey(),
      cooldownMs.toString(),
    );
  }

  /**
   * Check if we're currently in a 429 cooldown period.
   */
  async isInCooldown(): Promise<boolean> {
    const ttl = await this.redis.pttl(this.cooldownKey());
    return ttl > 0;
  }

  // ── Private Helpers ──

  private generateLeaseId(): string {
    this.leaseCounter++;
    return `${process.pid}_${Date.now()}_${this.leaseCounter}`;
  }

  private rateKey(): string {
    return `${this.config.keyPrefix}:rate`;
  }

  private concurrencyKey(): string {
    return `${this.config.keyPrefix}:conc`;
  }

  private cooldownKey(): string {
    return `${this.config.keyPrefix}:cooldown`;
  }
}
