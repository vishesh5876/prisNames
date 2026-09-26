/**
 * PrisNames — Email Core Package
 */

// Types
export type { EmailProvider, EmailMessage, SentEmail } from './types.js';

// Providers
export { SmtpEmailProvider, type SmtpConfig } from './providers/smtp.js';
export { MemoryEmailProvider } from './providers/memory.js';
