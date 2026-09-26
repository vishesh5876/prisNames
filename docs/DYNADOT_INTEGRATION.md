# Dynadot REST API v2 Integration Architecture

> **API Version**: v2.0.0 Beta  
> **Base URL (Production)**: `https://api.dynadot.com`  
> **Base URL (Sandbox)**: `https://api-sandbox.dynadot.com`  
> **Base URL (Reseller)**: `https://reseller-api.dynadot.com`  
> **Documentation Status**: Beta — endpoints, fields, error codes, and behaviors may change without notice  
> **Last Audit Date**: 2026-09-12  

> [!CAUTION]
> **REST API v2 is Beta.** Backward compatibility is not guaranteed. The PrisNames integration MUST use defensive coding, version-pinned DTOs, and comprehensive error handling to survive breaking changes. All Dynadot-specific types live exclusively in `packages/registrar-dynadot`; generic PrisNames logic consumes only normalized models from `packages/registrar-core`.

---

## 1. Capability Matrix

### 1.1 Domain Search & Availability

| # | Capability | Status | Endpoint | Method | X-Sig | Sandbox | Notes |
|---|-----------|--------|----------|--------|-------|---------|-------|
| 1 | Single domain search | **SUPPORTED** | `/restful/v2/domains/{domain_name}/search` | GET | No | Yes | Returns `available`, `premium`, `price_list`. Optional `show_price`, `currency`. |
| 2 | Bulk domain search | **SUPPORTED** | `/restful/v2/domains/bulk_search` | GET | No | Yes | Accepts `domain_name_list`, `timeout`. Returns `domain_result_list`. |
| 3 | Power search | **SUPPORTED** | `/restful/v2/domains/{domain_name}/power_search_new` | GET | No | Yes | Cursor-paginated, max 25/page. Filter by `status` (available, taken, reserved_by_registry, invalid). |
| 4 | Suggestion search | **SUPPORTED** | `/restful/v2/domains/{domain_name}/suggestion_search` | GET | No | Yes | Requires `tlds` param (comma-separated). Optional `max_count`, `show_price`, `currency`. |

### 1.2 Domain Registration & Lifecycle

| # | Capability | Status | Endpoint | Method | X-Sig | Sandbox | Notes |
|---|-----------|--------|----------|--------|-------|---------|-------|
| 5 | Domain registration | **SUPPORTED** | `/restful/v2/domains/{domain_name}/register` | POST | **Yes** | Yes | `domain` object (13 items), `currency`, `register_premium`, `coupon_code`. Returns `domain_name`, `expiration_date`. Errors: 402 insufficient funds, 403 account blocked, 502/503 registry errors. |
| 6 | Premium registration | **SUPPORTED** | Same as #5 | POST | **Yes** | Yes | Set `register_premium: true`. |
| 7 | Domain renewal | **SUPPORTED** | `/restful/v2/domains/{domain_name}/renew` | POST | **Yes** | Yes | `duration`, `year`, `currency`, `coupon`, `no_renew_if_late_renew_fee_needed`. Returns `expiration_date`. |
| 8 | Domain restore | **SUPPORTED** | `/restful/v2/domains/{domain_name}/restore` | POST | **Yes** | Yes | `currency`, `coupon_code`. Returns `order_id`. Errors: 409 not restartable, 503 registry offline. |
| 9 | Grace delete | **SUPPORTED** | `/restful/v2/domains/{domain_name}/grace_delete` | DELETE | **Yes** | Yes | `add_to_waiting_list` param. Detailed error codes for quota, period, UDRP lock. 503 registry busy/offline. |
| 10 | Post-grace delete | **SUPPORTED** | `/restful/v2/domains/{domain_name}/post_grace_delete` | DELETE | **Yes** | Yes | For domains past grace period. |
| 11 | Domain appraisal | **SUPPORTED** | `/restful/v2/domains/{domain_name}/appraisal` | GET | No | Yes | Returns `appraisal_price`. Subject to daily quota (50/100/300 by tier). |

### 1.3 Domain Information & Management

| # | Capability | Status | Endpoint | Method | X-Sig | Sandbox | Notes |
|---|-----------|--------|----------|--------|-------|---------|-------|
| 12 | Domain info | **SUPPORTED** | `/restful/v2/domains/{domain_name}` | GET | **Yes** | Yes | Returns `domain_info` object. |
| 13 | Domain list | **SUPPORTED** | `/restful/v2/domains` | GET | **Yes** | Yes | Paginated, sortable, filterable by 24+ status values. Returns `domain_info_list` + `pagination_result`. |
| 14 | Set renew option | **SUPPORTED** | `/restful/v2/domains/{domain_name}/renew_option` | PUT | **Yes** | Yes | `renew_option` string. |
| 15 | Set folder | **SUPPORTED** | `/restful/v2/domains/{domain_name}/folders/{folder_name}` | PUT | **Yes** | Yes | |
| 16 | Set note | **SUPPORTED** | `/restful/v2/domains/{domain_name}/notes` | PUT | **Yes** | Yes | `note` string. |
| 17 | Clear domain setting | **SUPPORTED** | `/restful/v2/domains/{domain_name}/clear_domain_setting` | PUT | **Yes** | Yes | `service_type` string. |

### 1.4 Nameservers

| # | Capability | Status | Endpoint | Method | X-Sig | Sandbox | Notes |
|---|-----------|--------|----------|--------|-------|---------|-------|
| 18 | Get domain nameservers | **SUPPORTED** | `/restful/v2/domains/{domain_name}/nameservers` | GET | No | Yes | Returns `nameserver_list`, `glue_type`. |
| 19 | Set domain nameservers | **SUPPORTED** | `/restful/v2/domains/{domain_name}/nameservers` | PUT | **Yes** | Yes | `nameserver_list` array. |
| 20 | Get nameserver (registered) | **SUPPORTED** | `/restful/v2/nameservers/{nameserver}` | GET | **Yes** | Yes | |
| 21 | List registered nameservers | **SUPPORTED** | `/restful/v2/nameservers` | GET | **Yes** | Yes | |
| 22 | Register nameserver (glue) | **SUPPORTED** | `/restful/v2/nameservers/register` | POST | **Yes** | Yes | `nameserver` object (2 items). |
| 23 | Add external nameserver | **SUPPORTED** | `/restful/v2/nameservers/{nameserver}/add_external` | POST | **Yes** | Yes | |
| 24 | Set nameserver IP | **SUPPORTED** | `/restful/v2/nameservers/{nameserver}/set_ip` | PUT | **Yes** | Yes | `ip_list`. Returns `server_name`, `server_id`. |
| 25 | Delete nameserver | **SUPPORTED** | `/restful/v2/nameservers/{nameserver}` | DELETE | **Yes** | Yes | |

### 1.5 DNS Records

| # | Capability | Status | Endpoint | Method | X-Sig | Sandbox | Notes |
|---|-----------|--------|----------|--------|-------|---------|-------|
| 26 | Get DNS records | **SUPPORTED** | `/restful/v2/domains/{domain_name}/records` | GET | **Yes** | Yes | Returns `glue_info` object. |
| 27 | Set DNS records | **SUPPORTED** | `/restful/v2/domains/{domain_name}/records` | POST | **Yes** | Yes | `dns_main_list`, `dns_sub_list`, `ttl`, `add_dns_to_current_setting`. |
| 28 | Remove DNS records | **SUPPORTED** | `/restful/v2/domains/{domain_name}/records` | DELETE | No | Yes | Returns `main_record_removed_count`, `sub_record_removed_count`. |

### 1.6 DNSSEC

| # | Capability | Status | Endpoint | Method | X-Sig | Sandbox | Notes |
|---|-----------|--------|----------|--------|-------|---------|-------|
| 29 | Get DNSSEC | **SUPPORTED** | `/restful/v2/domains/{domain_name}/dnssec` | GET | **Yes** | Yes | Returns `dnssec_info_list`. Error if domain doesn't support DNSSEC. |
| 30 | Set DNSSEC | **SUPPORTED** | `/restful/v2/domains/{domain_name}/dnssec` | PUT | **Yes** | Yes | `key_tag`, `digest_type`, `digest`, `algorithm`, `flags`, `public_key`. |
| 31 | Clear DNSSEC | **SUPPORTED** | `/restful/v2/domains/{domain_name}/dnssec` | DELETE | **Yes** | Yes | |

### 1.7 Contacts

| # | Capability | Status | Endpoint | Method | X-Sig | Sandbox | Notes |
|---|-----------|--------|----------|--------|-------|---------|-------|
| 32 | Get contact | **SUPPORTED** | `/restful/v2/contacts/{contact_id}` | GET | **Yes** | Yes | Returns `contact` object. |
| 33 | List contacts | **SUPPORTED** | `/restful/v2/contacts` | GET | **Yes** | Yes | Filterable: `whois_verification_status`, `in_use`, `cnnic_cn_audit_status`. Paginated. |
| 34 | Create contact | **SUPPORTED** | `/restful/v2/contacts` | POST | **Yes** | Yes | `contact` object (14 items). Returns `contact_id`. |
| 35 | Update contact | **SUPPORTED** | `/restful/v2/contacts/{contact_id}` | PUT | **Yes** | Yes | `contact` object (14 items). **Returns 202** (async) possible. |
| 36 | Delete contact | **SUPPORTED** | `/restful/v2/contacts/{contact_id}` | DELETE | **Yes** | Yes | 409 if contact in use. |
| 37 | Set domain contacts | **SUPPORTED** | `/restful/v2/domains/{domain_name}/contacts` | PUT | **Yes** | Yes | All 4 roles: `registrant_contact_id`, `admin_contact_id`, `technical_contact_id`, `billing_contact_id`. **Returns 202** (async) possible. |

### 1.8 TLD-Specific Contact Settings

| # | Capability | Status | TLDs Covered | Notes |
|---|-----------|--------|-------------|-------|
| 38 | TLD contact settings | **SUPPORTED** | `.aero`, `.ca`, `.eu`, `.fr`, `.hk`, `.ie`, `.it`, `.lt`, `.lv`, `.music`, `.no`, `.pt`, `.ro`, `.us` | Each has `get_*_setting` (GET) and `set_*_setting` (PUT). All require X-Signature. Most support Sandbox. |
| 39 | CN audit | **SUPPORTED** | `.cn` (and gTLDs) | `create_cn_audit`, `get_cn_audit_status`. Separate audit flow for CNNIC domains. |
| 40 | CNNIC privacy | **PARTIALLY_SUPPORTED** | `.cn` | `create_cnnic_privacy`, `list_cnnic_privacy`, `set_cnnic_privacy`, `remove_cnnic_privacy`. No Sandbox support noted. |

### 1.9 Privacy & WHOIS

| # | Capability | Status | Endpoint | Method | X-Sig | Sandbox | Notes |
|---|-----------|--------|----------|--------|-------|---------|-------|
| 41 | Set privacy | **SUPPORTED** | `/restful/v2/domains/{domain_name}/privacy` | PUT | **Yes** | Yes | `privacy_level` string. 403 Forbidden possible. |

### 1.10 Transfer Operations

| # | Capability | Status | Endpoint | Method | X-Sig | Sandbox | Notes |
|---|-----------|--------|----------|--------|-------|---------|-------|
| 42 | Transfer-in | **SUPPORTED** | `/restful/v2/domains/{domain_name}/transfer_in` | POST | **Yes** | Yes | `domain` (13 items), `auth_code` required, `transfer_premium`, `coupon_code`. **HTTP 202 possible** (async). |
| 43 | Get transfer status | **SUPPORTED** | `/restful/v2/domains/{domain_name}/transfer_status` | GET | No | Yes | `transfer_type` param. Returns `domain_transfer_status_list`. |
| 44 | Cancel transfer | **SUPPORTED** | `/restful/v2/orders/{order_id}/cancel_transfer` | POST | **Yes** | Yes | `domain_name` in body. |
| 45 | Authorize transfer-away | **SUPPORTED** | `/restful/v2/orders/{order_id}/authorize_transfer_away` | POST | **Yes** | Yes | `domain_name`, `approve` (boolean). |
| 46 | Set transfer auth code | **SUPPORTED** | `/restful/v2/orders/{order_id}/update_transfer_auth_code` | POST | **Yes** | Yes | `domain_name`, `auth_code`. |
| 47 | Get transfer auth code | **SUPPORTED** | `/restful/v2/domains/{domain_name}/transfer_auth_code` | GET | **Yes** | Yes | `new_code` (boolean), `unlock_domain_for_transfer` (boolean). Returns `auth_code`. |
| 48 | Domain lock | **SUPPORTED** | `/restful/v2/domains/{domain_name}/domain_lock` | PUT | **Yes** | Yes | `lock` boolean. |
| 49 | Push domain | **SUPPORTED** | `/restful/v2/domains/{domain_name}/push` | POST | **Yes** | Yes | `receiver_push_username`, `receiver_email`. |
| 50 | Accept push | **SUPPORTED** | `/restful/v2/domains/{domain_name}/accept_push` | POST | **Yes** | Yes | `push_action` string. |
| 51 | Get pending push | **SUPPORTED** | `/restful/v2/domains/pending_accept_pushes` | GET | **Yes** | Yes | Returns `domain_name_list`. |

### 1.11 Domain Forwarding & Hosting

| # | Capability | Status | Endpoint | Method | X-Sig | Sandbox | Notes |
|---|-----------|--------|----------|--------|-------|---------|-------|
| 52 | Domain forwarding | **SUPPORTED** | `/restful/v2/domains/{domain_name}/domain_forwarding` | PUT | **Yes** | Yes | `forward_url`, `is_temporary`, `enable_domain_variable`, `enable_wildcard_forwarding`. |
| 53 | Stealth forwarding | **SUPPORTED** | `/restful/v2/domains/{domain_name}/stealth_forwarding` | PUT | **Yes** | Yes | `stealth_url`, `stealth_title`. |
| 54 | Email forwarding | **SUPPORTED** | `/restful/v2/domains/{domain_name}/email_forwarding` | PUT | **Yes** | Yes | `email_forward_type`, `email_alias_list`, `email_exchange_list`. |
| 55 | Set hosting | **SUPPORTED** | `/restful/v2/domains/{domain_name}/hosts` | PUT | **Yes** | Yes | `hosting_type`, `is_model_view`. |
| 56 | Set parking | **SUPPORTED** | `/restful/v2/domains/{domain_name}/parking` | PUT | **Yes** | Yes | `with_ads` boolean. |

### 1.12 TLD Pricing

| # | Capability | Status | Endpoint | Method | X-Sig | Sandbox | Notes |
|---|-----------|--------|----------|--------|-------|---------|-------|
| 57 | Get TLD prices | **SUPPORTED** | `/restful/v2/domains/get_tld_price` | GET | No | Yes | Paginated, sortable. `show_multi_year` for multi-year pricing. `tlds` filter. Returns `tld_price_list`, `price_level`. 32 currencies supported. |

### 1.13 Orders

| # | Capability | Status | Endpoint | Method | X-Sig | Sandbox | Notes |
|---|-----------|--------|----------|--------|-------|---------|-------|
| 58 | Get order status | **SUPPORTED** | `/restful/v2/orders/{order_id}` | GET | **Yes** | Yes | Returns `order_id`, `order_status`, `order_status_item_list`. |
| 59 | Get order history | **SUPPORTED** | `/restful/v2/orders` | GET | **Yes** | Yes | Filterable: `domain_name_list`, `order_id_list`, `search_type`, time range, `payment_method`. |
| 60 | List coupons | **SUPPORTED** | `/restful/v2/orders/coupons` | GET | No | Yes | `coupon_type` filter. |

### 1.14 Account

| # | Capability | Status | Endpoint | Method | X-Sig | Sandbox | Notes |
|---|-----------|--------|----------|--------|-------|---------|-------|
| 61 | Get account info | **SUPPORTED** | `/restful/v2/accounts/info` | GET | **Yes** | Yes | Returns `account_info` object. |
| 62 | Set account lock | **SUPPORTED** | `/restful/v2/accounts/account_lock` | PUT | **Yes** | Yes | `lock` boolean. |
| 63 | Set default nameservers | **SUPPORTED** | `/restful/v2/accounts/default_nameservers` | PUT | **Yes** | Yes | |
| 64 | Set default contacts | **SUPPORTED** | `/restful/v2/accounts/default_contacts` | PUT | **Yes** | Yes | |
| 65 | Set default DNS | **SUPPORTED** | `/restful/v2/default_records` | PUT | **Yes** | Yes | |
| 66 | Set defaults (forwarding, stealth, email, parking, hosting, renew) | **SUPPORTED** | `/restful/v2/accounts/default_*` | PUT | **Yes** | Yes | Multiple endpoints for each default type. |
| 67 | Clear default setting | **SUPPORTED** | `/restful/v2/accounts/clear_default_setting` | PUT | **Yes** | Yes | `service_type` string. |

### 1.15 Folders

| # | Capability | Status | Endpoint | Method | X-Sig | Sandbox | Notes |
|---|-----------|--------|----------|--------|-------|---------|-------|
| 68 | Folder CRUD | **SUPPORTED** | `/restful/v2/folders` + `/{folder_name}` | GET/POST/DELETE | Mixed | Yes | List, create (returns 201), delete, rename. |
| 69 | Folder settings | **SUPPORTED** | `/restful/v2/folders/{folder_name}/*` | PUT | **Yes** | Yes | DNS, nameservers, contacts, parking, forwarding, stealth, email, hosting, renew option. `apply_for_future_domain` and `sync_setting_to_existing_domains_in_this_folder` flags. |

### 1.16 Reseller-Specific (via `reseller-api.dynadot.com`)

| # | Capability | Status | Endpoint | Method | X-Sig | Sandbox | Notes |
|---|-----------|--------|----------|--------|-------|---------|-------|
| 70 | Get/set reseller hold status | **SUPPORTED** | `/restful/v2/domains/{domain_name}/reseller_hold_status` | GET/PUT | PUT only | Yes | Returns `hold_status` boolean. |
| 71 | Get/set domain customer ID | **SUPPORTED** | `/restful/v2/domains/{domain_name}/customer_id` | GET/PUT | PUT only | Yes | |
| 72 | Get/set contact customer ID | **SUPPORTED** | `/restful/v2/contacts/{contact_id}/customer_id` | GET/PUT | PUT only | Yes | |
| 73 | Get/set 60-day transfer lock opt-out | **SUPPORTED** | `/restful/v2/contacts/{contact_id}/opt_out_of_60_day_transfer_lock` | GET/PUT | PUT only | Yes | |
| 74 | Get/set WHOIS verification status | **SUPPORTED** | `/restful/v2/contacts/{contact_id}/get_whois_verification_status` / `set_whois_verification_status` | GET/PUT | PUT only | Yes | Set requires: `contact_email`, `contact_has_been_verified_and_confirmed`, `confirmed_ip`. |

### 1.17 Aftermarket

| # | Capability | Status | Notes |
|---|-----------|--------|-------|
| 75 | Set for sale | **SUPPORTED** | Full listing params: type, currency, price, min offer, installment, category, SEO index. |
| 76 | Buy it now | **SUPPORTED** | With `price_to_verify` safety check. |
| 77 | Auctions (open, closed, bids, installment) | **SUPPORTED** | Complete auction lifecycle. `place_auction_bid` and `get_auction_bid` exempt from rate limits. |
| 78 | Backorders | **SUPPORTED** | Add/delete/list requests. |
| 79 | Expired closeout purchase | **SUPPORTED** | |
| 80 | Other registrar domains | **SUPPORTED** | Verify, list, add, listing for domains at other registrars. |

### 1.18 Other Services

| # | Capability | Status | Notes |
|---|-----------|--------|-------|
| 81 | Site builder | **SUPPORTED** | Get, list, create, upgrade. |
| 82 | Email hosting | **SUPPORTED** | Create, list, delete, upgrade. |

---

## 2. Genuinely Unsupported / Unknown Capabilities

| # | Capability | Status | Impact | Mitigation |
|---|-----------|--------|--------|------------|
| 1 | Account balance query (explicit) | **PARTIALLY_SUPPORTED** | `accounts/info` likely includes balance but response schema says "Show Properties" (not expanded). | Call `accounts/info` and extract balance field. ACCOUNT_BALANCE_REMINDER webhook provides balance_list. |
| 2 | Explicit WHOIS lookup | **UNSUPPORTED** | No WHOIS query endpoint for arbitrary domains. | Use standard RDAP/WHOIS protocols externally. Not needed for owned domains (use domain_info). |
| 3 | Bulk registration/renewal | **UNSUPPORTED** | Doc explicitly states "bulk creations, updates, deletes are not supported." | Queue individual operations via BullMQ. Respect rate limits. |
| 4 | Domain auto-renew toggle (dedicated) | **PARTIALLY_SUPPORTED** | `set_renew_option` exists but supported values are not expanded in docs. | Probe in sandbox. Likely accepts `auto_renew`, `manual_renew`, `do_not_renew`. |
| 5 | Registrant change (IRTP) | **UNKNOWN** | No dedicated IRTP endpoint. Contact update returns 202 (async), which may trigger IRTP. | Contact update with registrant change may implicitly trigger IRTP. Requires sandbox testing. |
| 6 | Domain premium price query (pre-reg) | **PARTIALLY_SUPPORTED** | Search returns `premium` and `price_list` but expansion details are not shown. | Test in sandbox to confirm price structure. |
| 7 | DNS record type enumeration | **PARTIALLY_SUPPORTED** | `dns_main_list` and `dns_sub_list` structure not expanded in docs. | Probe via sandbox. Likely supports A, AAAA, CNAME, MX, TXT, NS, SRV, CAA. |
| 8 | Domain transfer-out (initiate from our side) | **SUPPORTED** via `get_transfer_auth_code` | We can get auth code + unlock, then the gaining registrar initiates. `authorize_transfer_away` lets us approve/deny. | Standard EPP transfer-out workflow. |

---

## 3. Webhooks

### 3.1 Documented Webhook Events

| Event | Data Fields | PrisNames Use |
|-------|------------|---------------|
| `ORDER_COMPLETED` | `order_id`, `submitted_date`, `currency`, `total_cost`, `total_paid`, `payment_method`, `status`, `order_item_list` | **Critical** — Correlate to internal registrar_operation by provider_order_id. Process by operation_type (REGISTER, RENEW, TRANSFER_IN, RESTORE). Verify provider state before mutating domain lifecycle. See ORDER_STATE_MACHINE.md §4.1. |
| `DOMAIN_TRANSFER_AWAY` | `domain`, `gaining_registrar`, `order_id` | **Critical** — Invoke `domainService.markTransferredAway()`. Set `lifecycle_status=DELETED`. Record gaining registrar. |
| `DOMAIN_EXPIRING` | 5 buckets: 30/10/3/0 days + redemption | **Critical** — **Notification only, NOT a lifecycle transition.** Update `domains.provider_expiration_info`. Trigger renewal reminders. Optionally schedule reconciliation via `domain_info` to confirm actual provider status. Do NOT set `lifecycle_status=EXPIRED` from this webhook alone. See ORDER_STATE_MACHINE.md §4.2. |
| `ACCOUNT_BALANCE_REMINDER` | `balance_list` | **Important** — Alert admin when account funds are low. |
| `WHOIS_VERIFICATION_REQUIRED` | `contact_id`, `verify_link`, `verify_end_time`, `domain_list` | **Critical** — Forward verification link to registrant, track compliance. |
| `WHOIS_VERIFICATION_NOTIFICATION` | `contact_id`, `verification_message`, `domain_list` | **Important** — Status updates on verification process. |
| `ORDER_PAYMENT_REQUIRED` | Same structure as ORDER_COMPLETED | **Important** — Handle Dynadot-side payment issues. |
| `DOMAIN_STATUS_CHANGED` | `domain`, `change_type`, `expiration`, `status` | **Critical** — Provider-confirmed status change. Invoke `domainService.reconcileProviderStatus()` to map provider status to `lifecycle_status` transition. This is the authoritative source for lifecycle transitions like ACTIVE→EXPIRED. |
| `DOMAIN_SUSPENSION_STATUS_CHANGED` | `domain`, `suspended`, `suspension_type`, `reason`, `message`, `status_changed_timestamp` | **Critical** — Updates **independent suspension flag** (`domains.is_suspended`), NOT `lifecycle_status`. Invoke `domainService.updateSuspensionStatus()`. Domain can be ACTIVE+suspended simultaneously. |
| `MAINTENANCE_NOTICE` | `start_time`, `end_time`, `available_services`, `unavailable_services`, `registry_name`, `affected_tlds` | **Important** — Queue pausing, health status display. |
| `CONTACT_KYC_STATUS_CHANGED` | `contact_id`, `kyc_audit_status` (not_started, action_required, approved, rejected, in_review, expired), `message`, `verify_date`, `failure`, `verifications` | **Important** — KYC compliance workflow. |

### 3.2 Webhook Authentication Architecture

```
Inbound Webhook → Verify Authorization Header (Bearer WEBHOOK_KEY)
               → Verify X-Signature (HMAC-SHA256 with WEBHOOK_SECRET)
               → Parse body → Idempotency check (event_id) → Route to handler
```

- HMAC-SHA256 signature: `webhookKey + "\n" + fullPathAndQuery + "\n" + xRequestId + "\n" + requestBody`
- Verify signature before processing any payload
- Store `event_id` + `timestamp` to deduplicate
- Respond with `{ "Status": "200" }` immediately, process async

### 3.3 Webhook Strategy

1. **Dedicated endpoint**: `POST /api/v1/webhooks/dynadot` — lives in API process
2. **Signature verification middleware** in `packages/registrar-dynadot`
3. **Idempotent processing**: Store `event_id` in `webhook_events` table, skip duplicates
4. **Async fan-out**: After verification, push to BullMQ for processing. Return 200 immediately.
5. **Dead letter queue**: Failed webhook processing → DLQ → admin alert
6. **Replay support**: Store raw webhook payload for manual replay during incidents

---

## 4. Rate Limit Strategy

### 4.1 Documented Rate Limits

| Account Tier | Concurrent Threads | Rate Limit | Domain Appraisal |
|-------------|-------------------|------------|-----------------|
| Regular | 1 | 60/min (1/sec) | 50/day |
| Bulk | 5 | 600/min (10/sec) | 100/day |
| Super Bulk | 35 | 6000/min (100/sec) | 300/day |

**Exception**: `place_auction_bid` and `get_auction_bid` are exempt from rate limits.

### 4.2 Architectural Rate Limiter

```
┌─────────────────────────────────────────────────────────┐
│ DynadotRateLimiter (packages/registrar-dynadot)         │
├─────────────────────────────────────────────────────────┤
│ - Uses Redis-backed sliding window counter              │
│ - Enforces PER-ACCOUNT concurrency (not per-worker)     │
│ - Configurable tier: REGULAR | BULK | SUPER_BULK        │
│ - BullMQ job concurrency MUST NOT exceed thread limit   │
│ - Implements token bucket with jitter for smoothing     │
│ - Separate bucket for domain appraisal (daily quota)    │
│ - Semaphore pattern for concurrent thread enforcement   │
└─────────────────────────────────────────────────────────┘
```

**Key Design Decisions**:

1. **Redis-based semaphore**: A distributed semaphore in Redis limits concurrent in-flight requests to the Dynadot API to `threadCount` for the account tier. Prevents accidental overload even across multiple worker replicas.
2. **BullMQ concurrency alignment**: All BullMQ queues that call Dynadot MUST have their `concurrency` set ≤ `threadCount`. A shared `DynadotConcurrencyGuard` wraps all HTTP calls.
3. **Sliding window rate counter**: Redis key `dynadot:rate:{minute}` tracks requests per minute. Reject/delay if approaching limit.
4. **Backoff on 429**: On `HTTP 429`, extract retry window (documented as 60 seconds), apply exponential backoff with jitter. Log and alert if persistent.
5. **Appraisal budget**: Separate daily counter `dynadot:appraisal:budget:{date}` for domain appraisal. Alert admin when budget is running low.
6. **Config injection**: Tier is set via `DYNADOT_ACCOUNT_TIER` env variable. Defaults to `REGULAR` (safest).

---

## 5. Sandbox Strategy

### 5.1 Environment Separation Architecture

```
┌────────────────────────────────────────────────────────────┐
│ Environment Configuration (packages/registrar-dynadot)     │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  DYNADOT_ENVIRONMENT = "sandbox" | "production"            │
│  DYNADOT_API_KEY     = separate keys per environment       │
│  DYNADOT_API_SECRET  = separate secrets per environment    │
│  DYNADOT_BASE_URL    = derived from DYNADOT_ENVIRONMENT    │
│                                                            │
│  ⚠ DYNADOT_BASE_URL is NEVER configurable directly        │
│  ⚠ It is ALWAYS derived from DYNADOT_ENVIRONMENT          │
│                                                            │
│  sandbox  → https://api-sandbox.dynadot.com                │
│  production → https://api.dynadot.com                      │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

### 5.2 Safety Guardrails

1. **URL derivation, not configuration**: The base URL is NEVER a configurable string. It is always computed from `DYNADOT_ENVIRONMENT`. This prevents copy-paste accidents.
2. **Startup assertion**: On application boot, assert that:
   - `NODE_ENV=production` → `DYNADOT_ENVIRONMENT=production` (the ONLY valid combination)
   - `NODE_ENV=development|test|staging` → `DYNADOT_ENVIRONMENT=sandbox` (ENFORCED)
   - Violation → fatal error, process exit
3. **Sandbox key validation**: Sandbox API keys are distinct from production keys. The adapter verifies the key prefix/format on startup if Dynadot provides distinguishable key formats.
4. **Sandbox balance**: Sandbox comes pre-funded with 10,000 in all currencies. Tests should not assume unlimited balance.
5. **Sandbox feature gaps**: Some API commands may be unavailable in sandbox. The adapter MUST handle `501 Not Implemented` or `503` gracefully and log a warning.
6. **CI/CD pipeline**: CI runs integration tests against sandbox only. Production keys are NEVER available in CI.

---

## 6. Authentication Architecture

### 6.1 API Authentication

- **Header**: `Authorization: Bearer {API_KEY}`
- **Content-Type**: `application/json` (only accepted value)
- **Accept**: `application/json` (or `application/xml`)

### 6.2 X-Signature (HMAC-SHA256)

Required for all transactional/sensitive endpoints (marked "Require X-Signature" in docs).

```
stringToSign = apiKey + "\n" + fullPathAndQuery + "\n" + (xRequestId || "") + "\n" + (requestBody || "")
signature = base64(hmac-sha256(apiSecret, stringToSign))
```

**Implementation in `packages/registrar-dynadot`**:

```typescript
// DynadotSignatureService
class DynadotSignatureService {
  sign(params: {
    apiKey: string;
    apiSecret: string;
    fullPathAndQuery: string;  // e.g., "/restful/v2/domains/example.com/register"
    xRequestId?: string;
    requestBody?: string;
  }): string;
}
```

### 6.3 X-Request-ID

- Optional but recommended. UUID v4 format.
- PrisNames SHOULD always send it for traceability.
- Maps to internal correlation/request IDs.
- Stored in `registrar_operations.provider_request_id` for reconciliation.

---

## 7. HTTP 202 Asynchronous Behavior

### 7.1 Endpoints That Return 202

| Endpoint | Operation |
|----------|-----------|
| `transfer_in` | Transfer-in initiated, pending EPP confirmation |
| `contact_update` | Contact update at registrant level may trigger IRTP |
| `set_contacts` | Setting domain contacts may trigger IRTP |

### 7.2 Handling Strategy

1. On 202: record RegistrarOperation as `ACCEPTED` (not `PROCESSING` or `COMPLETED`)
2. Poll `get_transfer_status` / `domain_info` for eventual state
3. Rely on webhooks (`ORDER_COMPLETED`, `DOMAIN_STATUS_CHANGED`) for async confirmation — correlate by operation_type before processing
4. Implement a reconciliation job that detects stale `ACCEPTED` operations and re-polls
5. Timeout threshold: configurable, default 72 hours for transfers, 1 hour for contact updates

---

## 8. Reconciliation Strategy

### 8.1 Sources of Truth Disagreement

| Scenario | Cause | Detection | Resolution |
|----------|-------|-----------|------------|
| Registration succeeded but webhook missed | Network failure, webhook endpoint down | Scheduled reconciliation polls `domain_info` | `registrarOperationService.succeed()` → `domainService.activate()` |
| Registration failed but RegistrarOp stuck in PROCESSING/UNKNOWN | Dynadot returned 5xx, no retry succeeded | Stale operation detector (age > threshold) | Alert admin, attempt retry or `registrarOperationService.markFailed()` |
| Domain expired but `lifecycle_status` shows ACTIVE | Missed DOMAIN_STATUS_CHANGED webhook | Periodic full domain list sync via `domain_list` | `domainService.reconcileProviderStatus()` → lifecycle_status = EXPIRED |
| Transfer completed but Transfer stuck in PROCESSING | Webhook delivery failure | Poll `get_transfer_status` | `transferService.complete()` → `domainService.activateAfterTransfer()` |

### 8.2 Reconciliation Jobs

1. **Stale Operation Detector** (every 15 min): Find `registrar_operations` in `PROCESSING` state older than threshold. Re-poll Dynadot.
2. **Domain Sync** (daily, off-peak): Call `domain_list` (paginated), compare with local `domains` table. Flag discrepancies for admin review.
3. **Expiration Sync** (daily): Compare local expiration dates with Dynadot `domain_info`. Update if drifted.
4. **Order Reconciliation** (every hour): For recent orders in non-terminal states, call `order_get_status`. Update local state.

---

## 9. RegistrarProvider Interface (Updated)

```typescript
// packages/registrar-core/src/interfaces/registrar-provider.interface.ts

interface RegistrarProvider {
  readonly providerId: string;  // "dynadot"
  readonly providerName: string;  // "Dynadot (GDG)"
  
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
  
  // === Transfer ===
  transferIn(params: TransferInParams): Promise<TransferResult>;
  getTransferStatus(domain: string, transferType: string): Promise<TransferStatus>;
  cancelTransfer(orderId: number, domain: string): Promise<void>;
  authorizeTransferAway(orderId: number, domain: string, approve: boolean): Promise<void>;
  getTransferAuthCode(domain: string, options?: AuthCodeOptions): Promise<string>;
  
  // === Domain Info ===
  getDomainInfo(domain: string): Promise<DomainInfo>;
  listDomains(params: ListDomainsParams): Promise<PaginatedResult<DomainInfo>>;
  
  // === Nameservers ===
  getNameservers(domain: string): Promise<NameserverConfig>;
  setNameservers(domain: string, nameservers: string[]): Promise<void>;
  
  // === DNS ===
  getDnsRecords(domain: string): Promise<DnsRecordSet>;
  setDnsRecords(domain: string, records: SetDnsParams): Promise<void>;
  removeDnsRecords(domain: string, records: RemoveDnsParams): Promise<DnsRemoveResult>;
  
  // === DNSSEC ===
  getDnssec(domain: string): Promise<DnssecInfo[]>;
  setDnssec(domain: string, params: DnssecParams): Promise<void>;
  clearDnssec(domain: string): Promise<void>;
  
  // === Contacts ===
  getContact(contactId: number): Promise<Contact>;
  listContacts(params?: ListContactsParams): Promise<PaginatedResult<Contact>>;
  createContact(contact: CreateContactParams): Promise<number>;  // returns contact_id
  updateContact(contactId: number, contact: UpdateContactParams): Promise<void>;
  deleteContact(contactId: number): Promise<void>;
  setDomainContacts(domain: string, contacts: DomainContactIds): Promise<void>;
  
  // === Privacy ===
  setPrivacy(domain: string, level: PrivacyLevel): Promise<void>;
  
  // === Domain Lock ===
  setDomainLock(domain: string, locked: boolean): Promise<void>;
  
  // === Pricing ===
  getTldPrices(params: TldPriceParams): Promise<PaginatedResult<TldPrice>>;
  
  // === Orders ===
  getOrderStatus(orderId: number): Promise<OrderStatus>;
  getOrderHistory(params: OrderHistoryParams): Promise<OrderInfo[]>;
  
  // === Account ===
  getAccountInfo(): Promise<AccountInfo>;
  
  // === Delete ===
  graceDelete(domain: string, options?: GraceDeleteOptions): Promise<void>;
  
  // === Forwarding (optional, not all providers) ===
  setDomainForwarding?(domain: string, params: ForwardingParams): Promise<void>;
  setEmailForwarding?(domain: string, params: EmailForwardingParams): Promise<void>;
  
  // === Renew Option ===
  setRenewOption(domain: string, option: RenewOption): Promise<void>;
}
```

---

## 10. Proposed Dynadot Adapter Structure

```
packages/registrar-dynadot/
├── src/
│   ├── index.ts                          # Public exports
│   ├── dynadot.provider.ts               # RegistrarProvider implementation
│   ├── dynadot.module.ts                 # NestJS module
│   │
│   ├── client/
│   │   ├── dynadot-http.client.ts        # Low-level HTTP client (axios/fetch)
│   │   ├── dynadot-signature.service.ts  # HMAC-SHA256 X-Signature generation
│   │   ├── dynadot-rate-limiter.ts       # Redis-backed rate limiter + semaphore
│   │   └── dynadot-config.ts             # Env config + sandbox/prod URL derivation
│   │
│   ├── dto/
│   │   ├── requests/                     # Dynadot-specific request DTOs
│   │   │   ├── search.dto.ts
│   │   │   ├── register.dto.ts
│   │   │   ├── renew.dto.ts
│   │   │   ├── transfer.dto.ts
│   │   │   ├── dns.dto.ts
│   │   │   ├── contacts.dto.ts
│   │   │   └── ...
│   │   └── responses/                    # Dynadot-specific response DTOs
│   │       ├── search-response.dto.ts
│   │       ├── domain-info-response.dto.ts
│   │       ├── order-response.dto.ts
│   │       └── ...
│   │
│   ├── mappers/
│   │   ├── domain.mapper.ts              # Dynadot ↔ PrisNames domain model
│   │   ├── contact.mapper.ts             # Dynadot ↔ PrisNames contact model
│   │   ├── dns.mapper.ts                 # Dynadot ↔ PrisNames DNS model
│   │   ├── price.mapper.ts               # Dynadot ↔ PrisNames pricing model
│   │   ├── order.mapper.ts               # Dynadot ↔ PrisNames order model
│   │   └── error.mapper.ts              # Dynadot error → PrisNames error
│   │
│   ├── webhooks/
│   │   ├── webhook-signature.verifier.ts # Verify HMAC-SHA256 on inbound webhooks
│   │   ├── webhook-handler.ts            # Route events to handlers
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

## 11. API Risks (v2 Beta)

| # | Risk | Severity | Mitigation |
|---|------|----------|------------|
| 1 | **Breaking changes without notice** | **HIGH** | Version-pin all DTOs. Never parse unknown fields. Wrap all calls in try/catch with structured error logging. Integration test suite runs daily against sandbox. |
| 2 | **Endpoint removal** | **HIGH** | Provider health check detects 501/404 on critical endpoints. Automatic circuit breaker disables provider, alerts admin. |
| 3 | **Response schema changes** | **MEDIUM** | Use strict DTO validation (Zod) on responses. Unknown fields are logged but ignored. Schema mismatch → error with diagnostic payload, not a crash. |
| 4 | **Rate limit changes** | **MEDIUM** | Rate limiter tier is configurable. 429 responses trigger automatic backoff regardless of configured tier. |
| 5 | **Sandbox behavior divergence** | **MEDIUM** | Document known sandbox limitations. Integration tests have `@sandbox-only` annotations. Production smoke tests are manual, post-deploy. |
| 6 | **Authentication mechanism changes** | **HIGH** | X-Signature algorithm is well-documented. Monitor Dynadot changelog. Signature module is isolated and replaceable. |
| 7 | **New mandatory fields** | **MEDIUM** | 400 errors with descriptive messages are parsed and logged. Adapter surfaces them as `ProviderValidationError`. |
| 8 | **Webhook payload changes** | **MEDIUM** | Webhook handlers accept unknown fields (webhooks only — see DTO strategy §15). Raw payload is always stored for replay. |
| 9 | **Multi-year pricing schema** | **LOW** | `show_multi_year` is optional. If response structure changes, pricing sync fails gracefully and alerts. |
| 10 | **Reseller API URL stability** | **LOW** | Reseller API uses separate base URL (`reseller-api.dynadot.com`). Config handles both base URLs. |

---

## 12. Error Semantics

### 12.1 HTTP Status Code Mapping

| Dynadot Code | Meaning | PrisNames Action |
|-------------|---------|-----------------|
| 200 | Success | Process response |
| 201 | Created (folder) | Process response |
| 202 | Accepted (async) | Mark RegistrarOperation as `ACCEPTED`, await webhook/reconciliation |
| 400 | Bad Request | Map to `ProviderValidationError`, log, return to caller |
| 401 | Unauthorized | Fatal: credential issue. Alert admin immediately. Circuit break. |
| 402 | Payment Required | Insufficient Dynadot balance. Alert admin. Return `InsufficientProviderFundsError`. |
| 403 | Forbidden | Account restriction. Alert admin. Return `ProviderAccountRestricted`. |
| 404 | Not Found | Domain/resource not found at provider. Log, return `ProviderResourceNotFound`. |
| 409 | Conflict | Domain unavailable, UDRP locked, order exists. Map to specific business error. |
| 429 | Too Many Requests | Rate limited. Respect 60-second backoff. Retry with exponential backoff + jitter. |
| 500 | Internal Server Error | Provider error. Retry with backoff (max 3). Log full context. |
| 501 | Not Implemented | Feature not available (possibly sandbox). Log warning, return `ProviderFeatureUnavailable`. |
| 502 | Bad Gateway | Registry issue. Retry with backoff. May indicate maintenance. |
| 503 | Service Unavailable | Registry offline. Check MAINTENANCE_NOTICE webhook. Pause operations for affected TLDs. |
| 504 | Gateway Timeout | Timeout to registry. Retry once, then mark UNKNOWN. |

### 12.2 Error Response Structure

```json
{
  "code": 429,
  "message": "Too Many Requests",
  "error": { ... }
}
```

All Dynadot errors are caught, normalized, and re-thrown as PrisNames-specific error types. Raw Dynadot error details are logged but NEVER exposed to end users.

---

## 13. Idempotency & Request Correlation

1. **X-Request-ID**: Every Dynadot API call includes a UUID v4 `X-Request-ID` header.
2. **Local operation log**: Every call is recorded in `registrar_operations` with: `provider_request_id` (our X-Request-ID), `provider_order_id` (Dynadot's order_id if returned), method, endpoint, status code, response time, error details.
3. **Retry safety**: Registration, renewal, transfer are NOT idempotent at Dynadot. The adapter MUST use distributed locks (Redis) to prevent duplicate submissions for the same domain+operation.
4. **Order dedup**: Dynadot returns `409 Conflict: Order exists already` for duplicate registration/transfer attempts. The adapter treats this as a non-error and looks up the existing order.

---

## 14. Currency Support

32 currencies supported: `usd, gbp, eur, inr, pln, zar, ltl, cny, cad, jpy, nzd, rub, aud, mxn, brl, idr, ars, cop, dkk, rsd, hkd, chf, aed, myr, ngn, kes, czk, btc, nok, thb, php, krw`

PrisNames will initially support **USD** and **INR**. The adapter normalizes all pricing to minor units (cents/paise).

---

## 15. DTO Validation Strategy

### 15.1 Package Ownership

| Package | Owns | Validation |
|---------|------|------------|
| `packages/registrar-dynadot` | Dynadot-specific request/response DTOs | Strict Zod schemas matching Dynadot's API shapes |
| `packages/registrar-core` | Normalized internal models (provider-agnostic) | Strict TypeScript types + Zod schemas |

**Rule**: Dynadot DTOs NEVER leak into business logic. Mappers in `registrar-dynadot/mappers/` convert between Dynadot DTOs and `registrar-core` models. Business logic only imports from `registrar-core`.

### 15.2 Discovery Phase (Phase 5 Sandbox Testing)

The Dynadot docs show `domain: {13 items}` and `contact: {14 items}` without expanding field names. During sandbox discovery:

1. Send requests to the sandbox API and capture full request/response payloads
2. Use `z.passthrough()` temporarily to accept unknown fields
3. Log the complete shapes to determine exact field names, types, and optionality
4. Document discovered schemas in `registrar-dynadot/dto/`

### 15.3 Production Strategy (Post-Discovery)

Once schemas are known, **permissive parsing is removed**:

```typescript
// ❌ Discovery-only (remove before production)
const DynadotDomainResponse = z.object({}).passthrough();

// ✅ Production-ready
const DynadotDomainResponse = z.object({
  domain_name: z.string(),
  expiration_date: z.number(),
  status: z.string(),
  nameserver_list: z.array(z.string()).optional(),
  // ... all known fields explicitly defined
});
```

**Rules for production DTOs:**

| Rule | Rationale |
|------|-----------|
| Every known required field is `.required()` in Zod | Catch upstream breaking changes immediately |
| Optional fields use `.optional()` | Gracefully handle absent fields |
| Unknown fields are stripped (`.strict()`) on request DTOs | Never send unexpected data to Dynadot |
| Unknown fields are logged and stripped on response DTOs | Track schema drift without crashing |
| Provider-specific fields never appear in `registrar-core` types | Adapter boundary is enforced at compile time |
| Raw provider responses are stored in `registrar_operations.provider_response_raw` | Enables debugging and replay without polluting business models |

### 15.4 Webhook DTOs

Webhook payloads follow a slightly different strategy because Dynadot may add new event fields without notice:

- Webhook DTOs use `.passthrough()` permanently (new fields are preserved in raw storage)
- Known fields are validated strictly
- Unknown fields are logged at `DEBUG` level for schema drift detection
- Raw webhook payload is always stored in `webhook_events.raw_payload` for replay
- Business logic only reads explicitly mapped fields from the handler

---

## 16. Webhook Raw Payload Security

### 16.1 Sensitive Payload Handling

Webhook payloads may contain sensitive data (contact information, order details, domain names, financial amounts). The `webhook_events.raw_payload` column requires specific protections:

| Concern | Policy |
|---------|--------|
| **Encryption at rest** | `raw_payload` MUST be stored encrypted (AES-256-GCM via application-level encryption or PostgreSQL column encryption). The encryption key is managed separately from the database credentials. |
| **Access control** | Only `ADMIN` and `SUPER_ADMIN` roles can view raw webhook payloads via the admin panel. `SUPPORT` and `FINANCE` roles see only the parsed, normalized event data. |
| **Retention period** | Raw payloads are retained for **90 days** by default (`WEBHOOK_PAYLOAD_RETENTION_DAYS` env var). A scheduled job purges expired payloads. After purge, only the parsed `webhook_events` metadata (event_id, event_type, timestamp, processing_status) is retained permanently. |
| **No raw payload logging** | Raw webhook payloads are NEVER written to application logs, stdout, stderr, or any observability pipeline (Sentry, Datadog, etc.). Only the `event_id`, `event_type`, and processing outcome are logged. |
| **Redaction from observability** | If structured logging includes webhook context, the `raw_payload` field MUST be excluded via the logging redaction rules (see ARCHITECTURE.md logging section). Allowed log fields: `event_id`, `event_type`, `timestamp`, `processing_status`, `processing_duration_ms`. |
| **Replay access** | Webhook replay is an admin-only operation. Replay requests are recorded in `audit_logs` with the admin user ID, reason, and timestamp. |

### 16.2 Known vs Unknown Fields

```typescript
// Webhook processing pipeline

// 1. Raw payload stored encrypted (before any parsing)
await webhookEventRepository.storeRawPayload(eventId, encrypt(rawBody));

// 2. Known fields validated strictly
const parsed = DynadotOrderCompletedSchema.safeParse(body.data);
if (!parsed.success) {
  // Log validation error (NOT the payload), alert, store for manual review
  logger.warn({ eventId, eventType, validationErrors: parsed.error.issues });
  return;
}

// 3. Business logic receives only validated, mapped fields
const normalizedEvent = mapDynadotOrderToInternalEvent(parsed.data);
await eventBus.publish(normalizedEvent);

// 4. Unknown fields from passthrough are NEVER forwarded to business logic
// They exist only in the encrypted raw_payload for debugging
```

### 16.3 Schema

```sql
CREATE TABLE webhook_events (
    id UUID PRIMARY KEY,
    event_id VARCHAR(100) NOT NULL UNIQUE,  -- Dynadot's event_id (dedup key)
    event_type VARCHAR(50) NOT NULL,
    provider VARCHAR(20) NOT NULL DEFAULT 'dynadot',
    received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    processed_at TIMESTAMPTZ,
    processing_status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    processing_error TEXT,
    raw_payload BYTEA NOT NULL,             -- encrypted, NOT plaintext JSONB
    raw_payload_expires_at TIMESTAMPTZ NOT NULL,  -- retention enforcement
    signature_valid BOOLEAN NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_webhook_events_dedup ON webhook_events(event_id);
CREATE INDEX idx_webhook_events_expiry ON webhook_events(raw_payload_expires_at)
    WHERE raw_payload IS NOT NULL;
```

---

## 17. Sandbox Verification Findings (2026-09-13)

> **Verification Date**: 2026-09-13
> **Environment**: `api-sandbox.dynadot.com`
> **Gate Result**: **PASSED WITH DOCUMENTED LIMITATIONS**

### 17.1 REST v2 Field Name Corrections

The documentation and sandbox responses diverge in several critical field names. These discrepancies were discovered via live sandbox probing and the facets have been corrected.

| Operation | Doc / Assumed | Actual (Sandbox-Verified) | Facet Fixed |
|-----------|---------------|---------------------------|-------------|
| Contact create/update | `phone_country_code`, `fax_country_code`, `zip_code` | `phone_cc`, `fax_cc`, `zip` | ✅ `contact.facet.ts` |
| Contact update | Partial body (changed fields only) | Full body required (all fields) | ✅ `contact.facet.ts` |
| Privacy set | `{ privacy: "full" }` | `{ privacy_level: "full" }` | ✅ `privacy.facet.ts` |
| Renew option set | `auto_renew`, `do_not_renew`, `let_expire` | `auto`, `donot`, `reset` | ✅ `renew-option.facet.ts` |
| Domain info parse | `renew_option === 'auto_renew'` | `renew_option === 'auto'` | ✅ `domain-info.facet.ts` |
| Registration body | `{ duration, currency }` | `{ domain: { duration, privacy }, currency }` | ✅ `registration.facet.ts` |
| DNS SET records | `{ record_type, value }` | `{ type, content }` | ✅ `dns.facet.ts` |
| DNS REMOVE records | `{ record_type, value }` | `{ record_type }` (no value) | ✅ `dns.facet.ts` |
| Account info | Direct `data.account_name` | Nested `data.account_info.account_name` | ✅ `account.facet.ts` |
| Pricing arrays | `register_price: number` | `all_years_register_price: string[]` | ✅ `pricing.facet.ts` |
| Renewal | `{ duration, currency }` | `{ duration, year, currency }` — `year` is required | ✅ `renewal.facet.ts` |

### 17.2 Corrected Evidence Matrix

| Capability | Method | HTTP | Evidence | Reason |
|---|---|---|---|---|
| ACCOUNT | getAccountInfo | 200 | ✅ VERIFIED | — |
| DOMAIN_SEARCH | checkAvailability | 200 | ✅ VERIFIED | — |
| DOMAIN_SEARCH | checkAvailability_avail | 200 | ✅ VERIFIED | — |
| DOMAIN_SEARCH | bulkCheckAvailability | 200 | ✅ VERIFIED | — |
| DOMAIN_SEARCH | suggestDomains | 502 | ❌ SANDBOX_FAILED_PROVIDER | "Could not find any suggestions" — HTTP 502 returned consistently for all 5 FQDN probes. Root cause unconfirmed; do not expose to customer workflows. |
| PRICING | getTldPrices | 200 | ✅ VERIFIED | 442 TLDs returned |
| DOMAIN_INFO | listDomains | 200 | ✅ VERIFIED | — |
| CONTACTS | listContacts | 200 | ✅ VERIFIED | — |
| CONTACTS | getContact | 200 | ✅ VERIFIED | — |
| NAMESERVERS | listRegisteredNs | 200 | ✅ VERIFIED | — |
| NAMESERVERS | getRegisteredNs | 200 | ✅ VERIFIED | — |
| ORDERS | getOrderHistory | 400 | 📝 DOCUMENTATION_GAP | "The value for parameter search_type is invalid" — 9 candidate values all fail. REST v2 docs list `search_type: String` without enumerating valid values. |
| DOMAIN_INFO | getDomainInfo | 200 | ✅ VERIFIED | — |
| DNS | getDnsRecords | 200 | ✅ VERIFIED | — |
| DNS | setDnsRecords | 200 | ✅ VERIFIED | Fixed: `{ type, content }` not `{ record_type, value }` |
| DNS | removeDnsRecords | 200 | ✅ VERIFIED | Fixed: `{ record_type }` only, no value field |
| DNSSEC | getDnssec | 200 | ✅ VERIFIED | — |
| TRANSFER | getTransferStatus | 400 | ⬜ NOT_APPLICABLE | No active transfers in sandbox |
| APPRAISAL | getAppraisal | 200 | ✅ VERIFIED | — |
| DOMAIN_SEARCH | powerSearch | 401 | ⚠️ UNSUPPORTED | "This API is only available for specific accounts" — documented 401 account restriction |
| ERROR_HANDLING | malformedDomain | 400 | ✅ VERIFIED | — |
| REGISTRATION | registerDomain | 200 | ✅ VERIFIED | — |
| DNS | setDnsRecords_reg | 200 | ✅ VERIFIED | — |
| DNS | getDnsRecords_verify | 200 | ✅ VERIFIED | — |
| DNS | removeDnsRecords_reg | 200 | ✅ VERIFIED | — |
| DNS | getDnsRecords_verifyRemoval | 200 | ✅ VERIFIED | — |
| CONTACTS | createContact | 200 | ✅ VERIFIED | — |
| CONTACTS | getContact_syn | 200 | ✅ VERIFIED | — |
| CONTACTS | updateContact | 200 | ✅ VERIFIED | Full body required |
| CONTACTS | getContact_verifyUpdate | 200 | ✅ VERIFIED | — |
| CONTACTS | setDomainContacts | 200 | ✅ VERIFIED | — |
| CONTACTS | verifyDomainContacts | 200 | ✅ VERIFIED | — |
| CONTACTS | restoreContacts | 200 | ✅ VERIFIED | — |
| PRIVACY | setPrivacy | 200 | ✅ VERIFIED | `privacy_level` field |
| LOCK | setDomainLock | 200 | ✅ VERIFIED | Unlock→lock→unlock cycle |
| RENEW_OPTION | setRenewOption | 200 | ✅ VERIFIED | `auto` not `auto_renew` |
| FORWARDING | setDomainForwarding | 200 | ✅ VERIFIED | — |
| FORWARDING | setStealthForwarding | 200 | ✅ VERIFIED | — |
| FORWARDING | setEmailForwarding | 400 | ❌ SANDBOX_FAILED_PROVIDER | "The type for email_forward_type is not supported" — 19 enum values probed (including documented `forward`, `mx`, `donot`), all rejected. Do not expose to customer workflows. |
| NS_CONFIG | setNameservers | 200 | ✅ VERIFIED | Single NS accepted (deduplicated) |
| RENEWAL | renewDomain | 200 | ✅ VERIFIED | Requires `year` parameter |
| DNSSEC | getDnssec_reg | 200 | ✅ VERIFIED | — |
| CONTACTS | deleteContact | 200 | ✅ VERIFIED | — |
| GRACE_DELETE | graceDelete | 200 | ✅ VERIFIED | — |

### 17.3 Evidence Summary

| Evidence | Count |
|---|---|
| SANDBOX_VERIFIED | **38** |
| SANDBOX_UNSUPPORTED | **1** (powerSearch — documented account restriction) |
| SANDBOX_NOT_APPLICABLE | **1** (getTransferStatus — no active transfers) |
| SANDBOX_FAILED_PROVIDER | **2** (suggestDomains — HTTP 502, setEmailForwarding — HTTP 400) |
| DOCUMENTATION_GAP | **1** (getOrderHistory `search_type` enum) |

### 17.3.1 Repository Checkpoint (2026-09-13)

| Metric | Count |
|---|---|
| Tests passed | **642** |
| Tests skipped | **82** |
| Tests failed | **0** |

> [!NOTE]
> Live sandbox tests are intentionally excluded from the offline suite. The evidence matrix above reflects separate live-provider verification against `api-sandbox.dynadot.com`.

### 17.4 Provider Quirks

- **Pricing sentinel**: `"--"` means "unavailable" (not zero, not error). Found on `.co.uk`, `.org.uk`, `.me.uk` (transfer/restore prices).
- **Price type**: All prices are `string`, not `number`. Arrays: `all_years_register_price: string[]`.
- **Boolean strings**: `available: "Yes"/"No"`, `has_next_page: "Yes"/"No"`.
- **DNS TTL**: Returned as string `"28800"` (not number).
- **Nameserver duplicates**: Sandbox returns `["ns1.dynadot.com", "ns1.dynadot.com"]` — inventory has one unique NS.
- **DNS SET vs REMOVE field asymmetry**: SET uses `{ type, content }`, REMOVE uses `{ record_type }`.

### 17.5 Pagination Observations

| Resource | Pagination Shape | Observed Fields |
|---|---|---|
| Domain list | `data.pagination_result` | `page`, `page_size`, `total`, `has_next_page` ("Yes"/"No") |
| Contact list | `data` direct | No pagination_result observed with small datasets |
| Nameserver list | None | Full list returned without pagination fields |
| TLD prices | `data` level | `page`, `page_size`, `sort`, `price_level`, `currency`, `show_multi_year_price` |

### 17.6 Money Normalization Evidence

The pricing facet uses `parseMoneyFromDecimal()` which operates purely on string→bigint without any floating-point intermediary:

| Provider Value | Type | → minorUnits | → meaning |
|---|---|---|---|
| `"0.38"` | string | `38n` | $0.38 |
| `"39.00"` | string | `3900n` | $39.00 |
| `"0.00"` | string | `0n` | genuinely free |
| `"--"` | string | `undefined` | unavailable (sentinel) |
| `"81.00"` | string | `8100n` | $81.00 |

No `Number`, `parseFloat`, or floating-point intermediary is used anywhere in the money pipeline.

### 17.7 Disabled Capabilities (Phase 6)

The following capabilities MUST NOT be exposed to customer workflows. They may only be re-enabled after authoritative resolution.

| Capability | Status | Evidence | Phase 6 Action |
|---|---|---|---|
| `suggestDomains` | SANDBOX_FAILED_PROVIDER | HTTP 502, 5 FQDN probes, consistent. Root cause unconfirmed. | Disabled. Standard domain search and bulk search remain enabled. |
| `setEmailForwarding` | SANDBOX_FAILED_PROVIDER | HTTP 400, 19 enum values probed (including REST v2 `forward`, `mx`, `donot`), all rejected. | Disabled. Domain forwarding and stealth forwarding remain enabled. |
| `getOrderHistory` | DOCUMENTATION_GAP | `search_type` param: 9 values probed, all rejected. REST v2 docs list `search_type: String` without enumerating valid values. | Disabled. `getOrderStatus(orderId)` (`GET /orders/{id}`) works and is sufficient. |
| `powerSearch` | SANDBOX_UNSUPPORTED | HTTP 401: "This API is only available for specific accounts." | Disabled. Standard `checkAvailability` and `bulkCheckAvailability` remain enabled. |
| `getTransferStatus` | SANDBOX_NOT_APPLICABLE | No active transfer exists in sandbox to test against. | Use cautiously; verify with first real transfer in production. |
| Other lifecycle-specific methods | NOT_VERIFIED | `restoreDomain`, `transferIn`, `cancelTransfer`, `authorizeTransferAway` — not testable without matching domain states. | Use when needed; add regression coverage on first real invocation. |
