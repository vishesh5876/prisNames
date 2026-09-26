# PrisNames — Project Specification

> **Project**: PrisNames  
> **Operator**: Pristine Internet Services  
> **Type**: Production domain registration and management platform  
> **Status**: Phase 0 — Architectural Foundation

---

## 1. Platform Purpose

PrisNames is a commercial domain registration and management platform. Customers use it to search, register, renew, transfer, and manage domain names. The platform is operated by Pristine Internet Services as a domain reseller.

PrisNames is **not** an ICANN-accredited registrar. It operates as an authorized reseller under **Dynadot / Global Domain Group LLC (GDG)**, the upstream registrar/reseller provider. Dynadot has explicitly confirmed that PrisNames is permitted to operate a customer-facing platform using their API.

The architecture is provider-independent: Dynadot is Provider #1, but the system is designed so additional registrars (Openprovider, CentralNic, Netim, NameSilo, OpenSRS, Name.com) can be added without rewriting business logic.

---

## 2. Customer Capabilities

Customers can:

- Search domain availability (single, bulk, suggestions)
- Register domains
- Renew domains
- Transfer domains in
- Manage nameservers
- Manage DNS records
- Manage registrant contacts
- Manage domain privacy (where supported by provider/TLD)
- Manage domain transfer lock
- Retrieve transfer/authorization codes
- Manage billing and invoices
- Manage account security (password, sessions)
- Receive expiration and renewal notifications

---

## 3. Technology Stack

| Layer | Technology |
|-------|-----------|
| **Language** | TypeScript (strict mode, no `any` without documented justification) |
| **Frontend** | Next.js, React, App Router, Tailwind CSS, shadcn/ui, React Hook Form, Zod, TanStack Query |
| **Backend** | Node.js, NestJS, Fastify |
| **Database** | PostgreSQL |
| **ORM** | Drizzle ORM (with tracked migrations) |
| **Cache** | Redis |
| **Queue** | BullMQ |
| **Architecture** | Modular Monolith |
| **Monorepo** | pnpm + Turborepo |

### Explicitly Excluded

Kubernetes, Kafka, RabbitMQ, GraphQL, Event Sourcing, Complex CQRS, Service Mesh, MongoDB, TanStack Start.

---

## 4. Monorepo Structure

```
prisnames/
│
├── apps/
│   ├── web/                    # Next.js frontend
│   ├── api/                    # NestJS + Fastify backend
│   └── worker/                 # BullMQ workers
│
├── packages/
│   ├── database/               # Drizzle schema, migrations, connection
│   ├── contracts/              # Shared TypeScript types, DTOs, Zod schemas
│   ├── ui/                     # Shared React primitives
│   ├── config/                 # Shared configuration (env validation, constants)
│   ├── registrar-core/         # RegistrarProvider interface, normalized models
│   ├── registrar-dynadot/      # Dynadot adapter implementation
│   ├── payment-core/           # PaymentProvider interface, normalized models
│   ├── email-core/             # EmailProvider interface, templates
│   ├── logger/                 # Structured logging
│   └── security/               # Hashing, encryption, token utilities
│
├── docs/                       # Architecture documentation
├── infra/                      # Infrastructure configs
├── docker-compose.yml
├── pnpm-workspace.yaml
├── turbo.json
└── README.md
```

**Package Boundary Rule**: Packages must have real architectural boundaries. Do not create packages for convenience grouping. Business logic never directly imports provider-specific packages; it depends on `-core` interfaces.

---

## 5. Application Processes

| Process | Package | Runtime | Purpose |
|---------|---------|---------|---------|
| **Web** | `apps/web` | Next.js | Customer-facing UI, admin panel UI, SEO pages |
| **API** | `apps/api` | NestJS + Fastify | All business logic, REST API, webhook endpoints |
| **Worker** | `apps/worker` | BullMQ | Async jobs: registration, renewal, transfer, reconciliation, email, pricing sync |

**Critical Rule**: All critical business logic lives in the NestJS API. Next.js handles presentation only. Next.js server actions and route handlers must NOT contain domain registration, payment, or registrar logic.

---

## 6. Module Map

| Module | Responsibility | API Prefix |
|--------|---------------|-----------|
| **Auth** | Registration, login, logout, sessions, password management, email verification | `/api/v1/auth` |
| **Users** | User profiles, role management | `/api/v1/users` |
| **Domains** | Domain CRUD, nameservers, DNS, contacts, privacy, lock, auth codes | `/api/v1/domains` |
| **Search** | Domain availability, suggestions, caching | `/api/v1/domain-search` |
| **Pricing** | TLD catalog, provider pricing, retail pricing, promotions | `/api/v1/pricing` |
| **Quotes** | Checkout quotes with price snapshots and expiration | `/api/v1/quotes` |
| **Orders** | Order lifecycle, order items | `/api/v1/orders` |
| **Payments** | Payment lifecycle, gateway integration, refunds | `/api/v1/payments` |
| **Registrar** | Provider abstraction, operations, webhooks | Internal (not directly exposed) |
| **Email** | Transactional email dispatch | Internal |
| **Compliance** | Legal documents, abuse, data disclosure | `/api/v1/admin/compliance` |
| **Audit** | Audit logging | Internal + `/api/v1/admin/audit-logs` |
| **Admin** | Admin-specific endpoints | `/api/v1/admin` |

---

## 7. Frontend Route Map

### Public (SEO-friendly, server-rendered)

```
/                           # Landing page
/domains                    # Domain search
/pricing                    # TLD pricing
/transfer                   # Transfer landing
/whois                      # WHOIS lookup (if supported)
/domains/com                # TLD-specific pages
/domains/net
/domains/org
/domains/io
/login
/register
/forgot-password
/reset-password
```

### Customer Dashboard

```
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

### Admin Panel (same Next.js app)

```
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

## 8. Environment Strategy

| Environment | Database | Redis | Dynadot | Payment | Purpose |
|-------------|----------|-------|---------|---------|---------|
| **development** | Local Docker PostgreSQL | Local Docker Redis | Sandbox | Mock | Local development |
| **test** | Test PostgreSQL | Test Redis | Sandbox | Mock | Automated testing |
| **staging** | Staging PostgreSQL | Staging Redis | Sandbox | Sandbox | Pre-production validation |
| **production** | Production PostgreSQL | Production Redis | Production | Production | Live customer traffic |

**Sandbox Safety**: `NODE_ENV=production` is the ONLY environment permitted to use Dynadot production API. All other environments are forced to sandbox. This is enforced via startup assertions (see SECURITY.md).

---

## 9. Design System

The visual design system is provided in `DESIGN-mongodb.md`. This file is used as a **visual reference only** — its visual language, component principles, spacing, typography guidance, and interaction patterns are adopted. MongoDB is not the database.

The design system is the source of truth for UI. Do not invent colors, typography, spacing, or component patterns. Reusable primitives live in `packages/ui`.

**Quality References** (for feel, not copying): Cloudflare, Stripe, Namecheap, Porkbun, Spaceship, Vercel.

---

## 10. Development Phase Roadmap

| Phase | Name | Scope |
|-------|------|-------|
| **0** | Requirements & Architecture | Documentation suite (this phase) |
| **1** | Repository Foundation | pnpm, Turborepo, app scaffolding, Docker Compose, TypeScript, linting, formatting, health endpoints |
| **2** | Database | Drizzle schema, migrations, indexes, seed utilities, integration tests |
| **3** | Authentication | Email/password, OTP verification, sessions, RBAC, route protection |
| **4** | Design System Implementation | Shared UI primitives, shells, forms, tables, modals, states |
| **5** | Dynadot Provider | RegistrarProvider, RegistrarResolver, DynadotRegistrarProvider, sandbox tests |
| **6** | TLD & Pricing System | TLD catalog, pricing sync, markup, promotions, premium handling |
| **7** | Domain Search | Search UI/API, normalization, caching, suggestions |
| **8** | Quotes & Orders | Checkout quotes, orders, order items, money handling, state machines |
| **9** | Registration Engine | BullMQ jobs, locks, idempotency, Dynadot registration, reconciliation |
| **10** | Customer Domain Management | Domain list, details, nameservers, DNS, contacts, privacy, lock, renewal, transfer |
| **11** | Admin Panel | Dashboard, users, domains, orders, TLDs, pricing, registrar ops, audit, abuse |
| **12** | Payment Providers | Actual payment integration (PhonePe, Triple-A, CoinGate) — only when documentation provided |
| **13** | Hardening | Security review, load testing, monitoring, alerting, CI/CD, production readiness |

**Phase boundaries are strict.** Each phase is completed and reviewed before the next begins.

---

## 11. Upstream Provider: Dynadot / GDG

| Attribute | Value |
|-----------|-------|
| **Company** | Global Domain Group LLC (Dynadot) |
| **Relationship** | Authorized reseller |
| **API** | REST API v2 (Beta) |
| **Authentication** | Bearer API key + HMAC-SHA256 X-Signature for sensitive ops |
| **Sandbox** | `https://api-sandbox.dynadot.com` |
| **Production** | `https://api.dynadot.com` |
| **Webhooks** | 11 event types, HMAC-SHA256 verified |
| **Rate Limits** | Tiered (Regular: 1 thread/60 req/min, Bulk: 5/600, Super Bulk: 35/6000) |
| **Capabilities** | 82 endpoints audited — see docs/DYNADOT_INTEGRATION.md |

---

## 12. Key Architectural Decisions

1. **Modular monolith** — no premature microservices
2. **Provider abstraction** — `RegistrarProvider` interface, not Dynadot direct calls
3. **Independent state machines** — Order, Payment, Refund, RegistrarOperation, Domain, Transfer each own their own status
4. **Domain lifecycle separated from operational flags** — `lifecycle_status` is independent of suspension, lock, privacy, auto-renew
5. **Payment immutability** — once SUCCEEDED, never reverted
6. **Customer-facing status derived at read time** — never stored as a combined column
7. **Module ownership enforcement** — event handlers invoke owning services, never direct DB writes
8. **Webhook raw payload security** — encrypted, access-controlled, 90-day retention
9. **Strict DTO boundary** — `registrar-dynadot` DTOs never leak into business logic
10. **Sandbox safety** — URL derived from environment, startup assertion, CI never has production keys
