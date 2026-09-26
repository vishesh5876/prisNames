/**
 * PrisNames — Email Provider Interface
 *
 * Abstraction for email sending. Production and development
 * implementations are separate.
 */

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export interface EmailProvider {
  /**
   * Send an email message.
   * Implementations should throw on failure (not silently swallow errors).
   */
  send(message: EmailMessage): Promise<void>;
}

/**
 * Represents a sent email captured by the in-memory provider (for testing).
 */
export interface SentEmail extends EmailMessage {
  sentAt: Date;
}
