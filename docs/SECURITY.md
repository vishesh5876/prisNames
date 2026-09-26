# PrisNames — Security Architecture

> **Principle**: Production security from day one  
> **Password Hashing**: Argon2id  
> **Sessions**: Server-side, HttpOnly, Secure, SameSite  
> **Validation**: Zod, backend-enforced

---

## 1. Security Headers

Applied via NestJS middleware to all responses:

| Header | Value | Purpose |
|--------|-------|---------|
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` | Force HTTPS |
| `X-Content-Type-Options` | `nosniff` | Prevent MIME sniffing |
| `X-Frame-Options` | `DENY` | Prevent clickjacking |
| `Content-Security-Policy` | Configured per deployment | XSS protection |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Limit referrer leakage |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` | Disable unused APIs |
| `X-XSS-Protection` | `0` | Disabled (CSP is the modern approach) |

---

## 2. CORS Policy

```typescript
{
  origin: ['https://prisnames.com'],   // Production
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  credentials: true,                   // Allow cookies
  maxAge: 86400,                       // 24h preflight cache
}
```

Development: `http://localhost:3000` (Next.js dev server).

---

## 3. CSRF Protection

- SameSite=Lax cookies provide baseline CSRF protection
- State-changing operations (POST, PUT, DELETE) require valid session cookie
- API endpoints verify Origin/Referer headers for additional protection
- Future: CSRF tokens for form submissions if needed

---

## 4. Rate Limiting

Redis-backed rate limiting applied at multiple levels:

| Category | Scope | Limit | Window | Key Pattern |
|----------|-------|-------|--------|-------------|
| **API general** | Per user | 100 req | 1 min | `rate:api:{userId}` |
| **API general** | Per IP (unauthenticated) | 30 req | 1 min | `rate:api:ip:{ip}` |
| **Auth login** | Per IP | 10 req | 15 min | `rate:auth:login:{ip}` |
| **Auth register** | Per IP | 5 req | 1 hour | `rate:auth:register:{ip}` |
| **Auth forgot-password** | Per email | 3 req | 1 hour | `rate:auth:forgot:{email_hash}` |
| **Auth verify-email** | Per user | 5 req | 15 min | `rate:auth:verify:{userId}` |
| **Domain search** | Per user | 30 req | 1 min | `rate:search:{userId}` |
| **Admin operations** | Per admin | 200 req | 1 min | `rate:admin:{userId}` |

Implementation: Sliding window counter using Redis INCR + EXPIRE.

---

## 5. Input Validation

- **Zod schemas** define input shapes shared between frontend and backend (`packages/contracts`)
- **Backend validates all inputs** regardless of frontend validation
- **Never trust the browser**
- Validation errors return structured error responses with field-level details
- Maximum payload size enforced via Fastify body limit (1 MB default)

---

## 6. Authentication Security

See AUTH.md for full details. Key security properties:

| Property | Implementation |
|----------|---------------|
| Password hashing | Argon2id (64 MB memory, 3 iterations, 4 parallelism) |
| Session storage | Server-side (PostgreSQL), ID in HttpOnly cookie |
| Cookie security | HttpOnly, Secure, SameSite=Lax |
| Password reset | Cryptographic token, hashed, short-lived (1 hour), single-use |
| Email verification | Cryptographic OTP, hashed, expires (10 min), max attempts |
| No email enumeration | Login and forgot-password always return generic messages |
| Session revocation | Individual or all sessions |
| Brute force | Redis-backed rate limiting per IP/email |

---

## 7. RBAC Enforcement

- Authorization is enforced on the **backend only**
- Frontend visibility is NOT authorization — hiding a button does not protect the endpoint
- NestJS guards (`@Roles(Role.ADMIN)`) check user roles from session data
- Resource ownership: USER-role queries are always scoped by `user_id` from session
- Admin actions on sensitive resources are audit-logged

See AUTH.md §7 for the full role capability matrix.

---

## 8. Secret Management

### 8.1 Environment Variables

All secrets are provided via environment variables. Never in source control.

| Secret | Variable | Rotation |
|--------|----------|----------|
| Database connection | `DATABASE_URL` | Per deployment |
| Redis connection | `REDIS_URL` | Per deployment |
| Session secret | `AUTH_SECRET` | Periodic rotation |
| Dynadot API key | `DYNADOT_API_KEY` | Per environment |
| Dynadot API secret | `DYNADOT_API_SECRET` | Per environment |
| Dynadot webhook key | `DYNADOT_WEBHOOK_KEY` | Per environment |
| Dynadot webhook secret | `DYNADOT_WEBHOOK_SECRET` | Per environment |
| Encryption key | `ENCRYPTION_KEY` | Rotation with re-encryption |
| Email provider key | `EMAIL_API_KEY` | Per provider |
| Payment provider keys | `PAYMENT_*_KEY` | Per provider |

### 8.2 .env.example

```env
# Application
NODE_ENV=development
PORT=4000

# Database
DATABASE_URL=postgresql://prisnames:prisnames@localhost:5432/prisnames

# Redis
REDIS_URL=redis://localhost:6379

# Auth
AUTH_SECRET=change-me-in-production
COOKIE_DOMAIN=localhost
SESSION_MAX_AGE_SECONDS=604800

# Dynadot
DYNADOT_ENVIRONMENT=sandbox
DYNADOT_API_KEY=
DYNADOT_API_SECRET=
DYNADOT_WEBHOOK_KEY=
DYNADOT_WEBHOOK_SECRET=
DYNADOT_ACCOUNT_TIER=REGULAR

# Encryption
ENCRYPTION_KEY=

# Email
EMAIL_PROVIDER=mailpit
EMAIL_API_KEY=

# Logging
LOG_LEVEL=debug
LOG_FORMAT=pretty
```

### 8.3 Startup Validation

All required environment variables are validated at application boot using Zod schemas (`packages/config`). Missing or invalid values cause a fatal startup error with descriptive message.

---

## 9. Sensitive Data Protection

### 9.1 PII Protection

| Data | Storage | Logging | Access |
|------|---------|---------|--------|
| Registrant name | Encrypted (AES-256-GCM) | `[REDACTED]` | Owner, ADMIN, SUPER_ADMIN |
| Registrant email | Encrypted | `[REDACTED]` | Owner, ADMIN, SUPER_ADMIN |
| Registrant phone | Encrypted | `[REDACTED]` | Owner, ADMIN, SUPER_ADMIN |
| Registrant address | Encrypted | `[REDACTED]` | Owner, ADMIN, SUPER_ADMIN |
| Password hashes | Argon2id | Never logged | Never readable |
| OTP values | SHA-256 hashed | Never logged | Never readable |
| Auth/EPP codes | SHA-256 hashed or not stored | Never logged | One-time display only |
| Session tokens | UUID in cookie | Never logged | HttpOnly cookie |
| API keys | Environment variable | Never logged | Never readable via API |
| Webhook payloads | Encrypted (BYTEA) | Never logged | ADMIN, SUPER_ADMIN only |

### 9.2 Data at Rest Encryption

Application-level encryption (AES-256-GCM) for:
- Registrant contact PII fields
- Webhook raw payloads
- Registrar operation raw responses
- Payment gateway responses

Encryption key (`ENCRYPTION_KEY`) is managed separately from database credentials.

---

## 10. Dynadot Credential Isolation

Dynadot credentials are split across 4 separate environment variables:

| Variable | Purpose | Used By |
|----------|---------|---------|
| `DYNADOT_API_KEY` | API authentication (Bearer token) | HTTP client |
| `DYNADOT_API_SECRET` | X-Signature HMAC-SHA256 generation | Signature service |
| `DYNADOT_WEBHOOK_KEY` | Inbound webhook Authorization header verification | Webhook verifier |
| `DYNADOT_WEBHOOK_SECRET` | Inbound webhook X-Signature verification | Webhook verifier |

**Rules:**
- API secret is NEVER logged, NEVER in error messages, NEVER in stack traces
- Webhook secret is NEVER logged
- If signature verification fails, log the failure event but NOT the secret or the signature value
- Credentials are injected into the Dynadot module via NestJS ConfigService

---

## 11. Dynadot Sandbox Safeguards

```
┌───────────────────────────────────────────────┐
│ Sandbox Safety Architecture                    │
├───────────────────────────────────────────────┤
│                                                │
│ DYNADOT_BASE_URL is NEVER configurable.        │
│ It is ALWAYS derived from DYNADOT_ENVIRONMENT. │
│                                                │
│ sandbox    → https://api-sandbox.dynadot.com   │
│ production → https://api.dynadot.com           │
│                                                │
│ STARTUP ASSERTION:                             │
│ NODE_ENV=production ↔ DYNADOT_ENVIRONMENT=production │
│ Any other NODE_ENV → DYNADOT_ENVIRONMENT=sandbox     │
│ Violation → process.exit(1)                    │
│                                                │
│ CI/CD: Production keys are NEVER in CI.        │
│                                                │
└───────────────────────────────────────────────┘
```

---

## 12. Admin Route Protection

- All `/admin/*` routes require authenticated session with admin role
- `/admin` routes in Next.js use middleware to check session + role before rendering
- API endpoints under `/api/v1/admin/*` require `@Roles(Role.ADMIN)` or `@Roles(Role.SUPER_ADMIN)`
- Sensitive admin actions (disable account, replay webhook, change pricing) are audit-logged
- Admins cannot read: passwords, OTP values, API secrets, payment credentials

---

## 13. Webhook Security

See DYNADOT_INTEGRATION.md §16 for full webhook raw payload security policy. Summary:

- HMAC-SHA256 signature verification before any processing
- Raw payload encrypted at rest (AES-256-GCM, BYTEA column)
- 90-day retention with scheduled purge
- ADMIN/SUPER_ADMIN access only
- No raw payload logging or observability export
- Replay is audit-logged
- Known fields validated strictly; unknown fields preserved but never forwarded to business logic

---

## 14. Idempotency

Critical operations must be idempotent to survive retries and network issues:

| Operation | Idempotency Method |
|-----------|-------------------|
| Domain registration | Distributed Redis lock + RegistrarOperation record |
| Domain renewal | Distributed Redis lock per domain |
| Transfers | Distributed Redis lock per domain |
| Payment webhooks | `event_id` deduplication in webhook_events |
| Registrar webhooks | `event_id` deduplication in webhook_events |
| Refunds | Refund entity with status tracking |
| Email jobs | BullMQ job deduplication by job ID |
| Admin actions | Request ID + audit log |

---

## 15. Testing Security

- Unit tests for password hashing, OTP generation, token validation
- Integration tests for auth flows, session management, RBAC
- Rate limiting tests with Redis
- Sandbox tests for Dynadot credential verification
- Never use production credentials in tests
- Never register production domains in automated tests
