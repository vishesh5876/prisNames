import pino from 'pino';

/**
 * Sensitive field names that must NEVER appear in logs.
 * See ARCHITECTURE.md §6.3 for the full redaction policy.
 *
 * These cover both top-level fields and nested structures like:
 * req.headers.cookie, req.body.password, metadata.tokenHash, etc.
 */
const REDACTED_FIELDS = [
  'password',
  'currentPassword',
  'newPassword',
  'passwordHash',
  'otpHash',
  'otp',
  'token',
  'tokenHash',
  'resetToken',
  'apiKey',
  'apiSecret',
  'authSecret',
  'encryptionKey',
  'webhookSecret',
  'webhookKey',
  'sessionToken',
  'cookie',
  'authorization',
  'authCode',
  'eppCode',
  'cardNumber',
  'cvv',
  'rawPayload',
  'xSignature',
];

/**
 * Additional nested paths for HTTP request/response logging.
 * Pino redacts exact paths — we need explicit nested paths for
 * structures like req.headers.cookie and res.headers['set-cookie'].
 */
const NESTED_PATHS = [
  'req.headers.cookie',
  'req.headers.authorization',
  'res.headers.set-cookie',
  'req.body.password',
  'req.body.currentPassword',
  'req.body.newPassword',
  'req.body.otp',
  'req.body.token',
  'metadata.token',
  'metadata.otp',
  'metadata.passwordHash',
  'metadata.tokenHash',
];

export interface CreateLoggerOptions {
  service: string;
  level?: string;
  pretty?: boolean;
}

/**
 * Create a structured logger instance for a PrisNames service.
 *
 * Uses JSON format in production, pretty-printed in development.
 * Automatically redacts sensitive fields per ARCHITECTURE.md §6.3.
 */
export function createLogger(options: CreateLoggerOptions): pino.Logger {
  const { service, level = 'info', pretty = false } = options;

  return pino({
    name: service,
    level,
    redact: {
      paths: [
        ...REDACTED_FIELDS.map((p) => `*.${p}`),
        ...REDACTED_FIELDS,
        ...NESTED_PATHS,
      ],
      censor: '[REDACTED]',
    },
    ...(pretty
      ? {
          transport: {
            target: 'pino-pretty',
            options: {
              colorize: true,
              translateTime: 'SYS:standard',
              ignore: 'pid,hostname',
            },
          },
        }
      : {}),
  });
}

export type Logger = pino.Logger;
