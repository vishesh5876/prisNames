# PrisNames — Domain Lifecycle Architecture

> **State Machine**: `domains.lifecycle_status` — 8 states  
> **Operational Flags**: `is_suspended`, `is_transfer_locked`, `privacy_level`, `auto_renew_enabled`, `registrar_hold`  
> **State Ownership**: DomainService owns all domain table writes

---

## 1. Domain Normalization

A single `DomainNormalizationService` handles all domain input processing. This service is used before any search, registration, or management operation.

```typescript
// packages/contracts/src/domain/domain-normalization.ts

interface NormalizedDomain {
  fqdn: string;           // full: "example.com"
  sld: string;            // second-level: "example"
  tld: string;            // top-level: "com"
  isIdn: boolean;         // internationalized domain name
  punycode: string | null; // punycode representation if IDN
}

function normalizeDomain(input: string): NormalizedDomain;
```

**Normalization Steps:**

1. Trim whitespace
2. Lowercase
3. Remove trailing dots
4. Detect and handle IDN/Unicode → Punycode conversion
5. Parse TLD (handle multi-level TLDs: `.co.uk`, `.com.au`)
6. Validate against allowed characters and length rules
7. Return structured result

**Rule**: Domain normalization logic lives in `packages/contracts` so both frontend (for display) and backend (for operations) use the same implementation. No duplicate parsing logic across modules.

---

## 2. Domain Search

### 2.1 Search Flow

```
User input
    ↓
Normalize domain (DomainNormalizationService)
    ↓
Validate (length, characters, TLD exists)
    ↓
Check Redis cache (key: domain:availability:{fqdn}, TTL: 60s)
    ↓
If cache hit → Return cached result
    ↓
If cache miss → RegistrarProvider.checkAvailability(fqdn)
    ↓
Dynadot API: domain_search
    ↓
Map response to normalized DomainAvailability
    ↓
Cache result in Redis
    ↓
Return to user
```

### 2.2 Search Response

```typescript
interface DomainAvailability {
  fqdn: string;
  available: boolean;
  isPremium: boolean;
  pricing: {
    registration: MoneyAmount | null;
    renewal: MoneyAmount | null;
    transfer: MoneyAmount | null;
    currency: string;
  } | null;
  provider: string;
  cachedAt: Date;
}
```

### 2.3 Bulk & Suggestion Search

- **Bulk**: `RegistrarProvider.bulkCheckAvailability(domains[])` — checks multiple domains in one API call
- **Suggestions**: `RegistrarProvider.suggestDomains(keyword, tlds[])` — powered by Dynadot's power/suggestion search
- Both use the same caching and normalization pipeline

---

## 3. Domain Registration Flow

```
1.  Customer selects domain from search results
                ↓
2.  Create checkout quote (QuoteService)
        - Recheck availability via RegistrarProvider
        - Recheck current price (especially for premium domains)
        - Snapshot price → quotes table
        - Quote expires in 15 minutes (configurable)
                ↓
3.  Customer adds to order (OrderService)
        - Order.status = DRAFT
        - Create order_item referencing quote
                ↓
4.  Customer initiates payment (OrderService)
        - Order.status = PENDING_PAYMENT
        - PaymentService.create(orderId)
        - Payment.status = CREATED
                ↓
5.  Payment gateway processes
        - Payment.status = PROCESSING → SUCCEEDED
                ↓
6.  PaymentEventHandler (invoked by gateway webhook)
        - Reads PaymentSucceededEvent
        - Invokes OrderService.markProcessing(orderId)
            → Order.status = PROCESSING
        - Invokes RegistrarOperationService.enqueue(orderId, domainId, 'REGISTER')
            → RegistrarOperation.status = QUEUED
        - Invokes DomainService.markPendingRegistration(domainId)
            → Domain.lifecycle_status = PENDING_REGISTRATION
                ↓
7.  Worker picks up BullMQ job
        - Acquire distributed lock: lock:domain-registration:{fqdn}
        - FINAL availability check via RegistrarProvider
        - FINAL price check (compare with quote)
        - If unavailable or price changed significantly → abort, refund flow
                ↓
8.  RegistrarProvider.registerDomain(params)
        - Dynadot API call with X-Request-ID and X-Signature
        - RegistrarOperation.status = PROCESSING
                ↓
9.  Handle response:

    HTTP 200 (success):
        → RegistrarOperationService.succeed(opId, responseData)
        → Emits RegistrarOpSucceededEvent
        → DomainService.activate(domainId, { expiresAt, providerDomainId })
            → lifecycle_status = ACTIVE
        → OrderService.completeIfAllOpsSucceeded(orderId)
            → Order.status = COMPLETED
        → Queue confirmation email
        → Audit log: 'domain.registered'

    HTTP 409 (domain unavailable):
        → RegistrarOperationService.markFailed(opId)
        → DomainService.markRegistrationFailed(domainId)
        → OrderService.markFailed(orderId) → REFUND_REQUIRED
        → RefundService.create(orderId, paymentId)
        → Queue failure notification email

    HTTP 5xx / timeout:
        → RegistrarOperationService.markUnknown(opId)
        → Domain.lifecycle_status remains PENDING_REGISTRATION
        → Order.status remains PROCESSING
        → Payment.status remains SUCCEEDED (IMMUTABLE)
        → Reconciliation will resolve

    HTTP 402 (insufficient provider balance):
        → RegistrarOperationService.markFailed(opId)
        → Alert admin immediately
        → Queue customer notification
        → Initiate refund flow

10. Release distributed lock
```

---

## 4. Unknown Registration State

This is the most important failure mode. A Dynadot API timeout does NOT mean registration failed — the domain may have been registered.

```
RegistrarOperation.status = UNKNOWN
    ↓
Reconciliation job (every 15 min) picks up stale UNKNOWN operations
    ↓
Query RegistrarProvider.getDomainInfo(fqdn)
    ↓
Three outcomes:

1. Domain exists at provider:
    → RegistrarOperationService.succeed(opId)
    → DomainService.activate(domainId)
    → OrderService.completeIfAllOpsSucceeded(orderId)

2. Domain does not exist, retries remaining:
    → RegistrarOperationService.markRetryPending(opId)
    → Re-enqueue registration job

3. Domain does not exist, max retries exhausted:
    → RegistrarOperationService.markFailed(opId)
    → DomainService.markRegistrationFailed(domainId)
    → OrderService.markFailed(orderId) → REFUND_REQUIRED
    → RefundService.create(orderId, paymentId)

4. Still uncertain (provider also returns error):
    → RegistrarOperationService.markManualReview(opId)
    → Alert admin
    → Admin manually resolves via admin panel
```

**Rules:**
- Never automatically retry registration immediately after timeout (risk of duplicate)
- Use distributed lock to prevent concurrent registration attempts
- Reconciliation always queries provider before assuming failure

---

## 5. Domain Renewal Flow

```
1. Customer requests renewal
    - OR auto-renewal triggered by expiration job
        ↓
2. QuoteService.createRenewalQuote(domainId, years)
    - Fetch current renewal price from pricing table
    - For premium: recheck with RegistrarProvider
    - Snapshot → quotes table
        ↓
3. Same Order → Payment flow as registration
        ↓
4. Worker executes renewal job
    - RegistrarProvider.renewDomain(params)
        ↓
5. Handle response:

    Success (200):
        → RegistrarOperationService.succeed(opId)
        → DomainService.updateExpiration(domainId, newExpiresAt)
          (lifecycle_status stays ACTIVE — renewal doesn't change lifecycle)
        → OrderService.completeIfAllOpsSucceeded(orderId)
        → Queue renewal confirmation email
        → Audit log: 'domain.renewed'

    Timeout/Unknown:
        → Same UNKNOWN handling as registration
        → Reconciliation verifies new expiration date

    Failed:
        → Refund flow
```

---

## 6. Domain Transfer-In Flow

```
1. Customer initiates transfer
    - Provides auth/EPP code
    - Auth code is hashed before storage (transfers.auth_code_hash)
        ↓
2. Same Order → Payment flow
        ↓
3. Worker executes transfer job
    - TransferService.initiate(transferId)
    - Transfer.status = INITIATED
    - RegistrarProvider.transferIn(params)
        ↓
4. Handle response:

    HTTP 202 (accepted — async):
        → RegistrarOperationService.markAccepted(opId)
        → Transfer.status = PENDING_APPROVAL
        → Domain lifecycle_status unchanged (or PENDING_REGISTRATION if new domain)
        → Await webhook or reconciliation

    ORDER_COMPLETED webhook (for this transfer):
        → Correlate by provider_order_id
        → Verify via RegistrarProvider.getTransferStatus()
        → TransferService.complete(transferId) → Transfer.status = COMPLETED
        → RegistrarOperationService.succeed(opId)
        → DomainService.activateAfterTransfer(domainId, { expiresAt })
            → lifecycle_status = ACTIVE
        → OrderService.completeIfAllOpsSucceeded(orderId)
        → Audit log: 'domain.transferred_in'

    Transfer rejected/failed:
        → TransferService.fail(transferId, reason)
        → RegistrarOperationService.markFailed(opId)
        → Refund flow
```

---

## 7. Domain Transfer-Out Flow

```
1. Customer requests auth/EPP code
    - DomainService validates transfer lock is disabled
    - RegistrarProvider.getTransferAuthCode(domain)
    - Return code to customer (one-time display, not stored plaintext)
    - Audit log: 'domain.auth_code_requested'
        ↓
2. Customer submits auth code to gaining registrar (external)
        ↓
3. Dynadot receives transfer-away request
    - DOMAIN_TRANSFER_AWAY webhook may arrive
    - authorize_transfer_away API if manual approval required
        ↓
4. On transfer completion:
    - DOMAIN_TRANSFER_AWAY webhook handler:
        → DomainService.markTransferredAway(domainId)
            → lifecycle_status = DELETED
        → Record gaining_registrar in domain_events
        → Audit log: 'domain.transferred_away'
```

---

## 8. Domain Expiration & Auto-Renewal

### 8.1 Expiration Tracking

Scheduled job scans `domains.expires_at` daily and triggers reminders:

| Days Before Expiry | Action |
|--------------------|--------|
| 60 | Queue reminder email (informational) |
| 30 | Queue reminder email (advisory) |
| 15 | Queue reminder email (warning) |
| 7 | Queue reminder email (urgent) |
| 3 | Queue reminder email (critical) |
| 1 | Queue reminder email (final) |

Reminder schedule is configurable via `system_settings`.

### 8.2 DOMAIN_EXPIRING Webhook Handling

When Dynadot sends `DOMAIN_EXPIRING`:

1. Update `domains.provider_expiration_info` with the notification data
2. Trigger renewal reminders for affected domains
3. Optionally schedule a reconciliation call to `domain_info` to confirm actual status
4. **Do NOT set `lifecycle_status = EXPIRED` from this webhook alone**

`lifecycle_status` transitions to `EXPIRED` only when:
- `DOMAIN_STATUS_CHANGED` webhook confirms expiration, OR
- Reconciliation via `domain_info` confirms the domain has expired

### 8.3 Auto-Renewal

```
Daily expiration scan job
    ↓
For domains with auto_renew_enabled = true AND expires_at within threshold (e.g., 14 days):
    ↓
Check feature flag: DOMAIN_RENEWAL
    ↓
Create renewal order automatically
    ↓
Process payment (stored payment method — future feature)
    ↓
Same renewal flow as manual renewal
```

---

## 9. Grace Delete

Dynadot supports grace deletion within the add grace period (typically 5 days). There is a quota: `grace_delete_count` / `grace_delete_allowed`.

```
Customer requests grace delete (within grace period)
    ↓
Check grace delete quota via RegistrarProvider
    ↓
If quota available:
    → RegistrarProvider.graceDelete(domain)
    → DomainService.markDeleted(domainId)
        → lifecycle_status = DELETED
    → Initiate refund for registration cost (minus ICANN fee if applicable)
    → Audit log: 'domain.grace_deleted'

If quota exceeded:
    → Dynadot returns wait list response
    → Inform customer
    → Queue for later attempt if Dynadot supports
```

---

## 10. Domain Restore

For domains in REDEMPTION period:

```
Customer requests restore
    ↓
RegistrarProvider.restoreDomain(domain)
    ↓
Restore cost is significantly higher than registration
    ↓
Same Order → Payment → Worker flow
    ↓
On success:
    → DomainService.activate(domainId, { expiresAt })
        → lifecycle_status: REDEMPTION → ACTIVE
    → Audit log: 'domain.restored'
```

---

## 11. Distributed Domain Locking

Prevent concurrent operations on the same domain via Redis distributed locks.

```
Key:      lock:domain-registration:{fqdn}
          lock:domain-operation:{domainId}:{opType}
Owner:    {workerId}:{jobId}   (unique per worker+job)
TTL:      5 minutes (configurable)
Release:  Only by lock owner (Lua script for atomic compare-and-delete)
```

**Rules:**
1. Lock MUST be acquired before any registrar API call
2. Lock owner is verified before release (never release someone else's lock)
3. TTL prevents deadlocks on worker crashes
4. If lock cannot be acquired, job is retried with backoff

---

## 12. Domain Management Operations

Operations available via `/api/v1/domains/:domain` and `/dashboard/domains/:domain`:

| Operation | API Endpoint | Registrar Method | Notes |
|-----------|-------------|-----------------|-------|
| View details | GET `/domains/:domain` | `getDomainInfo()` | Cached, reconciled |
| Update nameservers | PUT `/domains/:domain/nameservers` | `updateNameservers()` | |
| Manage DNS | GET/POST/PUT/DELETE `/domains/:domain/dns` | `setDnsRecords()` | |
| Set contacts | PUT `/domains/:domain/contacts` | `setContacts()` | May return 202 (IRTP) |
| Set privacy | PUT `/domains/:domain/privacy` | `setPrivacy()` | TLD-dependent |
| Set transfer lock | PUT `/domains/:domain/lock` | `setTransferLock()` | |
| Get auth code | POST `/domains/:domain/auth-code` | `getTransferAuthCode()` | One-time display |
| Set auto-renew | PUT `/domains/:domain/auto-renew` | `setRenewOption()` | |
| Renew | POST `/domains/:domain/renew` | Through order flow | |
| Transfer out | POST `/domains/:domain/transfer-out` | Auth code + unlock | |
| Grace delete | POST `/domains/:domain/grace-delete` | `graceDelete()` | Within grace period |
