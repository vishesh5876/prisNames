# PrisNames — Registrar Architecture

> **Interface**: `RegistrarProvider` in `packages/registrar-core`  
> **Implementation**: `DynadotRegistrarProvider` in `packages/registrar-dynadot`  
> **Resolver**: `RegistrarResolver` — V1 resolves to DYNADOT only

---

## 1. Provider Abstraction

### 1.1 Architecture

```
Business Logic (NestJS Services)
        │
        │ depends on interface
        ▼
RegistrarProvider (packages/registrar-core)
        │
        │ resolved by
        ▼
RegistrarResolver
        │
        │ returns implementation
        ▼
DynadotRegistrarProvider (packages/registrar-dynadot)
        │
        ▼
Dynadot REST API v2
```

**Rule**: Business logic modules (OrderService, DomainService, etc.) NEVER import from `packages/registrar-dynadot`. They depend only on `packages/registrar-core` interfaces. The Dynadot implementation is registered via NestJS dependency injection.

### 1.2 Package Boundary

| Package | Contains | Exported To |
|---------|----------|-------------|
| `packages/registrar-core` | `RegistrarProvider` interface, `RegistrarResolver`, normalized models, error types | `apps/api`, `apps/worker` |
| `packages/registrar-dynadot` | `DynadotRegistrarProvider`, Dynadot DTOs, mappers, HTTP client, rate limiter, signature service, webhook handlers, error mapper | `apps/api` (module registration only), `apps/worker` (module registration only) |

```typescript
// ✅ CORRECT: Service depends on interface
import { RegistrarProvider } from '@prisnames/registrar-core';

class DomainRegistrationService {
  constructor(private readonly registrar: RegistrarProvider) {}
}

// ❌ WRONG: Service depends on implementation
import { DynadotRegistrarProvider } from '@prisnames/registrar-dynadot';
```

---

## 2. RegistrarProvider Interface

```typescript
// packages/registrar-core/src/interfaces/registrar-provider.interface.ts

interface RegistrarProvider {
  readonly providerId: string;      // "dynadot"
  readonly providerName: string;    // "Dynadot (GDG)"

  // === Health ===
  healthCheck(): Promise<ProviderHealthStatus>;

  // === Search ===
  checkAvailability(domain: string, options?: SearchOptions): Promise<DomainAvailability>;
  bulkCheckAvailability(domains: string[], options?: BulkSearchOptions): Promise<DomainAvailability[]>;
  suggestDomains(keyword: string, tlds: string[], options?: SuggestionOptions): Promise<DomainSuggestion[]>;

  // === Registration ===
  registerDomain(params: RegisterDomainParams): Promise<RegistrationResult>;

  // === Renewal ===
  renewDomain(params: RenewDomainParams): Promise<RenewalResult>;

  // === Restore ===
  restoreDomain(params: RestoreDomainParams): Promise<RestoreResult>;

  // === Grace Delete ===
  graceDelete(domain: string): Promise<GraceDeleteResult>;

  // === Transfer ===
  transferIn(params: TransferInParams): Promise<TransferResult>;
  getTransferStatus(domain: string, transferType: string): Promise<TransferStatusResult>;
  cancelTransfer(orderId: number, domain: string): Promise<void>;
  authorizeTransferAway(orderId: number, domain: string, approve: boolean): Promise<void>;
  getTransferAuthCode(domain: string, options?: AuthCodeOptions): Promise<string>;

  // === Domain Info ===
  getDomainInfo(domain: string): Promise<DomainInfo>;
  listDomains(params: ListDomainsParams): Promise<PaginatedResult<DomainSummary>>;

  // === Nameservers ===
  setNameservers(domain: string, nameservers: string[]): Promise<void>;
  registerNameserver(hostname: string, ip: string): Promise<void>;
  updateRegisteredNameserver(hostname: string, ip: string): Promise<void>;
  deleteRegisteredNameserver(hostname: string): Promise<void>;

  // === DNS ===
  getDnsRecords(domain: string): Promise<DnsRecord[]>;
  setDnsRecords(domain: string, records: DnsRecordInput[]): Promise<void>;

  // === DNSSEC ===
  getDnssecRecords(domain: string): Promise<DnssecRecord[]>;
  setDnssecRecords(domain: string, records: DnssecRecordInput[]): Promise<void>;

  // === Contacts ===
  setContacts(domain: string, contacts: ContactInput): Promise<ContactResult>;
  getContact(contactId: string): Promise<Contact>;
  createContact(contact: CreateContactInput): Promise<string>;
  updateContact(contactId: string, updates: UpdateContactInput): Promise<void>;
  deleteContact(contactId: string): Promise<void>;

  // === Domain Settings ===
  setPrivacy(domain: string, level: PrivacyLevel): Promise<void>;
  setTransferLock(domain: string, locked: boolean): Promise<void>;
  setRenewOption(domain: string, option: RenewOption): Promise<void>;

  // === Pricing ===
  getTldPricing(options?: PricingOptions): Promise<TldPricing[]>;

  // === Orders ===
  getOrderStatus(orderId: number): Promise<ProviderOrderStatus>;
  listOrders(params: ListOrdersParams): Promise<PaginatedResult<ProviderOrder>>;

  // === Account ===
  getAccountInfo(): Promise<AccountInfo>;

  // === Forwarding ===
  setForwarding(domain: string, url: string, type: ForwardingType): Promise<void>;
  getForwarding(domain: string): Promise<ForwardingInfo | null>;
}
```

### 2.1 Normalized Models

All models in `registrar-core` are **provider-agnostic**:

```typescript
// packages/registrar-core/src/models/

interface DomainAvailability {
  fqdn: string;
  available: boolean;
  isPremium: boolean;
  pricing: DomainPricing | null;
  provider: string;
}

interface DomainInfo {
  fqdn: string;
  providerDomainId: string;
  status: string;              // Raw provider status (not lifecycle_status)
  registeredAt: Date | null;
  expiresAt: Date | null;
  nameservers: string[];
  autoRenew: boolean;
  transferLocked: boolean;
  privacyLevel: string | null;
  contacts: ContactSummary | null;
}

interface RegistrationResult {
  success: boolean;
  providerOrderId: number | null;
  providerDomainId: string | null;
  expiresAt: Date | null;
  async: boolean;              // true if HTTP 202
}

interface MoneyAmount {
  amount: number;              // Minor units
  currency: string;            // ISO 4217
}
```

---

## 3. RegistrarResolver

```typescript
// packages/registrar-core/src/services/registrar-resolver.ts

@Injectable()
class RegistrarResolver {
  constructor(
    private readonly providers: Map<string, RegistrarProvider>,
  ) {}

  // V1: Always returns DYNADOT
  resolve(domain?: string): RegistrarProvider {
    return this.providers.get('dynadot')!;
  }

  // V1: Returns single provider
  getProvider(providerId: string): RegistrarProvider {
    const provider = this.providers.get(providerId);
    if (!provider) throw new ProviderNotFoundError(providerId);
    return provider;
  }

  // V1: Returns ['dynadot']
  listActiveProviders(): string[] {
    return Array.from(this.providers.keys());
  }
}
```

**Future**: `resolve(domain)` will support multi-provider routing based on TLD, cost, health, or business rules.

---

## 4. Provider Ownership Model

Every domain records its upstream provider:

```sql
domains.registrar_provider_id → registrar_providers.id
domains.provider_domain_id    → Dynadot's internal domain identifier
```

Every registrar operation records its provider:

```sql
registrar_operations.registrar_provider_id → registrar_providers.id
registrar_operations.provider_order_id     → Dynadot's order_id
registrar_operations.provider_request_id   → X-Request-ID we sent
```

**Rule**: Never assume all domains belong to the same provider. Queries that touch registrar data must always scope by `registrar_provider_id`.

---

## 5. Dynadot Adapter Structure

```
packages/registrar-dynadot/
├── src/
│   ├── index.ts                          # Public exports
│   ├── dynadot.provider.ts               # RegistrarProvider implementation
│   ├── dynadot.module.ts                 # NestJS module
│   │
│   ├── client/
│   │   ├── dynadot-http.client.ts        # Low-level HTTP client
│   │   ├── dynadot-signature.service.ts  # HMAC-SHA256 X-Signature generation
│   │   ├── dynadot-rate-limiter.ts       # Redis-backed rate limiter + semaphore
│   │   └── dynadot-config.ts             # Env config + sandbox/prod URL derivation
│   │
│   ├── dto/
│   │   ├── requests/                     # Dynadot-specific request DTOs (Zod schemas)
│   │   │   ├── search.dto.ts
│   │   │   ├── register.dto.ts
│   │   │   ├── renew.dto.ts
│   │   │   ├── transfer.dto.ts
│   │   │   ├── dns.dto.ts
│   │   │   ├── contacts.dto.ts
│   │   │   └── ...
│   │   └── responses/                    # Dynadot-specific response DTOs (Zod schemas)
│   │       ├── search-response.dto.ts
│   │       ├── domain-info-response.dto.ts
│   │       ├── order-response.dto.ts
│   │       └── ...
│   │
│   ├── mappers/
│   │   ├── domain.mapper.ts              # Dynadot → registrar-core DomainInfo
│   │   ├── contact.mapper.ts             # Dynadot → registrar-core Contact
│   │   ├── dns.mapper.ts                 # Dynadot → registrar-core DnsRecord
│   │   ├── price.mapper.ts              # Dynadot → registrar-core TldPricing
│   │   ├── order.mapper.ts              # Dynadot → registrar-core ProviderOrder
│   │   └── error.mapper.ts              # Dynadot HTTP error → PrisNames error
│   │
│   ├── webhooks/
│   │   ├── webhook-signature.verifier.ts # Verify HMAC-SHA256 on inbound webhooks
│   │   ├── webhook-handler.ts            # Route events to type-specific handlers
│   │   └── handlers/
│   │       ├── order-completed.handler.ts
│   │       ├── domain-status-changed.handler.ts
│   │       ├── domain-transfer-away.handler.ts
│   │       ├── domain-expiring.handler.ts
│   │       ├── domain-suspension.handler.ts
│   │       ├── whois-verification.handler.ts
│   │       ├── maintenance-notice.handler.ts
│   │       ├── balance-reminder.handler.ts
│   │       └── contact-kyc.handler.ts
│   │
│   ├── errors/
│   │   ├── dynadot-error.ts              # Dynadot-specific error types
│   │   └── error-code-map.ts             # HTTP status → DynadotError mapping
│   │
│   └── __tests__/
│       ├── dynadot.provider.spec.ts
│       ├── dynadot-signature.spec.ts
│       ├── dynadot-rate-limiter.spec.ts
│       └── webhook-signature.spec.ts
│
├── package.json
└── tsconfig.json
```

---

## 6. DTO Ownership Boundary

| Layer | Owns | Format |
|-------|------|--------|
| `registrar-dynadot/dto/requests/` | Dynadot request shapes | Strict Zod schemas matching Dynadot API |
| `registrar-dynadot/dto/responses/` | Dynadot response shapes | Strict Zod schemas (post-discovery) |
| `registrar-dynadot/mappers/` | Conversion logic | Dynadot DTO → registrar-core model |
| `registrar-core/models/` | Normalized internal models | TypeScript interfaces + Zod schemas |

**Rules:**
- Dynadot DTOs NEVER appear outside `registrar-dynadot`
- Business logic ONLY uses `registrar-core` models
- Mappers are the single point of conversion
- Unknown provider fields are logged and stripped, never forwarded
- Raw provider responses are stored encrypted in `registrar_operations.provider_response_raw`

See DYNADOT_INTEGRATION.md §15 for the complete DTO validation strategy including discovery-phase vs production-phase approaches.

---

## 7. Provider Health Tracking

```typescript
// packages/registrar-core/src/services/provider-health.service.ts

@Injectable()
class ProviderHealthService {
  // Called by health check job (every 60s)
  async checkHealth(providerId: string): Promise<ProviderHealthStatus>;

  // Called by workers before API calls
  async isAvailable(providerId: string): Promise<boolean>;

  // Called after each API call
  async recordResult(providerId: string, result: ApiCallResult): void;

  // Circuit breaker
  async getCircuitState(providerId: string): Promise<'closed' | 'open' | 'half-open'>;
}
```

**Circuit Breaker Config:**

| Parameter | Value |
|-----------|-------|
| Failure threshold | 5 consecutive failures |
| Open duration | 30 seconds |
| Half-open test count | 1 |
| Success threshold to close | 2 consecutive successes |

Health data is cached in Redis (`provider:health:{providerId}`, TTL: 30s).

---

## 8. Rate Limiting

Provider-level rate limiting is implemented in `packages/registrar-dynadot`, not at the application level. See DYNADOT_INTEGRATION.md §4 for full details.

Summary:

- Redis-backed sliding window counter for requests per minute
- Redis-backed distributed semaphore for concurrent thread limit
- BullMQ queue concurrency aligned with provider thread limit
- Separate daily budget counter for domain appraisal
- Automatic backoff on HTTP 429 responses
- Configurable tier: REGULAR (1 thread, 60/min), BULK (5, 600/min), SUPER_BULK (35, 6000/min)

---

## 9. Error Normalization

Provider errors are caught and mapped to PrisNames-specific error types. Raw Dynadot error details are logged but NEVER exposed to customers.

```typescript
// packages/registrar-core/src/errors/

class ProviderError extends Error {
  constructor(
    public readonly code: ProviderErrorCode,
    message: string,
    public readonly providerId: string,
    public readonly httpStatus?: number,
  ) { super(message); }
}

enum ProviderErrorCode {
  DOMAIN_NOT_AVAILABLE = 'DOMAIN_NOT_AVAILABLE',
  DOMAIN_NOT_FOUND = 'DOMAIN_NOT_FOUND',
  INSUFFICIENT_FUNDS = 'INSUFFICIENT_FUNDS',
  ACCOUNT_RESTRICTED = 'ACCOUNT_RESTRICTED',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  RATE_LIMITED = 'RATE_LIMITED',
  PROVIDER_UNAVAILABLE = 'PROVIDER_UNAVAILABLE',
  FEATURE_UNAVAILABLE = 'FEATURE_UNAVAILABLE',
  AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR',
  OPERATION_CONFLICT = 'OPERATION_CONFLICT',
  TIMEOUT = 'TIMEOUT',
  UNKNOWN = 'UNKNOWN',
}
```

See DYNADOT_INTEGRATION.md §12 for HTTP status code → error type mapping.

---

## 10. Webhook Ingestion

### 10.1 Endpoint

```
POST /api/v1/webhooks/dynadot
```

Lives in `apps/api`. The controller delegates to `registrar-dynadot` webhook handler.

### 10.2 Processing Pipeline

```
1. Receive raw body
2. Verify Authorization header (Bearer WEBHOOK_KEY)
3. Verify X-Signature (HMAC-SHA256 with WEBHOOK_SECRET)
4. Store raw payload encrypted in webhook_events
5. Check event_id for deduplication
6. Return { "Status": "200" } immediately
7. Enqueue to BullMQ webhook-processing queue
8. Handler correlates event to internal entities
9. Handler invokes owning services (not direct DB writes)
```

### 10.3 Webhook Security

- HMAC-SHA256 verification before any processing
- Raw payload encrypted at rest (AES-256-GCM)
- 90-day retention, then purged
- ADMIN/SUPER_ADMIN access only for raw payload viewing
- No raw payload logging
- Replay is admin-only and audit-logged

See DYNADOT_INTEGRATION.md §16 for full raw payload security policy.

---

## 11. Future Providers

The architecture supports adding providers without rewriting business logic:

1. Create `packages/registrar-{provider}/`
2. Implement `RegistrarProvider` interface
3. Create provider-specific DTOs, mappers, error maps
4. Register as NestJS module
5. Add to `RegistrarResolver` (V2+)
6. Add `registrar_providers` row in database

**Planned future providers**: Openprovider, CentralNic, Netim, NameSilo, OpenSRS, Name.com
