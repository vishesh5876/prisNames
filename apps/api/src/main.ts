import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../../../.env') });

import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { validateEnv, getEnv } from '@prisnames/config';
import { createLogger } from '@prisnames/logger';
import { GlobalExceptionFilter } from './common/filters/http-exception.filter.js';
import fastifyCookie from '@fastify/cookie';

/**
 * Parse TRUST_PROXY env value into a Fastify-compatible trustProxy setting.
 *
 * Supports:
 * - "false"     → false (no proxies trusted, direct connections only)
 * - "true"      → true (trust all — ONLY for local dev)
 * - "1", "2"    → number of proxy hops to trust
 * - "10.0.0.0/8,172.16.0.0/12" → trusted CIDR ranges (comma-separated)
 *
 * Default is "false" (conservative — do not blindly trust X-Forwarded-For).
 */
function parseTrustProxy(value: string): boolean | number | string {
  if (value === 'false') return false;
  if (value === 'true') return true;
  const n = Number(value);
  if (!isNaN(n) && Number.isInteger(n) && n >= 0) return n;
  // Treat as comma-separated CIDR list
  return value;
}

async function bootstrap() {
  // Validate environment before anything else
  const env = validateEnv();

  const logger = createLogger({
    service: 'api',
    level: env.LOG_LEVEL,
    pretty: env.LOG_FORMAT === 'pretty',
  });

  const { AppModule } = await import('./app.module.js');

  const trustProxy = parseTrustProxy(env.TRUST_PROXY);

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ trustProxy }),
    { logger: false, rawBody: true },
  );

  // Register @fastify/cookie
  const fastifyInstance = app.getHttpAdapter().getInstance();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await fastifyInstance.register(fastifyCookie as any);

  // CORS per SECURITY.md §2
  app.enableCors({
    origin: [env.WEB_URL],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    credentials: true,
    maxAge: 86400,
  });

  // Global API prefix
  app.setGlobalPrefix('api/v1');

  // Global exception filter
  app.useGlobalFilters(new GlobalExceptionFilter());

  // Security headers via Fastify hook
  // HSTS is deployment-configurable (correction 8: preload defaults false)
  const hstsParts: string[] = [];
  if (env.HSTS_ENABLED) {
    hstsParts.push(`max-age=${env.HSTS_MAX_AGE}`);
    if (env.HSTS_INCLUDE_SUBDOMAINS) hstsParts.push('includeSubDomains');
    if (env.HSTS_PRELOAD) hstsParts.push('preload');
  }
  const hstsHeader = hstsParts.length > 0 ? hstsParts.join('; ') : null;

  fastifyInstance.addHook('onSend', async (_request, reply) => {
    if (hstsHeader) reply.header('Strict-Transport-Security', hstsHeader);
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('X-Frame-Options', 'DENY');
    reply.header('Referrer-Policy', 'strict-origin-when-cross-origin');
    reply.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    reply.header('X-XSS-Protection', '0');
  });

  // CSRF Origin/Referer verification for mutating requests (correction 16)
  // Phase 6: Use env.WEB_URL for all environments (no hardcoded brand domain).
  // Production deployments set WEB_URL to the production origin.
  const allowedOrigins = env.NODE_ENV === 'production'
    ? [env.WEB_URL]
    : [env.WEB_URL, 'http://localhost:3000'];

  fastifyInstance.addHook('preHandler', async (request, reply) => {
    const method = request.method;
    if (['GET', 'HEAD', 'OPTIONS'].includes(method)) return;

    // Only enforce for cookie-authenticated requests
    const cookies = (request as typeof request & { cookies?: Record<string, string> }).cookies || {};
    const hasSessionCookie = cookies['prisnames_sid'] || cookies['__Host-prisnames_sid'];
    if (!hasSessionCookie) return;

    const origin = request.headers.origin;
    if (origin) {
      if (!allowedOrigins.includes(origin)) {
        reply.status(403).send({ error: { code: 'CSRF_ORIGIN_MISMATCH', message: 'Invalid request origin', requestId: '' } });
        return;
      }
      return; // Valid origin — pass
    }

    // Fall back to Referer if no Origin header
    const referer = request.headers.referer;
    if (referer) {
      try {
        const refererOrigin = new URL(referer).origin;
        if (!allowedOrigins.includes(refererOrigin)) {
          reply.status(403).send({ error: { code: 'CSRF_REFERER_MISMATCH', message: 'Invalid request referer', requestId: '' } });
          return;
        }
        return; // Valid referer — pass
      } catch {
        reply.status(403).send({ error: { code: 'CSRF_REFERER_INVALID', message: 'Invalid referer header', requestId: '' } });
        return;
      }
    }

    // CSRF REJECTION: cookie-authenticated mutating request with no Origin AND no Referer.
    // Browsers always send Origin for mutating requests, so missing both
    // indicates a malformed or cross-origin forged request.
    // Non-browser clients that need mutating API access should use
    // a non-cookie authentication mechanism (e.g., API keys — future phase).
    reply.status(403).send({ error: { code: 'CSRF_MISSING_ORIGIN', message: 'Origin or Referer header required for authenticated requests', requestId: '' } });
  });

  // Request ID propagation (ARCHITECTURE.md §5)
  fastifyInstance.addHook('preHandler', async (request, reply) => {
    const requestId = (request.headers['x-request-id'] as string) || crypto.randomUUID();
    request.headers['x-request-id'] = requestId;
    reply.header('x-request-id', requestId);
  });

  // Enable graceful shutdown
  app.enableShutdownHooks();

  const port = getEnv().PORT;
  await app.listen({ port, host: '0.0.0.0' });
  logger.info({ port, trustProxy: String(trustProxy) }, `PrisNames API running on port ${port}`);
}

process.on('uncaughtException', (err) => {
  process.stderr.write(`Uncaught Exception: ${err.stack || err.message}\n`);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  process.stderr.write(`Unhandled Rejection: ${reason}\n`);
  process.exit(1);
});

bootstrap().catch((err) => {
  process.stderr.write(`Failed to start API: ${err.stack || err.message}\n`);
  setTimeout(() => process.exit(1), 100);
});
