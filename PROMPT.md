# PRISNAMES MASTER BUILD PROMPT

You are acting as the lead software architect and senior full-stack engineer for **PrisNames**, a production-grade domain registration and management platform operated by **Pristine Internet Services**.

This is not a demo, tutorial, boilerplate project, or experimental SaaS.

We are building a real commercial domain platform that customers will use to:

* search domains
* register domains
* renew domains
* transfer domains
* manage nameservers
* manage DNS
* manage registrant contacts
* manage domain privacy where supported
* manage domain lock
* retrieve transfer/auth codes where supported
* manage billing
* manage invoices
* manage account security
* receive expiration and renewal notifications

The platform will initially use:

**Dynadot / Global Domain Group LLC**

as the upstream registrar/reseller provider.

Dynadot has explicitly confirmed that we are allowed to operate our own customer-facing website/platform and use their API for domain registration and renewal.

The architecture MUST nevertheless be provider-independent so additional registrars can be added later without rewriting the main business logic.

---

# 1. FINAL TECH STACK

Use this exact stack unless I explicitly approve a change.

## Language

TypeScript everywhere.

Use strict TypeScript configuration.

Avoid `any`.

If `any` is unavoidable because of an external dependency, document why.

---

# 2. FRONTEND

Use:

* Next.js
* React
* TypeScript
* App Router
* Tailwind CSS
* shadcn/ui
* React Hook Form
* Zod
* TanStack Query

Do NOT use TanStack Start.

Do NOT create a separate frontend for the admin application.

The admin panel must exist inside the same Next.js app under:

```text
/admin
```

The customer dashboard must exist under:

```text
/dashboard
```

The public website must remain SEO-friendly.

---

# 3. BACKEND

Use:

* Node.js
* NestJS
* Fastify
* TypeScript

Critical business logic must NOT live inside Next.js server actions or route handlers.

Next.js is the frontend/application presentation layer.

NestJS is the authoritative backend.

All critical operations must go through the NestJS API.

Examples:

```text
Authentication
Users
Domain search
Domain registration
Domain renewal
Domain transfers
DNS
Nameservers
Registrant contacts
Orders
Payments
Refunds
Invoices
Admin operations
Pricing
Abuse
Compliance
Audit logging
Registrar communication
```

---

# 4. DATABASE

Use:

```text
PostgreSQL
```

PostgreSQL is the authoritative source of truth.

Do not use MongoDB.

---

# 5. ORM

Use:

```text
Drizzle ORM
```

Use proper database migrations.

Never use destructive automatic schema synchronization in production.

Database schema changes must be tracked.

---

# 6. CACHE

Use:

```text
Redis
```

Redis must NOT be treated as authoritative storage.

Use it for:

```text
Domain availability cache
TLD pricing cache
Distributed locks
Rate limiting
Temporary state
Registrar health cache
Sessions where appropriate
BullMQ
Idempotency support
```

---

# 7. QUEUE

Use:

```text
BullMQ
```

Use BullMQ for asynchronous, scheduled and retryable operations.

Examples:

```text
Domain registration
Domain renewal
Transfer processing
Registrar reconciliation
Payment reconciliation
Refund processing
Webhook processing
Transactional email
Expiration notifications
Pricing synchronization
Provider health checks
```

---

# 8. PROJECT ARCHITECTURE

Use a:

```text
MODULAR MONOLITH
```

Do NOT introduce premature microservices.

Do NOT introduce:

```text
Kubernetes
Kafka
RabbitMQ
GraphQL
Event sourcing
Complex CQRS
Service mesh
```

unless I explicitly approve it later.

The API and worker may run as separate processes, but they belong to the same modular codebase.

---

# 9. MONOREPO

Use:

```text
pnpm
Turborepo
```

Structure:

```text
prisnames/
│
├── apps/
│   │
│   ├── web/
│   │   └── Next.js
│   │
│   ├── api/
│   │   └── NestJS + Fastify
│   │
│   └── worker/
│       └── BullMQ workers
│
├── packages/
│   │
│   ├── database/
│   │
│   ├── contracts/
│   │
│   ├── ui/
│   │
│   ├── config/
│   │
│   ├── registrar-core/
│   │
│   ├── registrar-dynadot/
│   │
│   ├── payment-core/
│   │
│   ├── email-core/
│   │
│   ├── logger/
│   │
│   └── security/
│
├── docs/
│
├── infra/
│
├── docker-compose.yml
│
├── pnpm-workspace.yaml
│
├── turbo.json
│
└── README.md
```

Do not unnecessarily create packages.

Packages must have real architectural boundaries.

---

# 10. DESIGN SYSTEM

I will provide a separate Markdown file containing the official PrisNames design system.

When that file is provided:

READ IT FULLY BEFORE IMPLEMENTING UI.

Treat it as the visual source of truth.

Do NOT:

* randomly change colors
* invent a new design system
* create generic AI-generated dashboards
* add excessive gradients
* use excessive cards
* add unnecessary rounded containers
* randomly change typography
* introduce inconsistent spacing
* redesign supplied components without approval

The final UI should feel like a genuine production internet company.

Quality references may include companies such as:

```text
Cloudflare
Stripe
Namecheap
Porkbun
Spaceship
Vercel
```

but DO NOT copy them.

Follow our own design system.

Reusable primitives should live in:

```text
packages/ui
```

where appropriate.

---

# 11. DYNADOT API DOCUMENTATION

I will separately provide the Dynadot API documentation and/or Dynadot MCP.

That documentation is the authoritative source for Dynadot functionality.

Before implementing Dynadot:

READ THE PROVIDED DOCUMENTATION COMPLETELY.

Do NOT:

* invent endpoints
* guess request structures
* guess response fields
* guess webhook events
* assume unsupported functionality
* invent error codes
* fabricate rate limits

If information is unavailable, document the missing information.

Do not make something up just to continue coding.

---

# 12. DYNADOT INTEGRATION ANALYSIS

Before implementing the Dynadot adapter, create:

```text
docs/DYNADOT_INTEGRATION.md
```

Document every relevant capability found in the supplied API documentation:

```text
Authentication

Sandbox

Domain availability

Domain pricing

Premium domains

Registration

Renewal

Transfers

Domain information

Registrant contacts

WHOIS/RDAP requirements

Nameservers

DNS

Transfer lock

Authorization/EPP code

Privacy

Webhooks

Orders

Account balance

Rate limits

Errors

Retries

Idempotency

Verification requirements

KYC/contact verification

Supported TLD limitations
```

For each capability document:

```text
Supported
Partially supported
Unsupported
Unknown
```

Do not start building domain workflows until this mapping exists.

---

# 13. REGISTRAR ABSTRACTION

This is a critical architectural requirement.

The application must NOT be tightly coupled to Dynadot.

Wrong:

```ts
dynadotService.registerDomain(...)
```

inside business logic.

Correct:

```ts
registrarProvider.registerDomain(...)
```

Create a generic registrar interface.

Conceptually:

```ts
interface RegistrarProvider {
  readonly providerId: string;

  checkAvailability(
    domain: string
  ): Promise<DomainAvailability>;

  getPricing(
    input: RegistrarPricingInput
  ): Promise<RegistrarPricingResult>;

  registerDomain(
    input: RegisterDomainInput
  ): Promise<RegistrationResult>;

  renewDomain(
    input: RenewDomainInput
  ): Promise<RenewalResult>;

  transferDomain(
    input: TransferDomainInput
  ): Promise<TransferResult>;

  getDomain(
    domain: string
  ): Promise<RegistrarDomain>;

  updateNameservers(
    input: UpdateNameserversInput
  ): Promise<void>;

  updateContacts(
    input: UpdateContactsInput
  ): Promise<void>;

  setTransferLock(
    domain: string,
    enabled: boolean
  ): Promise<void>;

  getAuthCode(
    domain: string
  ): Promise<AuthCodeResult>;

  setPrivacy(
    domain: string,
    enabled: boolean
  ): Promise<void>;
}
```

Modify this interface after analyzing the actual Dynadot API.

Do not force unsupported functionality into the interface.

Create:

```text
DynadotRegistrarProvider
```

inside:

```text
packages/registrar-dynadot
```

Generic business logic must only depend on:

```text
RegistrarProvider
```

---

# 14. REGISTRAR RESOLVER

Create:

```text
RegistrarResolver
```

For V1 it should simply resolve:

```text
DYNADOT
```

Later it will support:

```text
Dynadot
Openprovider
CentralNic
Netim
NameSilo
OpenSRS
Name.com
Others
```

Do NOT implement complex multi-provider routing now.

Prepare the architecture only.

---

# 15. DOMAIN PROVIDER OWNERSHIP

Every domain stored by our platform must record its upstream provider.

Never assume all domains permanently belong to Dynadot.

Example:

```text
registrar_provider = DYNADOT

provider_domain_id

provider_order_id
```

Future providers may include:

```text
DYNADOT
OPENPROVIDER
CENTRALNIC
NETIM
NAMESILO
OPENSRS
```

Use a provider table or provider identifier architecture suitable for extension.

---

# 16. AUTHENTICATION

V1 authentication uses:

```text
Email
+
Password
```

Users must verify their email before accessing sensitive platform functionality.

OAuth is NOT required in V1.

Future providers may include:

```text
Google
GitHub
Apple
```

Design user identities so OAuth can be added later without rebuilding the account model.

---

# 17. PASSWORD SECURITY

Use:

```text
Argon2id
```

for password hashing.

Never store plaintext passwords.

Implement:

```text
Registration

Login

Logout

Forgot password

Reset password

Change password

Session management

Email verification

Rate limiting

Brute force protection
```

Password reset must use secure, random, short-lived, single-use tokens.

Forgot-password APIs must not reveal whether an email exists.

---

# 18. EMAIL VERIFICATION

Support architecture for both:

```text
6-digit OTP
```

and:

```text
Verification link
```

Make the method configurable.

Default to:

```text
6-digit email OTP
```

unless I specify otherwise.

OTP requirements:

```text
Cryptographically secure generation

Hash before persistence

Expiration

Maximum attempts

Resend cooldown

Rate limiting

Invalidate previous OTP on resend

Never permanently store plaintext OTP

Audit suspicious verification attempts
```

Expiration should be configurable.

A sensible initial default is:

```text
10 minutes
```

but do not scatter this value through the codebase.

---

# 19. SESSION SECURITY

Prefer secure server-side sessions or secure session-backed authentication.

Use cookies with appropriate:

```text
HttpOnly
Secure
SameSite
```

settings.

Never place long-lived sensitive auth credentials in localStorage.

Support:

```text
Current sessions

Device/session listing

Created at

Last active

IP where appropriate

User agent

Revoke individual session

Logout all sessions
```

Future architecture should support:

```text
2FA
Passkeys
OAuth
```

---

# 20. USER ROLES

Support:

```text
USER

SUPPORT

FINANCE

ABUSE

ADMIN

SUPER_ADMIN
```

Authorization must be enforced by the backend.

Frontend visibility is NOT authorization.

Use proper RBAC.

---

# 21. USER ROLE CAPABILITIES

## USER

Can manage their own:

```text
Profile
Domains
Orders
Invoices
Security
DNS
Nameservers
Contacts
Renewals
Transfers
```

---

## SUPPORT

Can:

```text
Search users
View users
View domains
View orders
View operational information
Assist customers
```

Should not automatically have access to unnecessary sensitive financial/security data.

---

## FINANCE

Can manage or view:

```text
Payments
Refunds
Invoices
Revenue
Registrar costs
Margins
Billing reports
```

Should not automatically access sensitive registrant PII unless necessary.

---

## ABUSE

Can manage:

```text
Abuse reports
Compliance cases
Evidence
Domain abuse status
Escalation
```

Access to sensitive customer information must be controlled and audited.

---

## ADMIN

General administration.

---

## SUPER_ADMIN

Full administrative control, including:

```text
Roles
Provider configuration
System configuration
Security-sensitive settings
```

---

# 22. ADMIN PANEL

Admin must be part of the same Next.js application.

Use:

```text
/admin
```

Do NOT create:

```text
admin.prisnames.com
```

Do NOT create another frontend.

Routes should eventually include:

```text
/admin

/admin/dashboard

/admin/users

/admin/users/[id]

/admin/domains

/admin/domains/[domain]

/admin/orders

/admin/orders/[id]

/admin/payments

/admin/refunds

/admin/invoices

/admin/tlds

/admin/pricing

/admin/registrars

/admin/registrars/dynadot

/admin/transfers

/admin/renewals

/admin/abuse

/admin/compliance

/admin/audit-logs

/admin/emails

/admin/settings

/admin/security
```

---

# 23. ADMIN DASHBOARD

The dashboard should focus on operational information.

Potential metrics:

```text
Total users

Active domains

Domains registered today

Registrations today

Renewals today

Transfers today

Domains expiring within 7 days

Domains expiring within 30 days

Domains expiring within 60 days

Revenue

Provider cost

Gross margin

Pending registrations

Failed registrations

Unknown registrations

Failed payments

Refunds

Dynadot account balance

Dynadot provider health

Open abuse cases
```

Do not create meaningless charts just to fill space.

---

# 24. ADMIN USER MANAGEMENT

Admins must eventually be able to:

```text
Search users

Filter users

View user details

View domains

View orders

View payments

View invoices

View sessions

View activity

View abuse history

View registrar operations

Disable account

Enable account

Force session logout

Trigger password reset workflow
```

Sensitive actions must be audited.

Admins must never be able to read:

```text
Passwords
Plain OTPs
Authentication secrets
Private API credentials
```

---

# 25. CUSTOMER DASHBOARD

Use:

```text
/dashboard
```

Suggested routes:

```text
/dashboard

/dashboard/domains

/dashboard/domains/[domain]

/dashboard/transfers

/dashboard/orders

/dashboard/billing

/dashboard/invoices

/dashboard/account

/dashboard/security
```

---

# 26. DOMAIN MANAGEMENT PAGE

Where supported by Dynadot, domain management should include:

```text
Overview

Domain status

Registration date

Expiration date

Auto renewal

Nameservers

DNS records

Registrant contacts

WHOIS/privacy

Transfer lock

Transfer authorization code

Renew

Transfer

Activity log
```

Do not expose buttons for functionality that the upstream provider does not support.

---

# 27. DOMAIN SEARCH

Search must be fast.

Do not unnecessarily hit Dynadot for identical repeated searches.

Use Redis.

Conceptual cache:

```text
domain:availability:example.com
```

Use short TTLs.

Search flow:

```text
User search
   ↓
Normalize domain
   ↓
Validate domain
   ↓
Check Redis cache
   ↓
If missing/stale
   ↓
RegistrarProvider
   ↓
Dynadot
   ↓
Normalize response
   ↓
Cache
   ↓
Return result
```

Search may return:

```text
domain

available

premium status

registration price

renewal price

transfer price

currency

provider
```

based on actual API capabilities.

---

# 28. DOMAIN NORMALIZATION

Create a single domain-normalization utility.

Handle:

```text
Lowercase normalization

Whitespace removal

Unicode/IDN appropriately

Punycode where required

TLD parsing

Validation
```

Do not duplicate parsing logic across modules.

---

# 29. PRICING SYSTEM

Never hardcode retail prices in frontend code.

Create centralized pricing.

Model:

```text
TLD

Provider

Provider registration cost

Provider renewal cost

Provider transfer cost

Provider restore cost

Retail registration price

Retail renewal price

Retail transfer price

Markup

Promotion

Promotion start

Promotion end

Currency

Enabled

Premium support

Last synchronized
```

Dynadot is initially the only provider.

---

# 30. PREMIUM DOMAINS

Premium domains must NOT use generic cached TLD pricing if Dynadot provides domain-specific premium pricing.

Always use the actual provider-specific price before checkout.

Before registration:

```text
Recheck availability
Recheck premium status
Recheck current price
```

---

# 31. QUOTE SYSTEM

Do not make the search result itself the final checkout price.

Create a quote concept.

Example:

```text
Search
   ↓
Price displayed
   ↓
Customer selects domain
   ↓
Create checkout quote
   ↓
Quote has expiration
   ↓
At purchase
   ↓
Final live validation
```

Quote should include:

```text
Domain

Operation

Years

Retail amount

Currency

Provider

Provider estimated cost

Premium status

Created at

Expires at
```

---

# 32. MONEY

Never use JavaScript floating-point arithmetic for money.

Use integer minor units or a safe decimal representation.

Example:

```text
amount = 1299
currency = USD
minorUnit = 2
```

means:

```text
$12.99
```

All money must include its currency.

---

# 33. ORDERS

Orders must be independent from payments.

Possible order items:

```text
Domain registration

Domain renewal

Domain transfer
```

Future order items may include:

```text
SSL

Email

Hosting

Other services
```

Suggested order structure:

```text
id

user_id

status

currency

subtotal

tax

discount

total

created_at

updated_at
```

Order items should independently describe what was purchased.

---

# 34. ORDER STATE MACHINE

Do not use only:

```text
SUCCESS
FAILED
```

Suggested domain-registration workflow states:

```text
DRAFT

QUOTED

PAYMENT_PENDING

PAYMENT_CONFIRMED

REGISTRATION_QUEUED

REGISTRATION_PROCESSING

REGISTRATION_UNKNOWN

REGISTERED

DOMAIN_UNAVAILABLE

REGISTRATION_FAILED

REFUND_PENDING

REFUNDED

MANUAL_REVIEW

CANCELLED
```

Make state transitions explicit.

Invalid transitions must be rejected.

---

# 35. DOMAIN REGISTRATION FLOW

Registration should conceptually be:

```text
Domain searched
       ↓
Availability confirmed
       ↓
Quote created
       ↓
Customer checkout
       ↓
Payment confirmed
       ↓
Registration job queued
       ↓
Acquire domain registration lock
       ↓
FINAL availability check
       ↓
FINAL price check
       ↓
Call RegistrarProvider
       ↓
Dynadot
       ↓
Normalize response
       ↓
Verify outcome
       ↓
Persist domain
       ↓
Complete order
       ↓
Send confirmation
```

Never rely on search availability from several minutes earlier.

---

# 36. UNKNOWN REGISTRATION STATE

This is extremely important.

A Dynadot API timeout does NOT necessarily mean registration failed.

Example:

```text
Request sent
   ↓
Dynadot processes registration
   ↓
Network timeout occurs
```

Never automatically retry immediately.

Mark:

```text
REGISTRATION_UNKNOWN
```

Then reconcile with Dynadot.

---

# 37. REGISTRAR RECONCILIATION

Create reconciliation jobs for uncertain operations.

Conceptual flow:

```text
REGISTRATION_UNKNOWN
        ↓
Query provider
        ↓
Check domain/account/order
        ↓
Determine actual provider state
```

If registered:

```text
REGISTERED
```

If safely confirmed not registered:

```text
Retry according to policy
```

If uncertain:

```text
MANUAL_REVIEW
```

Never risk accidental duplicate registrations or payments.

---

# 38. DISTRIBUTED DOMAIN LOCKING

Prevent concurrent registration attempts for the same domain.

Conceptual key:

```text
lock:domain-registration:example.com
```

Use safe Redis locking with:

```text
Unique lock owner

Expiry

Safe release semantics
```

Do not release someone else's lock.

---

# 39. IDEMPOTENCY

Critical operations must be idempotent.

Especially:

```text
Domain registration

Renewal

Transfers

Payment webhooks

Refunds

Registrar webhooks

Email jobs

Admin actions that can cause financial/domain changes
```

Store idempotency information where necessary.

---

# 40. PAYMENT ARCHITECTURE

Actual payment providers will be supplied later.

For now build provider abstraction.

Conceptually:

```ts
interface PaymentProvider {
  readonly providerId: string;

  createPayment(...): Promise<...>;

  getPayment(...): Promise<...>;

  verifyWebhook(...): Promise<...>;

  refund(...): Promise<...>;
}
```

Expected future integrations:

```text
PhonePe

Triple-A

CoinGate
```

Do NOT implement fake external integrations without actual API documentation.

---

# 41. PAYMENT STATES

Suggested states:

```text
CREATED

PENDING

PROCESSING

SUCCEEDED

FAILED

EXPIRED

CANCELLED

REFUND_PENDING

PARTIALLY_REFUNDED

REFUNDED
```

Payment success does not automatically mean domain registration success.

These are separate systems.

---

# 42. EMAIL SYSTEM

Create:

```text
EmailProvider
```

Do not tightly couple the application to a single email vendor.

Support transactional emails:

```text
Email verification OTP

Verification link

Welcome

Forgot password

Password reset

Security alert

Registration successful

Registration failed

Payment receipt

Invoice

Renewal reminder

Renewal successful

Expiration warning

Transfer started

Transfer completed

Refund
```

Use Mailpit or equivalent locally.

Production provider will be configured separately.

---

# 43. DATABASE DESIGN

Design database intentionally before coding major application workflows.

Expected entities include:

```text
users

user_profiles

auth_identities

password_credentials

email_verifications

password_resets

sessions

roles

user_roles

domains

domain_contacts

domain_nameservers

domain_dns_records

domain_events

tlds

registrar_providers

registrar_provider_prices

registrar_operations

quotes

orders

order_items

payments

payment_attempts

refunds

invoices

audit_logs

admin_actions

abuse_cases

abuse_evidence

compliance_cases

legal_requests

data_disclosures

legal_documents

legal_document_versions

user_legal_acceptances

email_logs

webhook_events

job_records

feature_flags

system_settings
```

Modify where architecture calls for improvement.

Do not create duplicate sources of truth.

---

# 44. DOMAIN ENTITY

Domain records should at minimum support:

```text
id

user_id

fqdn

tld

registrar_provider_id

provider_domain_id

status

registered_at

expires_at

auto_renew

transfer_lock

privacy_status

created_at

updated_at
```

Do not assume all status data originates locally.

Support syncing provider state.

---

# 45. REGISTRANT CONTACTS

Registrant information may contain:

```text
Name

Company

Address

City

State

Postal code

Country

Phone

Email
```

Treat this data as sensitive.

Requirements:

```text
Strict access control

Encryption for sensitive fields where appropriate

No sensitive PII in logs

Audit administrative access

Limit staff access by role

Data disclosure tracking
```

---

# 46. AUDIT LOGGING

Important actions must be auditable.

Examples:

```text
Account registered

Email verified

Login

Logout

Password changed

Password reset

Session revoked

Domain registered

Domain renewed

Domain transferred

Nameservers changed

DNS changed

Contacts changed

Privacy changed

Domain locked/unlocked

Auth code requested

Payment received

Refund created

Admin user opened sensitive record

Admin disabled account

Abuse action

Registrar configuration changed

Pricing changed
```

Audit records should include where appropriate:

```text
Actor

Action

Resource type

Resource ID

Request ID

Timestamp

IP

Metadata

Before

After
```

Never log secrets.

---

# 47. REQUEST/CORRELATION IDS

Every API request should have a correlation/request ID.

Propagate it through:

```text
NestJS API

Logs

BullMQ jobs

Registrar operations

Payments

Emails where useful
```

This is essential for debugging financial/domain operations.

---

# 48. STRUCTURED LOGGING

Use structured JSON logs in production.

Include useful fields:

```text
timestamp

level

service

requestId

userId

domainId

orderId

paymentId

jobId

provider

event
```

Never log:

```text
Passwords

OTP values

API secrets

Registrar credentials

Payment secrets

Full sensitive registrant data

Session secrets
```

---

# 49. ERROR MODEL

Use consistent API errors.

Example:

```json
{
  "error": {
    "code": "DOMAIN_NOT_AVAILABLE",
    "message": "This domain is no longer available.",
    "requestId": "req_..."
  }
}
```

Do not expose upstream raw provider errors directly to customers.

Internally preserve enough information for diagnosis.

---

# 50. API DESIGN

Use REST.

Use explicit versioning.

Example:

```text
/api/v1
```

Potential modules:

```text
/api/v1/auth

/api/v1/users

/api/v1/domains

/api/v1/domain-search

/api/v1/pricing

/api/v1/quotes

/api/v1/orders

/api/v1/payments

/api/v1/admin
```

Generate OpenAPI/Swagger documentation.

---

# 51. VALIDATION

Use Zod/shared schemas where practical.

Validate incoming data on the backend regardless of frontend validation.

Never trust the browser.

---

# 52. SECURITY

Implement production security from the beginning.

Include:

```text
Security headers

CORS policy

CSRF protection where applicable

Rate limiting

Brute force protection

Secure cookies

Input validation

RBAC

Secret management

Sensitive data protection

Audit logs

Password hashing

Session revocation

Admin route protection
```

No secrets in source control.

---

# 53. ENVIRONMENT VARIABLES

Create:

```text
.env.example
```

Validate environment variables at application startup.

Potential categories:

```text
NODE_ENV

DATABASE_URL

REDIS_URL

AUTH_SECRET

COOKIE settings

EMAIL settings

DYNADOT credentials

DYNADOT environment

PAYMENT configuration

SENTRY configuration

LOG configuration
```

Never commit actual `.env` files containing credentials.

---

# 54. ENVIRONMENTS

Maintain clear environments:

```text
development

test

staging

production
```

Dynadot sandbox must be used wherever supported for development/testing.

Never allow local/test code to accidentally register production domains.

Make this impossible through configuration safeguards where practical.

---

# 55. PROVIDER HEALTH

Track Dynadot health.

Potential metrics:

```text
API availability

Latency

Recent error count

Last successful request

Last failed request

Registration success rate

Pricing synchronization status
```

This will later be used for multi-provider routing.

---

# 56. FEATURE FLAGS

Implement lightweight feature control.

Possible flags:

```text
DOMAIN_REGISTRATION

DOMAIN_RENEWAL

DOMAIN_TRANSFER

WHOIS_PRIVACY

CRYPTO_PAYMENTS

PHONEPE

SPECIFIC_TLDS

PROVIDER_DYNADOT
```

This allows us to disable problematic functions without emergency code changes.

---

# 57. DYNADOT/GDG COMPLIANCE

We operate as a reseller.

Do NOT present PrisNames or Pristine Internet Services as an ICANN-accredited registrar.

We must comply with relevant reseller agreement requirements.

Important principles:

```text
GDG is the sponsoring registrar where applicable.

Required registrar/ICANN provisions must flow down into our registration terms.

Required registrant education links/notices must be present.

Customer registrant information must only be shared appropriately.

Required privacy notices and consents must be obtained.

Abuse and legal requests must be handled properly.

We must not intentionally facilitate illegal use.

We must preserve appropriate operational records.
```

Do not place misleading claims such as:

```text
100% anonymous

No logs

Impossible to trace

Authorities cannot access information
```

Marketing should instead focus on:

```text
Privacy

Ease of use

Competitive pricing

Domain management

Secure infrastructure

Modern experience
```

---

# 58. LEGAL DOCUMENT VERSIONING

Because customers must agree to domain-related terms, create proper legal-document versioning.

Tables should support concepts such as:

```text
legal_documents

legal_document_versions

user_legal_acceptances
```

Record:

```text
Document

Version

Accepted at

User

Order/domain where relevant

IP where appropriate
```

This allows us to prove which terms applied at the time of registration.

---

# 59. ABUSE SYSTEM

Create:

```text
abuse@prisnames.com
```

architecture.

Possible categories:

```text
PHISHING

MALWARE

FINANCIAL_FRAUD

IMPERSONATION

SPAM

TRADEMARK

ILLEGAL_CONTENT

OTHER
```

Possible states:

```text
OPEN

UNDER_REVIEW

AWAITING_INFORMATION

ACTION_REQUIRED

ESCALATED_TO_REGISTRAR

SUSPENDED

RESOLVED

REJECTED
```

Do not automatically suspend a customer domain solely because someone submitted a complaint.

Support:

```text
Evidence collection

Internal notes

Customer communication

Registrar escalation

Actions

Audit trail
```

---

# 60. COMPLIANCE MODULE

Create an architectural boundary:

```text
ComplianceModule
```

Potential services:

```text
PolicyVersionService

TermsAcceptanceService

AbuseCaseService

LegalRequestService

DataDisclosureService

EvidencePreservationService
```

Do not overbuild these initially, but establish correct boundaries.

---

# 61. WEBHOOKS

Any incoming webhook system must support:

```text
Signature verification

Provider identification

Event deduplication

Idempotency

Raw event preservation where safe

Fast acknowledgement

Async processing

Retries

Processing status

Error logging
```

Create a webhook event model.

Example fields:

```text
provider

provider_event_id

type

status

received_at

processed_at

attempt_count

error
```

Do not blindly execute unverified webhook payloads.

---

# 62. DOMAIN EXPIRATION

Track expiration accurately.

Architecture should support reminder schedules such as:

```text
60 days

30 days

15 days

7 days

3 days

1 day
```

These should be configurable.

Registrar/registry-specific rules may differ.

Do not assume every TLD behaves exactly the same.

---

# 63. RENEWAL

Renewal flow should be independent from registration.

Potential flow:

```text
Customer requests renewal
      ↓
Quote
      ↓
Payment
      ↓
Renewal queued
      ↓
RegistrarProvider
      ↓
Dynadot
      ↓
Verify expiration date
      ↓
Persist
      ↓
Complete order
```

Support reconciliation for unknown renewal outcomes.

---

# 64. TRANSFERS

Build transfers according to actual Dynadot API capabilities.

Do not assume all transfers behave identically.

Architecture should support:

```text
Transfer in

Transfer status

Authorization code

Transfer pricing

Transfer completion

Transfer failure

Transfer cancellation
```

Future transfer-out workflows should be handled separately.

---

# 65. SEO

The public site must be indexable and SEO-friendly.

Potential public routes:

```text
/

/domains

/pricing

/transfer

/whois

/domains/com

/domains/net

/domains/org

/domains/io

etc.
```

Implement where appropriate:

```text
Metadata

Canonical URLs

Sitemap

robots.txt

OpenGraph

Structured data

Server-rendered content
```

Do not turn the public website into a client-only SPA.

---

# 66. ACCESSIBILITY

Aim for:

```text
WCAG 2.2 AA
```

Support:

```text
Keyboard navigation

Focus states

Semantic HTML

Accessible forms

Labels

Contrast

Screen readers
```

---

# 67. PERFORMANCE

Prioritize:

```text
Fast initial page load

Fast search

Minimal unnecessary JavaScript

Good Core Web Vitals

Database indexes

Efficient caching

Pagination

No N+1 query problems
```

---

# 68. DATABASE INDEXING

Design indexes based on actual query patterns.

Likely important indexes:

```text
users.email

domains.fqdn

domains.user_id

domains.expires_at

domains.registrar_provider_id

orders.user_id

orders.status

payments.order_id

payments.status

quotes.expires_at

audit_logs.actor_id

abuse_cases.status

webhook_events.provider_event_id
```

Use unique indexes where appropriate.

---

# 69. DATA DELETION

Do not hard-delete important:

```text
Domain records

Orders

Payments

Refunds

Invoices

Audit logs

Compliance evidence
```

without a defined policy.

Use:

```text
status

archived_at

deleted_at
```

where appropriate.

Financial/legal retention needs may differ from ordinary profile data.

---

# 70. TESTING

Testing is mandatory.

## Unit tests

Focus on:

```text
Domain normalization

Pricing

Money calculations

Permissions

State machines

Provider normalization

OTP logic

Auth

Quote expiration
```

## Integration tests

Cover:

```text
PostgreSQL

Redis

Authentication

Orders

Registration workflow

Dynadot adapter

Queues

Webhooks

Reconciliation
```

## End-to-end tests

Critical flows:

```text
Register user

Verify email

Login

Search domain

Create quote

Checkout

Simulated payment success

Domain registration through sandbox/mock

Domain management

Admin login

Admin user management
```

Never register random production domains in automated tests.

---

# 71. DOCUMENTATION

Maintain:

```text
docs/PROJECT_SPEC.md

docs/ARCHITECTURE.md

docs/DATABASE.md

docs/AUTH.md

docs/DESIGN_SYSTEM_IMPLEMENTATION.md

docs/DOMAIN_LIFECYCLE.md

docs/REGISTRAR_ARCHITECTURE.md

docs/DYNADOT_INTEGRATION.md

docs/ORDER_STATE_MACHINE.md

docs/PAYMENTS.md

docs/ADMIN.md

docs/SECURITY.md

docs/COMPLIANCE.md

docs/DEPLOYMENT.md
```

Documentation must reflect the implementation.

Do not allow documentation to become obsolete.

---

# 72. DEVELOPMENT PRINCIPLES

Follow these rules throughout the project.

### Rule 1

Read existing project documentation before changing architecture.

### Rule 2

Do not modify the agreed technology stack without approval.

### Rule 3

Do not add unnecessary libraries.

### Rule 4

Do not invent external API behavior.

### Rule 5

Do not hide incomplete critical workflows behind TODO comments.

### Rule 6

Do not tightly couple business logic to Dynadot.

### Rule 7

Do not tightly couple payment logic to one gateway.

### Rule 8

Do not tightly couple email logic to one vendor.

### Rule 9

Keep modules focused.

### Rule 10

Do not create giant service files.

### Rule 11

Prefer explicit code over clever abstractions.

### Rule 12

Never sacrifice correctness in:

```text
Authentication

Domains

Payments

Pricing

Refunds

Registrant information
```

### Rule 13

Update tests whenever behavior changes.

### Rule 14

Update documentation whenever architecture changes.

### Rule 15

Follow the supplied design system exactly.

---

# 73. DO NOT OVERENGINEER

Do NOT implement unnecessary architecture just because this is a serious application.

Avoid:

```text
Premature microservices

Excessive repositories

Abstract factories everywhere

Unnecessary dependency injection wrappers

Event buses for ordinary function calls

Complex internal SDKs

Multiple databases

Multiple caches

Premature sharding

Premature Kubernetes
```

A clean modular monolith is preferred.

---

# 74. DEVELOPMENT PHASES

Development must proceed in controlled phases.

Do NOT attempt to build the whole platform in one pass.

---

# PHASE 0: REQUIREMENTS AND ARCHITECTURE

Before significant code, inspect:

```text
Current repository

My Dynadot API documentation

My design-system Markdown

Any existing project documentation
```

Create/update:

```text
PROJECT_SPEC.md

ARCHITECTURE.md

DATABASE.md

AUTH.md

DOMAIN_LIFECYCLE.md

REGISTRAR_ARCHITECTURE.md

DYNADOT_INTEGRATION.md

ORDER_STATE_MACHINE.md

SECURITY.md

COMPLIANCE.md

ADMIN.md
```

Define:

```text
Scope

Modules

Database entities

Relationships

Authentication flow

Authorization

Registration state machine

Renewal flow

Transfer flow

Registrar abstraction

Queue architecture

Caching

Idempotency

Error model

Audit logging

Compliance requirements
```

Do not start major application development before these foundations are clear.

---

# PHASE 1: REPOSITORY FOUNDATION

Create:

```text
pnpm workspace

Turborepo

Next.js application

NestJS application with Fastify

BullMQ worker application

PostgreSQL

Redis

Docker Compose

Shared packages

TypeScript configs

Linting

Formatting

Environment validation

Development scripts
```

Everything must run locally.

---

# PHASE 2: DATABASE

Implement:

```text
Drizzle

Schema

Migrations

Indexes

Seed utilities

Database integration tests
```

Do not create every future table if it adds unnecessary complexity, but establish core architecture.

---

# PHASE 3: AUTHENTICATION

Implement:

```text
Email/password registration

Email OTP verification

Login

Logout

Sessions

Session revocation

Forgot password

Reset password

Change password

RBAC

Customer route protection

/admin protection
```

OAuth is NOT part of this phase.

---

# PHASE 4: DESIGN SYSTEM IMPLEMENTATION

Read the supplied design-system Markdown again.

Create shared primitives and implement:

```text
Public shell

Header

Footer

Auth screens

Dashboard shell

Admin shell

Base forms

Buttons

Tables

Modals

Navigation

Feedback states

Loading states

Empty states

Error states
```

Do not redesign the supplied system.

---

# PHASE 5: DYNADOT PROVIDER

Read Dynadot documentation again.

Finish:

```text
DYNADOT_INTEGRATION.md
```

Implement:

```text
RegistrarProvider

RegistrarResolver

DynadotRegistrarProvider
```

Implement only verified API functionality.

Add:

```text
Unit tests

Integration tests

Sandbox tests where possible
```

---

# PHASE 6: TLD AND PRICING SYSTEM

Implement:

```text
TLD catalogue

Dynadot provider pricing synchronization

Retail pricing

Markup

Promotions

Enable/disable

Premium handling

Admin pricing interface
```

---

# PHASE 7: DOMAIN SEARCH

Implement:

```text
Domain input

Normalization

Availability

Redis caching

Pricing

Suggested extensions

Premium status

Search UI

Search API
```

Keep search fast.

---

# PHASE 8: QUOTES AND ORDERS

Implement:

```text
Checkout quotes

Quote expiration

Orders

Order items

Money handling

Order state machines

Audit trails
```

No fake production payment logic.

---

# PHASE 9: REGISTRATION ENGINE

Implement:

```text
BullMQ registration jobs

Locks

Idempotency

Final availability check

Final pricing check

Dynadot registration

Unknown-state handling

Reconciliation

Domain persistence

Notifications
```

Use sandbox first.

---

# PHASE 10: CUSTOMER DOMAIN MANAGEMENT

Implement supported:

```text
Domain list

Domain details

Nameservers

DNS

Contacts

Privacy

Transfer lock

Auth code

Renewal

Transfers

Domain activity
```

---

# PHASE 11: ADMIN PANEL

Complete:

```text
Admin dashboard

Users

Domains

Orders

TLDs

Pricing

Registrar operations

Registrar health

Audit logs

Abuse

Compliance

Settings

Security
```

---

# PHASE 12: PAYMENT PROVIDERS

Only begin when I provide actual payment-provider documentation.

Expected later:

```text
PhonePe

Triple-A

CoinGate
```

Implement behind:

```text
PaymentProvider
```

Never guess an API.

---

# PHASE 13: HARDENING

Before production:

```text
Security review

Auth review

RBAC review

Database constraints review

Race-condition review

Queue-failure testing

Registrar timeout testing

Reconciliation testing

Rate limiting

Load testing

Logging review

Sensitive data review

Backup strategy

Monitoring

Alerting

CI/CD

Production environment review
```

---

# 75. IMPORTANT UI RULE

This platform must NOT look like a generic AI-generated dashboard.

Avoid the common pattern of:

```text
Everything inside cards

Huge border radii

Random gradients

Excessive shadows

Unnecessary statistics

Generic hero sections

Fake charts

Oversized empty spacing
```

Use the design system I provide.

The interface should feel:

```text
Clean

Fast

Trustworthy

Premium

Technical where necessary

Friendly to non-technical customers

Consistent
```

---

# 76. CLAUDE CODE WORKFLOW

For every phase:

1. Read the relevant documentation.
2. Inspect existing code.
3. Explain what will be changed.
4. Implement only that phase.
5. Run lint/typecheck/tests.
6. Fix failures.
7. Review for architecture violations.
8. Update documentation.
9. Summarize what was completed.
10. Stop and wait before beginning the next major phase.

Do not silently jump across phases.

---

# 77. WHEN SOMETHING IS UNCLEAR

Do not guess external business/API facts.

If the Dynadot API documentation does not answer something:

```text
Document the unknown.

Design a safe abstraction.

Do not fabricate implementation.
```

For ordinary internal engineering decisions, make a sensible production-grade decision rather than repeatedly asking minor questions.

---

# 78. INITIAL TASK

Start by reviewing all files I provide, especially:

```text
Dynadot API documentation / MCP

PrisNames design-system Markdown
```

Then inspect the current repository.

Start with:

```text
PHASE 0
```

Do NOT immediately start coding pages or API integrations.

Your first task is to produce the architectural foundation.

At the end of Phase 0 provide:

```text
1. Files created/updated

2. Final project architecture

3. Module map

4. Database entity map

5. Authentication architecture

6. Registrar architecture

7. Dynadot capability map

8. Domain registration state machine

9. Renewal architecture

10. Transfer architecture

11. Order/payment separation

12. Admin architecture

13. Compliance architecture

14. Main risks

15. Any API/documentation gaps

16. Exact Phase 1 implementation plan
```

Then STOP.

Do not begin Phase 1 until I instruct you to proceed.

---

# FINAL ARCHITECTURE

The platform should conceptually become:

```text
                    PrisNames.com
                         │
                         ▼
                    Next.js Web
                         │
                         ▼
                 NestJS + Fastify
                         │
            ┌────────────┼─────────────┐
            │            │             │
            ▼            ▼             ▼
       PostgreSQL      Redis         BullMQ
                                        │
                                        ▼
                                   Worker Layer
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

Later:

```text
RegistrarResolver
       │
       ├── Dynadot
       ├── Openprovider
       ├── CentralNic
       ├── Netim
       ├── NameSilo
       └── OpenSRS
```

Customers must interact only with our platform.

The implementation details of the upstream registrar should remain internal except where legal, ICANN, registry or contractual disclosure is required.

Build the system so Dynadot is Provider #1, not a permanent hardcoded dependency.

The end goal is a stable, secure and extensible domain commerce platform that can eventually operate across multiple registrars without requiring a rewrite.
