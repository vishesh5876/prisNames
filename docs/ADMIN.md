# PrisNames — Admin Panel Architecture

> **Location**: Same Next.js app under `/admin`  
> **Access**: RBAC-controlled (SUPPORT, FINANCE, ABUSE, ADMIN, SUPER_ADMIN)  
> **Backend**: NestJS endpoints under `/api/v1/admin`

---

## 1. Architecture

### 1.1 No Separate Frontend

The admin panel is NOT a separate application. It exists inside the same Next.js app (`apps/web`) under the `/admin` route group.

```
apps/web/
├── app/
│   ├── (public)/          # Public pages (/, /pricing, etc.)
│   ├── (auth)/            # Auth pages (/login, /register)
│   ├── dashboard/         # Customer dashboard
│   └── admin/             # Admin panel
│       ├── layout.tsx     # Admin shell, sidebar, auth check
│       ├── page.tsx       # Admin dashboard
│       ├── users/
│       ├── domains/
│       ├── orders/
│       ├── payments/
│       ├── refunds/
│       ├── invoices/
│       ├── tlds/
│       ├── pricing/
│       ├── registrars/
│       ├── transfers/
│       ├── renewals/
│       ├── abuse/
│       ├── compliance/
│       ├── audit-logs/
│       ├── emails/
│       ├── settings/
│       └── security/
```

### 1.2 Protection

- Next.js middleware checks session + role before rendering any `/admin` page
- If not authenticated or not an admin role → redirect to `/login`
- API endpoints under `/api/v1/admin/*` require role-based NestJS guards

---

## 2. Admin Routes & API Endpoints

### 2.1 Dashboard

**Route**: `/admin` or `/admin/dashboard`  
**API**: `GET /api/v1/admin/dashboard`

Operational metrics (not vanity charts):

| Metric | Source |
|--------|--------|
| Total users | `COUNT(users)` |
| Active domains | `COUNT(domains) WHERE lifecycle_status = 'ACTIVE'` |
| Registrations today | `COUNT(registrar_operations) WHERE operation_type = 'REGISTER' AND created_at >= today` |
| Renewals today | Same, `operation_type = 'RENEW'` |
| Transfers today | Same, `operation_type = 'TRANSFER_IN'` |
| Domains expiring ≤ 7d | `COUNT(domains) WHERE expires_at BETWEEN now AND now+7d` |
| Domains expiring ≤ 30d | Same, 30 days |
| Domains expiring ≤ 60d | Same, 60 days |
| Revenue today | `SUM(payments.amount) WHERE status = 'SUCCEEDED' AND paid_at >= today` |
| Provider cost today | `SUM(order_items.provider_cost_amount) WHERE completed today` |
| Gross margin today | Revenue - Provider cost |
| Pending registrations | `COUNT(registrar_operations) WHERE status IN ('QUEUED', 'PROCESSING', 'ACCEPTED')` |
| Failed registrations | `COUNT(registrar_operations) WHERE status = 'FAILED' AND created_at >= today` |
| UNKNOWN operations | `COUNT(registrar_operations) WHERE status = 'UNKNOWN'` |
| MANUAL_REVIEW operations | `COUNT(registrar_operations) WHERE status = 'MANUAL_REVIEW'` |
| Failed payments today | `COUNT(payments) WHERE status = 'FAILED' AND created_at >= today` |
| Pending refunds | `COUNT(refunds) WHERE status IN ('CREATED', 'PENDING', 'PROCESSING')` |
| Dynadot account balance | Via `RegistrarProvider.getAccountInfo()`, cached |
| Dynadot provider health | Circuit breaker state, latency, error rate |
| Open abuse cases | `COUNT(abuse_cases) WHERE status NOT IN ('RESOLVED', 'REJECTED')` |
| DLQ sizes | BullMQ dead letter queue counts |

**Rule**: Do not create meaningless charts just to fill space. Every metric must have operational value.

---

### 2.2 User Management

**Route**: `/admin/users`, `/admin/users/[id]`  
**API**: `/api/v1/admin/users`

| Endpoint | Method | Role | Description |
|----------|--------|------|-------------|
| `/admin/users` | GET | SUPPORT+ | Search/filter/paginate users |
| `/admin/users/:id` | GET | SUPPORT+ | User detail (profile, domains, orders, sessions) |
| `/admin/users/:id/domains` | GET | SUPPORT+ | User's domains |
| `/admin/users/:id/orders` | GET | SUPPORT+ | User's orders |
| `/admin/users/:id/payments` | GET | FINANCE+ | User's payments |
| `/admin/users/:id/invoices` | GET | FINANCE+ | User's invoices |
| `/admin/users/:id/sessions` | GET | ADMIN+ | User's active sessions |
| `/admin/users/:id/activity` | GET | ADMIN+ | User's audit log |
| `/admin/users/:id/abuse` | GET | ABUSE+ | User's abuse history |
| `/admin/users/:id/registrar-ops` | GET | ADMIN+ | User's registrar operations |
| `/admin/users/:id/disable` | POST | ADMIN+ | Disable account (requires reason) |
| `/admin/users/:id/enable` | POST | ADMIN+ | Re-enable account |
| `/admin/users/:id/force-logout` | POST | ADMIN+ | Revoke all sessions |
| `/admin/users/:id/trigger-reset` | POST | ADMIN+ | Trigger password reset email |
| `/admin/users/:id/roles` | PUT | SUPER_ADMIN | Assign/remove roles |

**Sensitive action rule**: Disable, enable, force-logout, trigger-reset, and role changes require `reason` field and are audit-logged.

**Admins can NEVER read**: passwords, plaintext OTPs, session tokens, API credentials.

---

### 2.3 Domain Management

**Route**: `/admin/domains`, `/admin/domains/[domain]`  
**API**: `/api/v1/admin/domains`

| Endpoint | Method | Role | Description |
|----------|--------|------|-------------|
| `/admin/domains` | GET | SUPPORT+ | Search/filter/paginate domains |
| `/admin/domains/:domain` | GET | SUPPORT+ | Domain detail (status, contacts, NS, DNS, history) |
| `/admin/domains/:domain/operations` | GET | ADMIN+ | Registrar operations for this domain |
| `/admin/domains/:domain/events` | GET | ADMIN+ | Domain events log |
| `/admin/domains/:domain/suspend` | POST | ABUSE+ | Suspend domain (requires type + reason) |
| `/admin/domains/:domain/unsuspend` | POST | ABUSE+ | Remove suspension |
| `/admin/domains/:domain/reconcile` | POST | ADMIN+ | Force reconciliation with provider |

---

### 2.4 Order Management

**Route**: `/admin/orders`, `/admin/orders/[id]`  
**API**: `/api/v1/admin/orders`

| Endpoint | Method | Role | Description |
|----------|--------|------|-------------|
| `/admin/orders` | GET | SUPPORT+ | Search/filter/paginate orders |
| `/admin/orders/:id` | GET | SUPPORT+ | Order detail (items, payments, refunds, operations) |
| `/admin/orders/:id/operations` | GET | ADMIN+ | Registrar operations for this order |

---

### 2.5 Payment & Refund Management

**Route**: `/admin/payments`, `/admin/refunds`  
**API**: `/api/v1/admin/payments`, `/api/v1/admin/refunds`

| Endpoint | Method | Role | Description |
|----------|--------|------|-------------|
| `/admin/payments` | GET | FINANCE+ | Search/filter/paginate payments |
| `/admin/refunds` | GET | FINANCE+ | Search/filter/paginate refunds |
| `/admin/refunds/create` | POST | FINANCE+ | Initiate admin refund (requires reason) |

---

### 2.6 TLD & Pricing Management

**Route**: `/admin/tlds`, `/admin/pricing`  
**API**: `/api/v1/admin/tlds`, `/api/v1/admin/pricing`

| Endpoint | Method | Role | Description |
|----------|--------|------|-------------|
| `/admin/tlds` | GET | ADMIN+ | List all TLDs with status |
| `/admin/tlds/:tld` | PUT | ADMIN+ | Enable/disable TLD, update capabilities |
| `/admin/pricing` | GET | ADMIN+ | View all pricing |
| `/admin/pricing/:tld` | PUT | ADMIN+ | Set retail price, markup, promotions |
| `/admin/pricing/sync` | POST | ADMIN+ | Trigger pricing sync from Dynadot |

---

### 2.7 Registrar Operations

**Route**: `/admin/registrars`, `/admin/registrars/dynadot`  
**API**: `/api/v1/admin/registrar`

| Endpoint | Method | Role | Description |
|----------|--------|------|-------------|
| `/admin/registrar/operations` | GET | ADMIN+ | Search/filter registrar operations |
| `/admin/registrar/operations/:id` | GET | ADMIN+ | Operation detail |
| `/admin/registrar/operations/:id/retry` | POST | ADMIN+ | Retry failed operation |
| `/admin/registrar/operations/:id/resolve` | POST | ADMIN+ | Manually resolve MANUAL_REVIEW |
| `/admin/registrar/operations/unknown` | GET | ADMIN+ | List all UNKNOWN operations |
| `/admin/registrar/operations/manual-review` | GET | ADMIN+ | List all MANUAL_REVIEW operations |
| `/admin/registrar/health` | GET | ADMIN+ | Provider health status |
| `/admin/registrar/account` | GET | ADMIN+ | Dynadot account info + balance |
| `/admin/registrar/reconciliation/trigger` | POST | ADMIN+ | Manually trigger reconciliation |

---

### 2.8 Transfer Management

**Route**: `/admin/transfers`  
**API**: `/api/v1/admin/transfers`

| Endpoint | Method | Role | Description |
|----------|--------|------|-------------|
| `/admin/transfers` | GET | ADMIN+ | List transfers (in/out) |
| `/admin/transfers/:id` | GET | ADMIN+ | Transfer detail |

---

### 2.9 Webhook Management

**Route**: Part of registrar operations  
**API**: `/api/v1/admin/webhooks`

| Endpoint | Method | Role | Description |
|----------|--------|------|-------------|
| `/admin/webhooks` | GET | ADMIN+ | List webhook events |
| `/admin/webhooks/:id` | GET | ADMIN+ | Webhook event detail (metadata, no raw payload) |
| `/admin/webhooks/:id/payload` | GET | SUPER_ADMIN | View decrypted raw payload |
| `/admin/webhooks/:id/replay` | POST | SUPER_ADMIN | Replay webhook event (audit-logged) |

---

### 2.10 Audit Logs

**Route**: `/admin/audit-logs`  
**API**: `/api/v1/admin/audit-logs`

| Endpoint | Method | Role | Description |
|----------|--------|------|-------------|
| `/admin/audit-logs` | GET | ADMIN+ | Search/filter audit logs |

Filterable by: actor, action, resource_type, resource_id, date range, IP address.

---

### 2.11 Abuse Management

**Route**: `/admin/abuse`  
**API**: `/api/v1/admin/abuse`

| Endpoint | Method | Role | Description |
|----------|--------|------|-------------|
| `/admin/abuse` | GET | ABUSE+ | List abuse cases |
| `/admin/abuse/:id` | GET | ABUSE+ | Case detail + evidence |
| `/admin/abuse/:id/status` | PUT | ABUSE+ | Update case status |
| `/admin/abuse/:id/assign` | PUT | ABUSE+ | Assign to staff member |
| `/admin/abuse/:id/evidence` | POST | ABUSE+ | Add evidence |
| `/admin/abuse/:id/escalate` | POST | ADMIN+ | Escalate to registrar |
| `/admin/abuse/:id/suspend-domain` | POST | ABUSE+ | Suspend the affected domain |

---

### 2.12 Compliance

**Route**: `/admin/compliance`  
**API**: `/api/v1/admin/compliance`

| Endpoint | Method | Role | Description |
|----------|--------|------|-------------|
| `/admin/compliance/cases` | GET | ADMIN+ | List compliance cases |
| `/admin/compliance/cases/:id` | GET | ADMIN+ | Case detail |
| `/admin/compliance/legal-requests` | GET | ADMIN+ | Legal requests |
| `/admin/compliance/data-disclosures` | GET | SUPER_ADMIN | Data disclosure log |

---

### 2.13 Email Logs

**Route**: `/admin/emails`  
**API**: `/api/v1/admin/emails`

| Endpoint | Method | Role | Description |
|----------|--------|------|-------------|
| `/admin/emails` | GET | ADMIN+ | Search/filter email logs |

---

### 2.14 Settings & Security

**Route**: `/admin/settings`, `/admin/security`  
**API**: `/api/v1/admin/settings`

| Endpoint | Method | Role | Description |
|----------|--------|------|-------------|
| `/admin/settings` | GET | ADMIN+ | System settings |
| `/admin/settings/:key` | PUT | SUPER_ADMIN | Update setting |
| `/admin/settings/feature-flags` | GET | ADMIN+ | List feature flags |
| `/admin/settings/feature-flags/:key` | PUT | ADMIN+ | Toggle feature flag |

---

## 3. Admin Dashboard Design Principles

1. **Operational focus**: Show metrics that require action (UNKNOWN ops, failed payments, open abuse cases)
2. **No vanity charts**: Do not create meaningless charts just to fill space
3. **Actionable alerts**: Highlight items requiring attention (DLQ size > 0, circuit breaker open)
4. **Real-time-ish**: Dashboard data cached for 30 seconds, manual refresh available
5. **Follow the design system**: The admin panel uses the same design system as the customer dashboard, adapted for denser information display

---

## 4. Email System Architecture

### 4.1 Provider Abstraction

```typescript
// packages/email-core/src/interfaces/email-provider.interface.ts

interface EmailProvider {
  readonly providerId: string;

  send(params: SendEmailParams): Promise<EmailResult>;
}

interface SendEmailParams {
  to: string;
  subject: string;
  template: string;           // Template identifier
  templateData: Record<string, unknown>;
}
```

### 4.2 Transactional Email Templates

| Template | Trigger | Priority |
|----------|---------|----------|
| `email-verification-otp` | Registration, email change | High |
| `email-verification-link` | Alternate verification method | High |
| `welcome` | After email verification | Normal |
| `forgot-password` | Forgot password request | High |
| `password-reset-confirm` | After password reset | High |
| `security-alert` | Password change, suspicious login | High |
| `registration-successful` | Domain registered | Normal |
| `registration-failed` | Registration failed | Normal |
| `payment-receipt` | Payment succeeded | Normal |
| `invoice` | Invoice issued | Normal |
| `renewal-reminder-60d` | 60 days before expiry | Low |
| `renewal-reminder-30d` | 30 days | Normal |
| `renewal-reminder-15d` | 15 days | Normal |
| `renewal-reminder-7d` | 7 days | High |
| `renewal-reminder-3d` | 3 days | High |
| `renewal-reminder-1d` | 1 day | High |
| `renewal-successful` | Domain renewed | Normal |
| `expiration-warning` | Domain expired | High |
| `transfer-started` | Transfer initiated | Normal |
| `transfer-completed` | Transfer completed | Normal |
| `refund-issued` | Refund processed | Normal |

### 4.3 Local Development

Local email testing uses **Mailpit** (or equivalent). Docker Compose includes a Mailpit container. All emails in development are captured by Mailpit and viewable at `http://localhost:8025`.

Production email provider will be configured separately (not implemented until provider documentation is available).

### 4.4 Email Dispatch

All emails are dispatched asynchronously via BullMQ `email-dispatch` queue:

```
Trigger event
    ↓
Queue email job (template, recipient, data)
    ↓
Worker picks up job
    ↓
Render template
    ↓
EmailProvider.send(params)
    ↓
Record in email_logs (status: SENT/FAILED)
    ↓
Retry on transient failure (max 3 retries)
```
