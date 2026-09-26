/**
 * PrisNames — SMTP Email Provider
 *
 * Sends email via SMTP. In development, this connects to Mailpit
 * (port 1025) for local email testing at http://localhost:8025.
 */

import { createTransport, type Transporter } from 'nodemailer';
import type { EmailProvider, EmailMessage } from '../types.js';

export interface SmtpConfig {
  host: string;
  port: number;
  from: string;
  /** Set to true for production SMTP with TLS/auth */
  secure?: boolean;
  auth?: {
    user: string;
    pass: string;
  };
}

export class SmtpEmailProvider implements EmailProvider {
  private transporter: Transporter;
  private from: string;

  constructor(config: SmtpConfig) {
    this.from = config.from;
    this.transporter = createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure ?? false,
      ...(config.auth ? { auth: config.auth } : {}),
    });
  }

  async send(message: EmailMessage): Promise<void> {
    await this.transporter.sendMail({
      from: this.from,
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
    });
  }
}
