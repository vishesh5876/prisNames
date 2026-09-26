/**
 * PrisNames — In-Memory Email Provider (Testing)
 *
 * Captures sent emails for automated tests. No real SMTP.
 * Tests can extract OTPs/tokens from captured messages.
 */

import type { EmailProvider, EmailMessage, SentEmail } from '../types.js';

export class MemoryEmailProvider implements EmailProvider {
  private readonly _sent: SentEmail[] = [];

  async send(message: EmailMessage): Promise<void> {
    this._sent.push({
      ...message,
      sentAt: new Date(),
    });
  }

  /** Get all sent emails (most recent last). */
  get sent(): ReadonlyArray<SentEmail> {
    return this._sent;
  }

  /** Get the most recently sent email, or undefined. */
  get lastSent(): SentEmail | undefined {
    return this._sent[this._sent.length - 1];
  }

  /** Get all emails sent to a specific address. */
  sentTo(email: string): SentEmail[] {
    return this._sent.filter((e) => e.to === email);
  }

  /** Clear all captured emails. */
  clear(): void {
    this._sent.length = 0;
  }

  /** Get total number of sent emails. */
  get count(): number {
    return this._sent.length;
  }
}
