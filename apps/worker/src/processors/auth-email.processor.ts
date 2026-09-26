/**
 * PrisNames — Auth Email Worker
 *
 * BullMQ worker that processes auth email jobs (verification, password reset).
 * Decrypts the AES-256-GCM encrypted payload before constructing and sending emails.
 *
 * SECURITY:
 * - Job payloads contain encrypted envelopes, NOT plaintext secrets
 * - Decryption happens in-memory just before email construction
 * - Never logs OTPs, reset tokens, plaintext, or ciphertext
 * - Failed jobs are retried with exponential backoff (up to 3 attempts)
 */

import { Worker, type Job } from 'bullmq';
import type Redis from 'ioredis';
import type { Logger } from '@prisnames/logger';
import {
  AUTH_EMAIL_QUEUE,
  AUTH_EMAIL_JOBS,
  type AuthEmailJobData,
} from '@prisnames/contracts';
import type { EmailProvider } from '@prisnames/email-core';
import type { EnvelopeEncryption } from '@prisnames/security';

export function createAuthEmailWorker(
  redis: Redis,
  emailProvider: EmailProvider,
  logger: Logger,
  webUrl: string,
  encryption: EnvelopeEncryption,
): Worker<AuthEmailJobData> {
  const worker = new Worker<AuthEmailJobData>(
    AUTH_EMAIL_QUEUE,
    async (job: Job<AuthEmailJobData>) => {
      const { data } = job;

      switch (data.type) {
        case AUTH_EMAIL_JOBS.VERIFICATION: {
          logger.info({ userId: data.userId, jobId: job.id }, 'Processing verification email job');

          // Decrypt OTP from envelope — plaintext only in memory
          const otp = encryption.decrypt(data.encryptedOtp).toString('utf-8');

          await emailProvider.send({
            to: data.to,
            subject: 'Verify your PrisNames account',
            text: `Your verification code is: ${otp}\n\nThis code expires in 10 minutes.`,
            html: `<p>Your verification code is: <strong>${otp}</strong></p><p>This code expires in 10 minutes.</p>`,
          });
          logger.info({ userId: data.userId, jobId: job.id }, 'Verification email sent');
          break;
        }

        case AUTH_EMAIL_JOBS.PASSWORD_RESET: {
          logger.info({ userId: data.userId, jobId: job.id }, 'Processing password reset email job');

          // Decrypt token from envelope — plaintext only in memory
          const resetToken = encryption.decrypt(data.encryptedToken).toString('utf-8');
          const resetUrl = `${webUrl}/reset-password?token=${resetToken}`;

          await emailProvider.send({
            to: data.to,
            subject: 'Reset your PrisNames password',
            text: `Click the link to reset your password:\n\n${resetUrl}\n\nThis link expires in 1 hour.`,
            html: `<p>Click the link to reset your password:</p><p><a href="${resetUrl}">Reset Password</a></p><p>This link expires in 1 hour.</p>`,
          });
          logger.info({ userId: data.userId, jobId: job.id }, 'Password reset email sent');
          break;
        }

        default:
          logger.warn({ jobName: job.name }, 'Unknown auth email job type');
      }
    },
    {
      connection: redis,
      concurrency: 5,
    },
  );

  worker.on('failed', (job, err) => {
    logger.error(
      { jobId: job?.id, jobName: job?.name, attempt: job?.attemptsMade, err: err.message },
      'Auth email job failed',
    );
  });

  worker.on('error', (err) => {
    logger.error({ err: err.message }, 'Auth email worker error');
  });

  return worker;
}
