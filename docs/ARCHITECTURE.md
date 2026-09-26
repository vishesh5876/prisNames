# PrisNames — System Architecture

> **Architecture Pattern**: Modular Monolith  
> **Processes**: Web (Next.js) + API (NestJS+Fastify) + Worker (BullMQ)

---

## 1. Architecture Overview

```
                    PrisNames.com
                         │
                         ▼
                    Next.js Web (apps/web)
                         │
                         ▼
                 NestJS + Fastify (apps/api)
                         │
            ┌────────────┼─────────────┐
            │            │             │
            ▼            ▼             ▼
       PostgreSQL      Redis         BullMQ
                                        │
                                        ▼
                                   Worker Layer (apps/worker)
                                        │
                                        ▼
                                RegistrarResolver
                                        │
                                        ▼
                              RegistrarProvider
                                        │
                                        ▼
                             Dynadot Provider V1
```

### Why Modular Monolith

- Three application processes (web, api, worker) share a single codebase
- Architectural module boundaries are enforced via package structure, not network calls
- No premature microservices, Kubernetes, Kafka, RabbitMQ, or service mesh
- Worker and API can scale horizontally independently if needed, but share the same code packages
- Module boundaries are enforceable at compile time via TypeScript import rules

---

## 2. Data Flow

### 2.1 Customer Request Flow

```
Browser → Next.js (SSR/CSR) → API Route (/api/v1/*)
                                    │
                                    ▼
                              NestJS Controller
                                    │
                                    ▼
                              NestJS Service
                              ┌─────┼─────┐
                              │     │     │
                              ▼     ▼     ▼
                           Drizzle Redis  BullMQ
                           (PG)   (Cache) (Queue)
```

### 2.2 Registrar Operation Flow

```
NestJS Service → BullMQ Queue → Worker Process
                                      │
                                      ▼
                              RegistrarResolver
                                      │
                                      ▼
                         DynadotRegistrarProvider
                              ┌───────┼──────┐
                              │       │      │
                              ▼       ▼      ▼
                           HTTP   Signature  Rate
                           Client  Service  Limiter
                              │
                              ▼
                         Dynadot API
```

### 2.3 Webhook Ingestion Flow

```
Dynadot → POST /api/v1/webhooks/dynadot
                    │
                    ▼
          Signature Verification
                    │
                    ▼
          Idempotency Check (event_id)
                    │
                    ▼
          Store Raw Payload (encrypted)
                    │
                    ▼
          Return 200 immediately
                    │
                    ▼
          BullMQ → Webhook Handler
                    │
                    ▼
          Correlate to internal entities
                    │
                    ▼
          Invoke owning services
```

---

## 3. Package Architecture

### 3.1 Application Packages

| Package | Type | Depends On |
|---------|------|-----------|
| `apps/web` | Next.js | `packages/contracts`, `packages/ui`, `packages/config` |
| `apps/api` | NestJS + Fastify | `packages/database`, `packages/contracts`, `packages/config`, `packages/registrar-core`, `packages/registrar-dynadot`, `packages/payment-core`, `packages/email-core`, `packages/logger`, `packages/security` |
| `apps/worker` | BullMQ | `packages/database`, `packages/contracts`, `packages/config`, `packages/registrar-core`, `packages/registrar-dynadot`, `packages/logger` |

### 3.2 Shared Packages

| Package | Purpose | Consumers |
|---------|---------|-----------|
| `packages/database` | Drizzle schema, migrations, connection pool | api, worker |
| `packages/contracts` | Shared types, DTOs, Zod schemas, enums | web, api, worker |
| `packages/ui` | Shared React primitives (design system components) | web |
| `packages/config` | Environment validation (Zod), constants | web, api, worker |
| `packages/registrar-core` | `RegistrarProvider` interface, normalized models, `RegistrarResolver` | api, worker |
| `packages/registrar-dynadot` | `DynadotRegistrarProvider`, Dynadot DTOs, mappers, webhook handlers | api, worker |
| `packages/payment-core` | `PaymentProvider` interface, normalized models | api, worker |
| `packages/email-core` | `EmailProvider` interface, email templates, types | api, worker |
| `packages/logger` | Structured JSON logging, redaction rules | api, worker, web (server) |
| `packages/security` | Argon2id hashing, AES encryption, token generation, HMAC utilities | api, worker |

### 3.3 Import Rules

```
apps/web       → packages/contracts, packages/ui, packages/config
apps/api       → packages/* (all)
apps/worker    → packages/* (except ui)
packages/registrar-dynadot → packages/registrar-core (ONLY)
packages/payment-core      → packages/contracts (types only)
packages/email-core        → packages/contracts (types only)
packages/registrar-core    → packages/contracts (types only)
```

**Critical Rule**: `packages/registrar-dynadot` NEVER appears in `apps/api` service layer imports. Services depend on `packages/registrar-core` interfaces. The Dynadot module is registered via NestJS dependency injection.

---

## 4. API Design

### 4.1 REST API

- Base path: `/api/v1`
- Content type: `application/json`
- Versioned: explicit `/v1/` prefix
- Documentation: OpenAPI/Swagger auto-generated from NestJS decorators

### 4.2 Error Model

All API errors follow a consistent structure:

```json
{
  "error": {
    "code": "DOMAIN_NOT_AVAILABLE",
    "message": "This domain is no longer available.",
    "requestId": "req_a1b2c3d4"
  }
}
```

- `code`: Machine-readable error code (string enum)
- `message`: Human-readable description (safe for display)
- `requestId`: Correlation ID for debugging

**Rule**: Raw provider errors are NEVER exposed to customers. Dynadot error details are logged internally and mapped to PrisNames error codes.

### 4.3 Response Envelope

Successful responses return the resource directly (no envelope wrapper):

```json
// GET /api/v1/domains/example.com
{
  "fqdn": "example.com",
  "lifecycle_status": "ACTIVE",
  "expires_at": "2027-09-12T00:00:00Z"
}
```

Paginated responses include pagination metadata:

```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "pageSize": 25,
    "totalItems": 142,
    "totalPages": 6
  }
}
```

---

## 5. Request/Correlation ID Propagation

Every API request receives a unique correlation ID (`X-Request-ID` header or generated UUID v4). This ID propagates through:

```
HTTP Request (X-Request-ID)
    │
    ├── NestJS request context
    ├── Structured log entries (field: requestId)
    ├── BullMQ job data (field: correlationId)
    ├── Registrar operations (registrar_operations.provider_request_id)
    ├── Dynadot API call (X-Request-ID header)
    ├── Audit log entries (field: request_id)
    └── Email dispatch metadata (where useful)
```

**Implementation**: NestJS `ClsModule` (Continuation Local Storage) or AsyncLocalStorage for automatic propagation within the request lifecycle.

---

## 6. Structured Logging

### 6.1 Format

Production: JSON structured logs. Development: human-readable with optional colors.

### 6.2 Field Catalog

| Field | Type | Description |
|-------|------|-------------|
| `timestamp` | ISO 8601 | Log time |
| `level` | string | `debug`, `info`, `warn`, `error`, `fatal` |
| `service` | string | `api`, `worker`, `web` |
| `requestId` | UUID | Correlation ID |
| `userId` | UUID | Authenticated user (if present) |
| `domainId` | UUID | Domain context (if relevant) |
| `orderId` | UUID | Order context (if relevant) |
| `paymentId` | UUID | Payment context (if relevant) |
| `jobId` | string | BullMQ job ID (if relevant) |
| `provider` | string | Registrar provider ID (if relevant) |
| `event` | string | Structured event name |
| `duration_ms` | number | Operation duration |
| `error` | object | Error details (message, stack in dev only) |

### 6.3 Redaction Rules

The following fields are NEVER written to logs:

- Passwords and password hashes
- OTP values
- API keys and secrets (Dynadot, payment, email)
- Session tokens and cookies
- Full registrant PII (name, address, phone — use `[REDACTED]`)
- Payment card numbers or financial secrets
- Webhook raw payloads
- X-Signature values
- Auth/EPP codes

**Implementation**: Logger middleware strips these fields before serialization using a configurable blocklist.

---

## 7. Caching Strategy

Redis is used for caching, not as authoritative storage. If Redis is unavailable, the system degrades gracefully (slower but functional for non-cache-dependent operations).

| Cache Key Pattern | TTL | Purpose |
|-------------------|-----|---------|
| `domain:availability:{fqdn}` | 60s | Domain search availability |
| `tld:pricing:{tld}:{currency}` | 1h | TLD pricing |
| `provider:health:{providerId}` | 30s | Provider health status |
| `lock:domain-registration:{fqdn}` | 5min | Distributed domain lock |
| `lock:domain-operation:{domainId}:{opType}` | 5min | Operation lock |
| `rate:api:{userId}` | 60s | API rate limiting |
| `rate:auth:{ip}` | 15min | Auth brute force protection |
| `rate:dynadot:{minute}` | 60s | Dynadot rate limit counter |
| `session:{sessionId}` | configurable | Server-side session data |
| `idempotency:{key}` | 24h | Idempotency key storage |

---

## 8. Queue Architecture

BullMQ is used for all asynchronous, scheduled, and retryable operations. All queues share the same Redis instance.

### 8.1 Queue Definitions

| Queue Name | Concurrency | Purpose |
|------------|-------------|---------|
| `domain-registration` | ≤ thread limit | Domain registration jobs |
| `domain-renewal` | ≤ thread limit | Domain renewal jobs |
| `domain-transfer` | ≤ thread limit | Transfer-in jobs |
| `domain-restore` | ≤ thread limit | Domain restore jobs |
| `webhook-processing` | 10 | Webhook async processing |
| `reconciliation` | 2 | Stale operation detection, domain sync |
| `email-dispatch` | 5 | Transactional email sending |
| `pricing-sync` | 1 | TLD pricing synchronization |
| `provider-health` | 1 | Provider health checks |
| `expiration-notifications` | 3 | Domain expiration reminders |

**Critical**: All queues that call Dynadot (`domain-*`) have their combined concurrency limited to the Dynadot account tier thread limit via `DynadotConcurrencyGuard`.

### 8.2 Job Lifecycle

```
Enqueue → WAITING → ACTIVE → COMPLETED | FAILED
                                          │
                                          ▼ (if retries remaining)
                                      DELAYED → WAITING → ACTIVE
                                                              │
                                                              ▼ (max retries)
                                                           FAILED → DLQ
```

### 8.3 Dead Letter Queue (DLQ)

Failed jobs after max retries are moved to a DLQ (`{queueName}-dlq`). Admin dashboard shows DLQ size and allows manual retry or dismissal. DLQ items trigger admin alerts.

---

## 9. Feature Flags

Lightweight database-backed feature flags for operational control without code deploys.

| Flag | Type | Default | Purpose |
|------|------|---------|---------|
| `DOMAIN_REGISTRATION` | boolean | true | Enable/disable registration globally |
| `DOMAIN_RENEWAL` | boolean | true | Enable/disable renewals |
| `DOMAIN_TRANSFER` | boolean | true | Enable/disable transfers |
| `WHOIS_PRIVACY` | boolean | true | Enable/disable privacy management |
| `CRYPTO_PAYMENTS` | boolean | false | Enable crypto payment options |
| `PHONEPE` | boolean | false | Enable PhonePe payments |
| `PROVIDER_DYNADOT` | boolean | true | Enable/disable Dynadot provider |

**Implementation**: `feature_flags` table in PostgreSQL, cached in Redis (60s TTL). Checkable via `FeatureFlagService.isEnabled(flag)`.

---

## 10. Provider Health

Track upstream registrar health for operational monitoring and future multi-provider routing.

```typescript
interface ProviderHealthStatus {
  providerId: string;
  available: boolean;
  latencyMs: number;
  errorRate: number;           // errors / total in window
  lastSuccessAt: Date | null;
  lastFailureAt: Date | null;
  registrationSuccessRate: number;
  pricingSyncStatus: 'current' | 'stale' | 'failed';
  circuitBreakerState: 'closed' | 'open' | 'half-open';
}
```

**Health Check Job**: Runs every 60 seconds, calls a lightweight Dynadot endpoint (e.g., `get_account_info`). Results cached in Redis. Circuit breaker opens after 5 consecutive failures, enters half-open after 30 seconds.

---

## 11. Development Tooling

| Tool | Purpose |
|------|---------|
| **Docker Compose** | Local PostgreSQL, Redis, Mailpit |
| **Turborepo** | Build orchestration, caching |
| **pnpm** | Package management |
| **ESLint** | Linting (strict TypeScript rules) |
| **Prettier** | Code formatting |
| **Vitest** | Unit and integration testing |
| **Playwright** | End-to-end testing |
| **Drizzle Kit** | Database migrations and studio |
| **Mailpit** | Local email testing |

### 11.1 Development Scripts

```
pnpm dev           # Start all processes (web, api, worker)
pnpm build         # Build all packages and apps
pnpm lint          # Lint all packages and apps
pnpm format        # Format all code
pnpm typecheck     # TypeScript type checking
pnpm test          # Run all unit tests
pnpm test:int      # Run integration tests
pnpm test:e2e      # Run end-to-end tests
pnpm db:generate   # Generate Drizzle migration
pnpm db:migrate    # Run pending migrations
pnpm db:seed       # Seed development data
pnpm db:studio     # Open Drizzle Studio
```

---

## 12. Accessibility & SEO

### Accessibility

Target: WCAG 2.2 AA compliance.

- Keyboard navigation
- Focus states
- Semantic HTML
- Accessible forms with labels
- Sufficient color contrast
- Screen reader compatibility

### SEO

- Public pages server-rendered via Next.js App Router
- Proper metadata, canonical URLs, OpenGraph tags
- Sitemap and robots.txt
- Structured data (JSON-LD) for domain search pages
- `/dashboard` and `/admin` routes are `noindex` (authenticated content)
