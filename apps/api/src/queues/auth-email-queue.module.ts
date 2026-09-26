/**
 * PrisNames — Auth Email Queue (BullMQ Producer)
 *
 * Encrypts sensitive delivery material (OTP, reset token) using AES-256-GCM
 * envelope encryption BEFORE placing data into Redis job payloads.
 *
 * Plaintext secrets NEVER exist in BullMQ job data or Redis.
 * The encryption key is sourced from environment variables, NEVER stored in Redis.
 *
 * Flow:
 *   API enqueue → encrypt(secret) → BullMQ.add(encryptedPayload) → Redis
 *   Worker poll → BullMQ.process → decrypt(payload) → send email → remove job
 */

import { Module, Global, Injectable, Inject, Logger, type OnModuleDestroy } from '@nestjs/common';
import { Queue } from 'bullmq';
import type Redis from 'ioredis';
import { REDIS_TOKEN } from '../redis/redis.module.js';
import {
  AUTH_EMAIL_QUEUE,
  AUTH_EMAIL_JOBS,
  AUTH_EMAIL_JOB_RETENTION,
  type AuthEmailJobData,
  type VerificationEmailJobData,
  type ResetEmailJobData,
} from '@prisnames/contracts';
import { createQueueEncryption, type EnvelopeEncryption } from '@prisnames/security';
import { getEnv } from '@prisnames/config';

export const AUTH_EMAIL_QUEUE_TOKEN = 'AUTH_EMAIL_QUEUE';

@Injectable()
export class AuthEmailQueueService implements OnModuleDestroy {
  private readonly logger = new Logger(AuthEmailQueueService.name);
  private readonly queue: Queue<AuthEmailJobData>;
  private readonly encryption: EnvelopeEncryption;

  constructor(@Inject(REDIS_TOKEN) redis: Redis) {
    const env = getEnv();

    // Initialize envelope encryption for queue payloads
    this.encryption = createQueueEncryption(
      env.QUEUE_ENCRYPTION_KEY,
      env.QUEUE_ENCRYPTION_KEY_ID,
    );

    this.queue = new Queue<AuthEmailJobData>(AUTH_EMAIL_QUEUE, {
      connection: redis,
      defaultJobOptions: {
        attempts: AUTH_EMAIL_JOB_RETENTION.attempts,
        backoff: AUTH_EMAIL_JOB_RETENTION.backoff,
        removeOnComplete: AUTH_EMAIL_JOB_RETENTION.removeOnComplete,
        removeOnFail: AUTH_EMAIL_JOB_RETENTION.removeOnFail,
      },
    });
  }

  /**
   * Enqueue a verification email job.
   * The OTP is encrypted before being stored in Redis.
   */
  async enqueueVerification(to: string, otp: string, userId: string): Promise<void> {
    // Encrypt OTP — plaintext never touches Redis
    const encryptedOtp = this.encryption.encrypt(otp);

    const data: VerificationEmailJobData = {
      type: AUTH_EMAIL_JOBS.VERIFICATION,
      to,
      encryptedOtp,
      userId,
    };
    await this.queue.add(AUTH_EMAIL_JOBS.VERIFICATION, data, {
      jobId: `verify-${userId}-${Date.now()}`,
    });
    this.logger.debug({ userId }, 'Verification email job enqueued');
  }

  /**
   * Enqueue a password reset email job.
   * The reset token is encrypted before being stored in Redis.
   */
  async enqueuePasswordReset(to: string, resetToken: string, userId: string): Promise<void> {
    // Encrypt token — plaintext never touches Redis
    const encryptedToken = this.encryption.encrypt(resetToken);

    const data: ResetEmailJobData = {
      type: AUTH_EMAIL_JOBS.PASSWORD_RESET,
      to,
      encryptedToken,
      userId,
    };
    await this.queue.add(AUTH_EMAIL_JOBS.PASSWORD_RESET, data, {
      jobId: `reset-${userId}-${Date.now()}`,
    });
    this.logger.debug({ userId }, 'Password reset email job enqueued');
  }

  async onModuleDestroy(): Promise<void> {
    try {
      await this.queue.close();
    } catch {
      // Ignore close errors during shutdown
    }
  }
}

@Global()
@Module({
  providers: [AuthEmailQueueService],
  exports: [AuthEmailQueueService],
})
export class AuthEmailQueueModule {}
