# PrisNames — Authentication & Authorization Architecture

> **Strategy**: Email + Password (V1), server-side sessions, RBAC  
> **Hashing**: Argon2id  
> **Sessions**: Server-side, HttpOnly cookies

---

## 1. Registration Flow

```
Client → POST /api/v1/auth/register
            { email, password, displayName }
                │
                ▼
        Validate input (Zod)
                │
                ▼
        Check email uniqueness
                │
                ▼
        Hash password (Argon2id)
                │
                ▼
        Create user (account_status = ACTIVE, email_verified = false)
                │
                ▼
        Create auth_identity (provider = 'email')
                │
                ▼
        Create password_credential
                │
                ▼
        Assign USER role
                │
                ▼
        Generate OTP → Hash → Store in email_verifications
                │
                ▼
        Queue verification email (BullMQ)
                │
                ▼
        Create session
                │
                ▼
        Set secure cookie
                │
                ▼
        Return user (email_verified = false)
                │
                ▼
        Audit log: 'user.registered'
```

---

## 2. Email Verification

### 2.1 OTP Method (Default)

- **Generation**: Cryptographically secure 6-digit numeric OTP via `crypto.randomInt(100000, 1000000)`. Note: upper bound is exclusive. Always format as exactly 6 digits.
- **Storage**: HMAC-SHA256 with a dedicated `AUTH_OTP_PEPPER` secret before persisting to `email_verifications.otp_hash`. Plaintext OTP is NEVER stored. Plain SHA-256 is NOT used because the 6-digit search space is trivially brute-forceable.
- **Expiration**: Configurable, default 10 minutes. Stored in `email_verifications.expires_at`.
- **Max Attempts**: Default 5. Stored in `email_verifications.attempts`. Exceeded → invalidate, require resend.
- **Resend**: Invalidates previous OTP (`invalidated = true`), generates new one. Cooldown between resends (default 60 seconds).
- **Rate Limiting**: Max 5 resend requests per email per hour.

### 2.2 Verification Link Method (Alternate)

- Generate secure random token (32 bytes, base64url encoded)
- Hash with SHA-256 before storing
- Embed in URL: `https://prisnames.com/verify-email?token={token}`
- Same expiration and single-use rules

### 2.3 Verification Endpoint

```
POST /api/v1/auth/verify-email
  { otp: "123456" }  // or { token: "..." } for link method
      │
      ▼
  Find active (non-expired, non-invalidated) verification for user
      │
      ▼
  Compare hash
      │
      ▼
  Increment attempts on mismatch
      │
      ▼
  On match: set user.email_verified = true, set verification.verified_at
      │
      ▼
  Audit log: 'user.email_verified'
```

### 2.4 Access Restrictions

Unverified users can:
- View their dashboard
- Manage account settings
- Log out

Unverified users CANNOT:
- Search domains
- Create orders
- Manage domains
- Access any financial features

---

## 3. Login Flow

```
POST /api/v1/auth/login
  { email, password }
      │
      ▼
  Rate limit check (IP-based: 10 attempts per 15 min)
      │
      ▼
  Find user by email
      │
      ▼
   If not found: perform dummy Argon2id verify (anti-timing enumeration),
   return generic "Invalid credentials"
       │
       ▼
   Check account_status (DISABLED → reject, SUSPENDED → reject)
      │
      ▼
  Verify password against Argon2id hash
      │
      ▼
  If mismatch: increment rate limit counter, return generic error
      │
      ▼
  Create session in database
      │
      ▼
   Generate opaque session token → hash (SHA-256) → store hash in sessions.token_hash
       │
       ▼
   Set secure HttpOnly cookie with raw opaque token (NOT the session UUID)
      │
      ▼
  Audit log: 'user.login'
      │
      ▼
  Return user profile + roles
```

---

## 4. Password Security

### 4.1 Argon2id Parameters

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| `type` | Argon2id | Hybrid resistance to side-channel + GPU attacks |
| `memoryCost` | 65536 (64 MB) | OWASP recommended minimum |
| `timeCost` | 3 | Iterations |
| `parallelism` | 4 | Parallel threads |
| `hashLength` | 32 | Output length in bytes |

### 4.2 Password Requirements

- Minimum 8 characters
- No maximum length cap below 128 characters
- Validated via Zod schema shared between frontend and backend
- Frontend provides strength indicator (informational, not blocking beyond minimum)

---

## 5. Session Management

### 5.1 Session Token Architecture

| Property | Value |
|----------|-------|
| **Storage** | `sessions` table in PostgreSQL |
| **Internal PK** | UUID v4 (`sessions.id`) — internal identifier only, never sent to browser |
| **Browser credential** | Cryptographically random opaque token (48 bytes, base64url) |
| **DB storage** | SHA-256 hash of opaque token stored in `sessions.token_hash` (UNIQUE index) |
| **Lookup flow** | Cookie token → SHA-256 hash → find matching `token_hash` row |
| **Duration** | Configurable, default 7 days |
| **Extension** | Sliding window — `last_active_at` refreshed on activity (throttled, distributed-safe) |
| **Revocation** | Individual session or all sessions |

The session UUID is **never** used as the browser authentication credential. Raw session tokens are **never** stored in the database.

### 5.2 Cookie Configuration

| Attribute | Value | Rationale |
|-----------|-------|-----------|
| `HttpOnly` | true | Prevents JS access to session cookie |
| `Secure` | true (production) | HTTPS only |
| `SameSite` | Lax | CSRF protection while allowing top-level navigation |
| `Path` | / | Available to all routes |
| `Domain` | Not set (host-only cookie) | Do not broaden to parent domain. Production: use `__Host-` prefix. |
| `Max-Age` | 604800 seconds (7 days) | Configurable via `SESSION_MAX_AGE_SECONDS`. Note: `@fastify/cookie` uses seconds, not milliseconds. |

### 5.3 Session Listing

Users can view their active sessions:

```json
[
  {
    "id": "session-uuid",
    "ipAddress": "203.0.113.42",
    "userAgent": "Mozilla/5.0 ...",
    "createdAt": "2026-09-10T08:00:00Z",
    "lastActiveAt": "2026-09-12T14:30:00Z",
    "isCurrent": true
  }
]
```

### 5.4 Session Operations

- **List sessions**: `GET /api/v1/auth/sessions`
- **Revoke session**: `DELETE /api/v1/auth/sessions/:id`
- **Revoke all**: `POST /api/v1/auth/sessions/revoke-all` (logs out everywhere)

---

## 6. Password Reset

### 6.1 Forgot Password

```
POST /api/v1/auth/forgot-password
  { email }
      │
      ▼
  Rate limit (3 requests per email per hour)
      │
      ▼
  Find user by email
      │
      ▼
  If not found: return success (no email enumeration)
      │
      ▼
  Generate secure token (32 bytes, base64url)
      │
      ▼
  Hash token (SHA-256) → Store in password_resets
      │
      ▼
  Set expires_at (default 1 hour)
      │
      ▼
  Queue password reset email
      │
      ▼
  Return generic success message
```

### 6.2 Reset Password

```
POST /api/v1/auth/reset-password
  { token, newPassword }
      │
      ▼
  Hash token → Find matching password_resets record
      │
      ▼
  Check not expired, not already used
      │
      ▼
  Hash new password (Argon2id)
      │
      ▼
  Update password_credentials
      │
      ▼
  Mark reset token as used (used_at = now())
      │
      ▼
   Revoke ALL existing sessions for this user
       │
       ▼
   Queue security alert email
      │
      ▼
  Audit log: 'user.password_reset'
```

### 6.3 Change Password (Authenticated)

```
POST /api/v1/auth/change-password
  { currentPassword, newPassword }
      │
      ▼
  Verify current password against hash
      │
      ▼
   Hash new password → Update password_credentials
       │
       ▼
   Revoke all OTHER sessions
       │
       ▼
   Rotate current session credential (new token + hash)
      │
      ▼
  Queue security alert email
      │
      ▼
  Audit log: 'user.password_changed'
```

---

## 7. RBAC — Role-Based Access Control

### 7.1 Roles

| Role | Level | Description |
|------|-------|-------------|
| `USER` | 0 | Default customer role |
| `SUPPORT` | 1 | Customer support staff |
| `FINANCE` | 2 | Financial operations |
| `ABUSE` | 3 | Abuse/compliance team |
| `ADMIN` | 4 | General administration |
| `SUPER_ADMIN` | 5 | Full system control |

A user may have multiple roles (many-to-many via `user_roles`).

### 7.2 Capability Matrix

| Capability | USER | SUPPORT | FINANCE | ABUSE | ADMIN | SUPER_ADMIN |
|-----------|------|---------|---------|-------|-------|-------------|
| Manage own profile | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Manage own domains | ✅ | ❌ | ❌ | ❌ | ✅ | ✅ |
| Manage own orders | ✅ | ❌ | ❌ | ❌ | ✅ | ✅ |
| View own invoices | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Search users | ❌ | ✅ | ❌ | ✅ | ✅ | ✅ |
| View user details | ❌ | ✅ | ❌ | ✅ | ✅ | ✅ |
| View user domains | ❌ | ✅ | ❌ | ✅ | ✅ | ✅ |
| View orders | ❌ | ✅ | ✅ | ❌ | ✅ | ✅ |
| View payments | ❌ | ❌ | ✅ | ❌ | ✅ | ✅ |
| Manage refunds | ❌ | ❌ | ✅ | ❌ | ✅ | ✅ |
| View invoices (all) | ❌ | ❌ | ✅ | ❌ | ✅ | ✅ |
| Manage abuse cases | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| View compliance data | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| Disable user account | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| Force session logout | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| Manage TLD pricing | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| View registrar ops | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| View audit logs | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| Manage roles | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Manage providers | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| System settings | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| View webhook payloads | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| Replay webhooks | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |

### 7.3 Enforcement

- **Backend only**: Authorization is enforced by NestJS guards. Frontend visibility is NOT authorization.
- **Guard implementation**: `@Roles(Role.ADMIN)` decorator + `RolesGuard` that reads user roles from session.
- **Resource ownership**: For USER role, queries are always scoped by `user_id` from session. Users cannot access other users' resources.

---

## 8. Brute Force Protection

| Endpoint | Window | Max Attempts | Lockout |
|----------|--------|-------------|---------|
| `/auth/login` | 15 min | 10 per IP | 15 min block |
| `/auth/register` | 1 hour | 5 per IP | 1 hour block |
| `/auth/forgot-password` | 1 hour | 3 per email | 1 hour block |
| `/auth/verify-email` | 15 min | 5 per user | 15 min block, invalidate OTP |
| `/auth/reset-password` | 15 min | 5 per token | Invalidate token |

Implementation: Redis-backed counters with sliding window. Key pattern: `rate:auth:{endpoint}:{identifier}`.

---

## 9. Future Extensibility

The architecture supports future additions without rebuilding the account model:

| Feature | How |
|---------|-----|
| **OAuth** (Google, GitHub, Apple) | Add `auth_identities` row with provider = 'google', etc. User account remains the same. |
| **2FA / TOTP** | Add `user_totp_credentials` table, additional login step in auth flow |
| **Passkeys / WebAuthn** | Add `user_webauthn_credentials` table, WebAuthn verification in auth flow |
| **API Keys** | Add `user_api_keys` table for programmatic access |
