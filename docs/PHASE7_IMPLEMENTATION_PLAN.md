# Phase 7 — Retail Pricing, Quotes & Checkout Foundation

**Status:** CORRECTED PLAN (revision 2) FOR REVIEW. Architecture is approved in principle. Implementation is not yet approved, and no implementation code has been written.
**Baseline:** `main` @ `0a76dce` (Phase 6 locked: 811 passed / 88 skipped / 0 failed, 13/13 typecheck, 3/3 build).
**Scope boundary:** ends at `PENDING_PAYMENT`. No payment gateway, no `PROCESSING` transition, no fulfillment calls.

---

## 0. Approved decisions and correction index

### 0.1 Decisions (all APPROVED)

| # | Decision | Approved scope |
|---|---|---|
| **D1** | Canonical order-item operation vocabulary is `REGISTER / RENEW / TRANSFER / RESTORE`. | A narrow **Phase 6 defect fix** in `OrderService.evaluateFulfillment()`. It is not an architecture change. See §26.2 for the regression plan. |
| **D2** | Dynadot pricing currency comes from the provider response and is authoritative. | A narrow **Phase 5 compatibility fix** in `DynadotPricingFacet`, backed by a sandbox probe and evidence. No retail or FX logic goes into `registrar-dynadot`. See §27. |
| **D3** | Customer quotes and orders support `years = 1` only. | Multi-year raw values are kept only as adapter evidence and never become customer pricing. |
| **D4** | A thin provider-neutral `DomainSearchService` handles canonicalization, availability and the premium flag. | It contains no pricing logic. See §11.6. |
| **D5** | Controllers never return raw rows. Money crosses JSON as string or structured DTOs. | Tests use non-empty orders. See §18. |

### 0.2 Correction-round index

| Correction | Section |
|---|---|
| 1 D1 approved as a defect fix, with literal classification | §26.2 |
| 2 D2 response currency authoritative, with sandbox probe | §27 |
| 3 D3 years = 1 | §11.1, §5.3 |
| 4 D4 DomainSearchService | §11.6 |
| 5 D5 DTOs | §18 |
| 6 Promotion FK insertion order | §15.2 |
| 7 Staged, atomic provider-price sync | §5 |
| 8 Price-sync lease and fencing | §5.5 |
| 9 Promotion counters | §9.4 |
| 10 Normalized promotion and tax scopes | §3, §9.1, §10 |
| 11 Rule strategy CHECKs | §8.2, §9.2 |
| 12 Executable SQL | Appendix A |
| 13 Snapshot reference FKs | §3.3 |
| 14 V1 completeness and FX consistency constraints | §12.1 |
| 15 Quote status trigger semantics | §12.2 |
| 16 Order-item allowlist trigger | §12.3 |
| 17 Tax policy mode | §10.1 |
| 18 Commerce country vs billing country | §10.2 |
| 19 Exact money display | §20.5 |
| 20 BullMQ `upsertJobScheduler` | §21 |
| 21 Quote validity vs source validity | §11.3 |
| 22 DB-authoritative quote timestamps | §11.4 |
| 23 Availability at quote vs checkout | §11.5 |
| 24 Admin sync enqueues and does not block | §5.2, §17 |
| 25 Pure CurrencyResolver | §6 |
| 26 Indicative vs authoritative price | §11.7, §17, §20 |
| 27 Future-compatible expiry-sweep predicate | §15.5 |
| 28 DRAFT promotion reservation behavior | §9.5 |

### 0.3 Repository facts relied on (verified at `0a76dce`)

- **There is no existing search rate limit.** `RateLimitService` exists only inside the auth module. Phase 7 reuses that service (exported through a small shared module) with new search, quote and promo keys. It does not write a new limiter.
- **BullMQ version mismatch.** Phase 6 schedulers use `queue.upsertJobScheduler(...)` (e.g. `retry.processor.ts`, `reconciliation.processor.ts`). `apps/api` declares `bullmq ^5.81.5`, but `apps/worker` declares `^5.34.0`. Phase 7 aligns the worker's declared range to `^5.81.5`; the resolved lockfile version is checked.
- **Dynadot documents `currency` in the response.** `DYNADOT.md` (`DOMAIN_GET_TLD_PRICE`) lists `currency` under *Result Parameters*. Request values are documented in lowercase, and the list includes non-ISO values (e.g. `btc`, `ltl`).
- **The provider error enum has no protocol or currency code.** `ProviderErrorCode` in `registrar-core` needs one additive value for D2 (§27.2).
- **An architecture-lint test already exists.** `registrar-ops/__tests__/architecture-lint.test.ts` scans business modules for forbidden imports. Phase 7 extends the same pattern.

---

## 1. Existing schema review (exact)

| Table | Current columns (abridged) | Gap for Phase 7 |
|---|---|---|
| `tlds` | `id, tld UNIQUE, is_enabled, supports_*, min/max_registration_years, is_premium_supported, timestamps` | Needs `display_order` and `last_price_sync_at`. |
| `registrar_provider_prices` | `tld_id→tlds RESTRICT, registrar_provider_id→providers RESTRICT, operation, years, provider_cost_minor NOT NULL, provider_cost_currency NOT NULL, retail_price_minor NOT NULL, retail_price_currency NOT NULL, markup_type, markup_value, is_promotion, promotion_*, last_synced_at`. `UNIQUE(tld_id, provider, operation, years)` | Mixes wholesale with retail, markup and promotions. Retail is single-currency. No CHECKs, no observed-at, no availability flag, no sync-run link. |
| `quotes` | `user_id NOT NULL, domain, operation, years, retail_amount_minor, currency, provider_cost_minor, is_premium, registrar_provider_id, expires_at, created_at` | No provider currency, FX, breakdown, status, version or rule references. |
| `orders` | `user_id, status CHECK, currency, subtotal/tax/discount/total_minor DEFAULT 0, timestamps, completed_at` | No idempotency, pricing expiry, submit/cancel timestamps or immutability. |
| `order_items` | `order_id, domain, operation, years, amount_minor, currency, is_premium, quote_id→quotes ON DELETE SET NULL, registrar_provider_id, provider_cost_minor, registrar_operation_id (Phase 6, unique partial)` | No snapshot breakdown. `quote_id` is not unique and uses `SET NULL`. |
| `user_profiles` | `country varchar(2)` | No currency preference. |
| `audit_logs`, `admin_actions`, `system_settings` | generic | Reused. |
| `payments/refunds/invoices` | — | Untouched. |

No cart entity exists or is designed, so none is added.

---

## 2. Tables and columns reused

| Existing | Phase 7 use |
|---|---|
| `tlds` | TLD catalog (+2 columns). |
| `registrar_provider_prices` | **Current observed wholesale price only.** `retail_price_*`, `markup_*` and `is_promotion/promotion_*` become nullable and deprecated, with no readers or writers. Dropping them is deferred. |
| `quotes.retail_amount_minor` | Retail after markup and rounding, before discount and tax. |
| `quotes.currency` | Customer currency. |
| `quotes.provider_cost_minor` | Wholesale amount (+ new `provider_cost_currency`). |
| `order_items.amount_minor` | Final item total. |
| `order_items.provider_cost_minor` | Wholesale snapshot. |
| `order_items.quote_id` | Quote linkage, made unique and `RESTRICT`. |
| `orders.subtotal/discount/tax/total_minor` | Bigint sums of item snapshots, verified by a deferred DB check. |
| `user_profiles.country` | V1 **commerce country** input (§10.2). |
| `audit_logs`, `admin_actions` | Audit trail. |
| `system_settings` | Tunables, including `tax.policy_mode` (§10.1). |

---

## 3. Migration `0004_phase7_pricing_checkout`

### 3.1 Conceptual schema (for reading; not SQL)

```
provider_price_sync_runs   one row per sync attempt; lease/fence fields; outcome counters
provider_price_staging     normalized rows for a run; promoted atomically after validation
fx_rates                   append-only rate snapshots per (base, quote)
pricing_rules              markup rule per scope (TLD?, operation?) with strategy + percent_bps
pricing_rule_currency_params   per-currency fixed / override / rounding increment
promotions                 promotion header, kind + percent_bps, window, limits, counter
promotion_tlds             FK scope → tlds            (empty set = all TLDs)
promotion_operations       CHECKed enum scope          (empty set = all operations)
promotion_currencies       CHECKed currency scope      (empty set = all supported currencies)
promotion_currency_amounts per-currency fixed discount / min amount / cap
promotion_redemptions      RESERVED | CONSUMED | RELEASED per order item
tax_rules                  configurable rule; no seeded rows
tax_rule_operations        CHECKed operation scope    (empty set = all operations)
quote_tax_lines            tax lines applied to a quote (FK → tax_rules)
order_item_tax_lines       copied from quote_tax_lines
quotes / orders / order_items / tlds / registrar_provider_prices / user_profiles   extended
```

### 3.2 Executable SQL

The full executable migration is in **Appendix A**. It uses PostgreSQL syntax only, with no shorthand. The Drizzle schema files (`pricing.ts`, `commerce.ts`, new `fx.ts`, `promotions.ts`, `tax.ts`, `price-sync.ts`, relations) are written to match it. The migration is hand-authored in the same style as 0003, and `_journal.json` gets entry idx 4. Verification is described in §25.

### 3.3 Snapshot-reference FKs (correction 13)

Every historical reference gets a real FK with `ON DELETE RESTRICT`. The referenced entities are **never physically deleted**: rules, promotions and tax rules are deactivated and versioned, FX rows are append-only, and price rows are upserted but never deleted.

| Column | References |
|---|---|
| `quotes.tld_id`, `order_items.tld_id` | `tlds(id)` |
| `quotes.provider_price_id`, `order_items.provider_price_id` | `registrar_provider_prices(id)` |
| `quotes.fx_rate_id`, `order_items.fx_rate_id` | `fx_rates(id)` |
| `quotes.pricing_rule_id`, `order_items.pricing_rule_id` | `pricing_rules(id)` |
| `quotes.promotion_id`, `order_items.promotion_id` | `promotions(id)` |
| `quote_tax_lines.tax_rule_id`, `order_item_tax_lines.tax_rule_id` | `tax_rules(id)` |
| `quotes.invalidated_by` | `users(id)` **RESTRICT, not SET NULL**, because a SET NULL cascade is an UPDATE that the quote immutability trigger would reject. Users are soft-deleted in this system, so RESTRICT is compatible. |
| `order_items.quote_id` | `quotes(id)`, changed from `SET NULL` to `RESTRICT` |

**No reference is left without an FK.** The mutable `registrar_provider_prices` row is referenced by id, but its values at quote time are **copied** into the quote. The copy is authoritative; the FK only proves provenance.

---

## 4. Money types and arithmetic strategy

- New package **`packages/commerce-core`**. It is pure, with no I/O, no Nest and no DB.
- Subpaths:
  - `./money`: ops and rounding
  - `./engine`: FX math, markup, promotion and tax engines, pipeline
  - `./currency`: resolver and centralized maps
  - `./normalize`: provider price normalizer
  - `./format`: exact display, with **zero imports** so it is browser-safe
- ISO exponents come from `registrar-core`'s `CURRENCY_METADATA`, imported by the server-side subpaths only. `./format` receives the exponent from the API DTO. There is no second currency table.
- **Representation:** `bigint` minor units plus an ISO code. Mixed-currency operations throw `CurrencyMismatchError`.
- **No `number` in money paths:**
  - percentages are integer **basis points**;
  - FX rates are parsed from the NUMERIC string into `{ scaled: bigint, scale: 12 }`;
  - an ESLint `no-restricted-syntax` rule in `commerce-core` bans `parseFloat`, `Number(`, `Math.round|floor|ceil` and `toFixed`.
- **One rounding primitive:** `divRoundHalfUp(n: bigint, d: bigint)`, with `n ≥ 0` and `d > 0`. Negative input throws.
- **Canonical pipeline** (fixed order, `engineVersion = 1`, `roundingPolicy = "HALF_UP_V1"`):
  1. `C = P` if the currencies are the same. Otherwise `C = divRoundHalfUp(P × rateScaled × 10^max(0, eC−eP), 10^12 × 10^max(0, eP−eC))`.
  2. Markup per strategy (§8). The percent part is `divRoundHalfUp(C × bps, 10_000)`.
  3. `retail = C + markup`. If the rule has a `rounding_increment_minor` **for the customer currency**, `retail` is rounded **up** (ceiling) to that increment, and then `markup := retail − C`.
  4. `discount ∈ [0, retail]` (§9).
  5. `taxable = retail − discount`. EXCLUSIVE tax is `Σ lines divRoundHalfUp(taxable × bps, 10_000)`. INCLUSIVE is modelled in the engine only and is not permitted by the V1 schema.
  6. `final = taxable + exclusiveTax`.
- **Bounds:** any amount above `10^15` minor units is rejected. Zero is valid.
- **Wire format:** `MoneyDto = { amountMinor: string, currency: string, exponent: number }`. The exponent is taken from server metadata.

---

## 5. Provider price ingestion: staged, atomic and fenced

### 5.1 Components

- **`ProviderPriceNormalizer`** (`commerce-core/normalize`, pure). Converts `TldPrice → NormalizedProviderPrice { tld, operation, years: 1, currency, amountMinor | null, isAvailable, observedAt, sourceReference }`.
- **`ProviderPriceSyncService`** (worker composition path, provider-neutral). Reads through `registrarResolver → DOMAIN_PRICING capability` and writes through a standalone repository, following the Phase 6 worker pattern.
- **API role:** creates a `QUEUED` run and enqueues it. The API never performs registrar pricing I/O.

### 5.2 Triggering (correction 24)

- **Admin:** `POST /api/v1/admin/pricing/provider-prices/sync`
  - inserts `provider_price_sync_runs(status='QUEUED', trigger_source='ADMIN', triggered_by=…)`;
  - then `queue.add('provider-price-sync', { runId }, { jobId: runId })`;
  - returns **202** `{ runId, status: 'QUEUED' }`.
  - The partial unique index `uq_price_sync_active` (one `QUEUED|RUNNING` per provider) makes a second request return **409** `{ code: 'SYNC_ALREADY_ACTIVE', runId }`.
- **Scheduled:** the `provider-price-sync-scheduler` job (§21) inserts a `QUEUED` run the same way and processes it.
- **Lost enqueue:** if a run stays `QUEUED` longer than 5 minutes (enqueue failed after insert), the sweeper re-enqueues it with the same `jobId`. This is idempotent.

### 5.3 Run algorithm

```
1. CLAIM      UPDATE runs SET status='RUNNING', run_token=$tok, run_version=run_version+1,
                  claimed_by=$worker, started_at=now(), heartbeat_at=now(),
                  lease_expires_at=now()+$lease
              WHERE id=$run AND status='QUEUED' RETURNING run_version
              (0 rows → another worker owns it; exit)
2. FETCH      page through provider getTldPrices(currency=$requested) — provider I/O, no DB tx held
3. STAGE      per page: normalize → INSERT INTO provider_price_staging … (fenced, §5.5)
              HEARTBEAT after each page (fenced); lost lease → abort, write nothing more
4. VALIDATE   over the complete staged set for this run (read-only):
              a. every staged currency == requested currency == run.response_currency, ISO-valid
              b. no duplicate (tld, operation, years) — enforced by staging PK; a 23505 during
                 staging is recorded as DUPLICATE_KEY and fails the run
              c. row validity: amount NULL ⇔ unavailable; 0 ≤ amount ≤ 10^15 (CHECKs)
              d. coverage: present_enabled_tlds / enabled_tlds_with_existing_price ≥ min_coverage
                 (system setting, default 0.90); REGISTER year-1 row (available or explicit
                 unavailable marker) required for each present enabled TLD
              e. zero staged rows → fail
5. PROMOTE    one short transaction (fenced, §5.5):
              upsert staged rows for KNOWN TLDs into registrar_provider_prices;
              unavailable marker → is_available=false, previous amount retained;
              update tlds.last_price_sync_at for promoted TLDs;
              run → SUCCEEDED or SUCCEEDED_WITH_WARNINGS; finished_at=now()
6. On any validation failure: run → FAILED (error_code, summary); production rows untouched.
```

### 5.4 Atomicity semantics (correction 7)

- `registrar_provider_prices` is only written in step 5, inside one transaction. There is no path that writes production rows page by page.
- **Outcomes** (there is no `PARTIAL` status):

| Status | Meaning |
|---|---|
| `SUCCEEDED` | All staged rows for known enabled TLDs were promoted atomically. Coverage is 100%. |
| `SUCCEEDED_WITH_WARNINGS` | Coverage passed the threshold but some enabled TLDs were absent from the response. The present rows were promoted atomically. **Absent TLDs keep their previous rows untouched.** Those rows age naturally and quote creation refuses them once they are past freshness (§11.2). `warnings` lists the absent TLDs. |
| `FAILED` | Nothing was promoted. Causes include currency mismatch or absence, duplicates, invalid rows, coverage below threshold, empty response, or a provider error. |
| `LEASE_EXPIRED` | Set only by the sweeper. Nothing can be promoted afterwards (§5.5). |

- **Rows that are safe to promote:** staged rows whose `tld` resolves to an existing `tlds` row. Unknown TLDs are counted (`unknown_tlds`) and never auto-created. Disabled-but-known TLDs are promoted too, so enabling them later starts from fresh data.
- Multi-year arrays (D3) are **not staged or promoted**. Raw arrays appear only in the adapter sandbox evidence fixture (§27).

### 5.5 Lease and fencing (correction 8)

Fields on `provider_price_sync_runs`: `run_token uuid`, `run_version int`, `claimed_by`, `heartbeat_at`, `lease_expires_at`. The lease defaults to 5 minutes and the heartbeat interval is at most 60 s (once per page and at least every 60 s).

| Step | Fenced SQL predicate |
|---|---|
| Heartbeat | `UPDATE runs SET heartbeat_at=now(), lease_expires_at=now()+$lease WHERE id=$run AND run_token=$tok AND status='RUNNING' AND lease_expires_at > now()`. Zero rows means the lease is lost, so the worker aborts. |
| Stage | `INSERT … SELECT … WHERE EXISTS (SELECT 1 FROM runs WHERE id=$run AND run_token=$tok AND status='RUNNING' AND lease_expires_at > now())`. Staging by a dead run is harmless, because only promotion publishes. |
| Promote | `SELECT … FROM runs WHERE id=$run AND run_token=$tok AND status='RUNNING' AND lease_expires_at > now() FOR UPDATE`. If no row comes back, the worker aborts **before** any upsert. The row lock serializes promotion against the sweeper. |
| Sweeper | `UPDATE runs SET status='LEASE_EXPIRED', finished_at=now() WHERE status='RUNNING' AND lease_expires_at < now()`. It blocks behind an in-flight promotion's row lock, so it can never interleave with one. |

Race walk-through: worker A stalls, then the sweeper marks A as `LEASE_EXPIRED`. B's `QUEUED` run can now be inserted and claimed, because A is no longer active. B promotes. A resumes, its heartbeat or promote predicate matches 0 rows, and A aborts. **A publishes nothing.**

Staging retention: rows for terminal runs are deleted after 14 days by the `pricing-staging-cleanup` scheduler (§21). Run rows are kept indefinitely.

---

## 6. Currency resolver (pure; correction 25)

`resolveCustomerCurrency(ctx) → { currency, source }` lives in `commerce-core/currency`. It performs **no I/O** and never persists anything.

| Priority | Input | `source` |
|---|---|---|
| 1 | explicit request currency (if supported) | `EXPLICIT_REQUEST` |
| 2 | `profile.preferredCurrency` (either stored source) | `ACCOUNT_PREFERENCE` |
| 2b | `COUNTRY_TO_CURRENCY[profile.country]` | `ACCOUNT_COUNTRY` |
| 3 | `pn_currency` cookie | `BROWSER_PREFERENCE` |
| 4 | trusted geo header country, **only if there is no stored preference and no cookie** | `GEO_DEFAULT` |
| 5 | `PLATFORM_DEFAULT_CURRENCY = 'USD'` | `PLATFORM_DEFAULT` |

- `SUPPORTED_CUSTOMER_CURRENCIES = ['INR','USD','GBP','EUR','CAD','AUD']`.
- `COUNTRY_TO_CURRENCY` is **the single map**: `IN→INR, US→USD, GB→GBP, CA→CAD, AU→AUD`, EU member states to EUR, and everything else to the platform default. A test fails if currency or country literal maps appear outside `commerce-core/currency`.
- The geo header is honoured only when `TRUST_GEO_HEADER=true`.
- **Persistence is the application's job.** `CurrencyPreferenceService` (API) receives the resolver result. If the user is authenticated, has no stored preference, and `source === 'GEO_DEFAULT'`, it may persist `preferred_currency_source='GEO_DEFAULT'` once. An explicit selection (`PUT /account/preferences/currency`) writes `USER_SELECTED`. Geo never overwrites `USER_SELECTED`, and a later geo change never overwrites a stored preference. This prevents currency changing while the customer travels.

---

## 7. FX abstraction, cache and storage

- **`FxProvider`** interface: `fetchRates(base, quotes[]) → FxRateSnapshot[]`. V1 uses `ManualFxProvider`, where an admin enters rates with `observed_at` and `valid_until`. There is no vendor in the repo, so none is chosen.
- **`FxService.getUsableRate(from, to, atDbNow)`**:
  - Same currency returns `IDENTITY`: no row, and all FX snapshot fields are NULL (§12.1).
  - Otherwise it returns the latest `fx_rates` row for the exact pair where `valid_until > atDbNow` **and** `atDbNow − observed_at ≤ fx.max_age` (setting, default 24h).
  - If none qualifies it throws `FxRateUnavailableError`.
  - **There is never a 1:1 fallback.** There is also no inverse derivation and no triangulation.
- `fx_rates` is **append-only**; a trigger rejects UPDATE and DELETE. Corrections are made by inserting a new row.
- Redis caches the current usable row id per pair for 60 s. Quote creation **re-reads the row by id inside the quote transaction**, so the cache never supplies the rate value.
- Direction convention: `base_currency` = provider currency and `quote_currency` = customer currency. `1 base = rate quote`.

---

## 8. Markup rule model and precedence

### 8.1 Precedence (first active match wins; no merging)

1. `tld_id = X AND operation = OP`
2. `tld_id = X AND operation IS NULL`
3. `tld_id IS NULL AND operation = OP`
4. `tld_id IS NULL AND operation IS NULL`

At most one active rule exists per scope. This is enforced by a unique expression index, using COALESCE so it does not depend on PG15's `NULLS NOT DISTINCT`.

### 8.2 Strategy constraints (correction 11)

| Strategy | DB CHECK (`chk_pricing_rules_params`) | Application validation (cross-table) |
|---|---|---|
| `PERCENT` | `percent_bps IS NOT NULL` | none |
| `FIXED` | `percent_bps IS NULL` | at least one `pricing_rule_currency_params` row with `fixed_amount_minor IS NOT NULL` |
| `MAX_FIXED_PERCENT` | `percent_bps IS NOT NULL` | at least one row with `fixed_amount_minor IS NOT NULL` |
| `RETAIL_OVERRIDE` | `percent_bps IS NULL AND tld_id IS NOT NULL AND operation IS NOT NULL` | at least one row with `override_amount_minor IS NOT NULL` |

- `pricing_rule_currency_params(rule_id, currency, fixed_amount_minor, override_amount_minor, rounding_increment_minor)` has per-column CHECKs (Appendix A). The rounding increment is **per currency**, because 100 minor units is ₹1 but $1.
- Saving a rule reports **coverage**: which supported currencies lack a required amount. That lets admins see gaps before quoting does.
- At quote time, if the winning rule lacks the amount required for the customer currency, the quote fails with `PRICING_UNAVAILABLE`. The engine **never falls through** to a lower-precedence rule, because that would silently change the price.
- **No applicable rule** means the quote fails. The system never sells at raw cost.
- **Below-cost guard:** if `retail < converted_cost` and `allow_below_cost=false`, the quote fails and a `PRICING_BELOW_COST` warning is logged.
- Rules are never deleted, only deactivated. Each edit increments `version` and writes `admin_actions` plus an `audit_logs` before/after row. Quotes store `pricing_rule_version`, and an insert trigger verifies it (§12.1).

---

## 9. Promotion model

### 9.1 Structure (correction 10)

- `promotions` is the header.
- Scope lives in normalized tables:
  - `promotion_tlds (promotion_id FK, tld_id FK→tlds RESTRICT)`
  - `promotion_operations (promotion_id FK, operation CHECK IN canonical set)`
  - `promotion_currencies (promotion_id FK, currency CHECK ISO format)`
- **An empty scope table means "no restriction" for that dimension.** Every scope table is indexed for filtering.
- Per-currency amounts are in `promotion_currency_amounts (fixed_discount_minor, min_amount_minor, max_discount_minor)`.
- **Code-based** promotions have a `code` (canonical is uppercase and trimmed, CHECKed). **Automatic** promotions have `code IS NULL`.

### 9.2 Kind constraints (correction 11)

| Kind | DB CHECK | Application validation |
|---|---|---|
| `PERCENT` | `percent_bps IS NOT NULL AND percent_bps BETWEEN 1 AND 10000` | `max_discount_minor` optional per currency |
| `FIXED` | `percent_bps IS NULL` | `fixed_discount_minor` required for every currency in `promotion_currencies`. If that scope is empty, it is required for every supported currency the promo may serve. `max_discount_minor` must be NULL. |

At evaluation time, a FIXED promo with no amount for the customer currency is simply **inapplicable**, and it never throws.

### 9.3 Evaluation

- One promotion per item in V1.
- A valid entered code wins. Otherwise the best automatic promo applies: highest discount, then lower `priority`, then `id`.
- `discount = min(computed, retail)` (clamped).
- `PERCENT` discounts are capped by `max_discount_minor[currency]` when present.
- `min_amount_minor[currency]` is compared against `retail`.
- Unknown and expired codes return an identical `PROMO_CODE_INVALID`, and promo attempts are rate-limited per user.

### 9.4 Redemption counter (correction 9)

`promotions.redemption_count` ≡ **count of redemptions in `RESERVED` or `CONSUMED`**. It is maintained **by database triggers**, so no application path can forget to update it.

| Event | Effect on counter | Mechanism |
|---|---|---|
| INSERT redemption (must be `RESERVED`) | +1, conditional | AFTER INSERT trigger increments. `chk_promotions_within_limit (usage_limit IS NULL OR redemption_count <= usage_limit)` rejects an over-limit increment with 23514, which is mapped to `PROMOTION_NO_LONGER_VALID`. |
| `RESERVED → CONSUMED` | unchanged | Allowed transition; no counter change. Set by the future payment phase. |
| `RESERVED → RELEASED` | −1, exactly once | AFTER UPDATE trigger decrements only when `OLD.status='RESERVED' AND NEW.status='RELEASED'`. `chk_promotions_count_nonneg` makes drift below zero fail loudly. |
| Repeated release | none | Release SQL is `… WHERE status='RESERVED'`, so it matches 0 rows. The BEFORE UPDATE trigger also forbids any transition out of `RELEASED`. |
| `CONSUMED → *`, `RELEASED → *`, DELETE | rejected | BEFORE UPDATE/DELETE guard. Refund semantics belong to a later phase. |
| Failed transaction | none | Trigger effects roll back with the transaction. |

- **Per-user limit:** under the promotion row lock taken in checkout (§15.2), count the user's non-`RELEASED` redemptions before inserting.
- **Integrity check:**
  - `GET /admin/promotions/integrity` (PROMOTIONS_READ) runs a `LEFT JOIN … GROUP BY … HAVING redemption_count <> count(non-RELEASED)` query.
  - The freshness monitor job runs the same query every 15 min and emits `promotion_counter_mismatch` (error log and metric).
  - Repair is **manual only**: `POST /admin/promotions/:id/recount` (PROMOTIONS_MANAGE) recomputes under a row lock and is audited with before/after values. The counter is never auto-healed silently.

### 9.5 DRAFT reservation behavior (correction 28)

These rules are documented for customers, support and admins, and each is tested:

1. Quote → DRAFT order: the quote becomes `CONSUMED`, and the promo gets a `RESERVED` redemption (+1).
2. Customer cancels the DRAFT: the redemption becomes `RELEASED` (−1) and the order becomes `CANCELLED`.
3. The pricing-expiry sweep releases the reservation the same way.
4. **The original quote cannot be reused.** `CONSUMED` is terminal, and `uq_order_items_quote` would block reuse anyway.
5. To try again the customer must **re-quote**, which evaluates current promo validity and limits.
6. The admin order view shows "quote consumed by order X (cancelled)" and "promotion reservation released at T", so support can explain why the old quote is gone.

---

## 10. Tax abstraction

### 10.1 Explicit tax policy mode (correction 17)

`system_settings['tax.policy_mode']` takes one of two values:

| Mode | Behavior |
|---|---|
| `DISABLED` | The tax engine is intentionally not applied. Quotes carry `tax_mode='DISABLED'`, `tax_treatment='NONE'`, `tax_minor=0` and no tax lines. The snapshot records the mode. |
| `ENFORCED` | A commerce country is required. At least one active, effective `tax_rules` row matching `(country[, region], operation)` is required. If none matches, quote creation fails with `TAX_CONFIGURATION_UNAVAILABLE`. A 0% outcome is only possible through an **explicit** 0% rule entered by an admin. |

- **Setting absent** means **quote creation fails** with `TAX_POLICY_NOT_CONFIGURED`. A missing configuration is never treated as 0%.
- The migration seeds **no** mode and **no** rates. The dev seed script sets `DISABLED` explicitly, with a comment that this is a development choice.
- Mode changes go through `PUT /admin/tax/policy` (TAX_MANAGE) and are audited in `admin_actions` and `audit_logs`, including before/after values. The current mode is shown on the admin dashboard.
- **No GST, VAT or legal claims are made, and no rates are seeded.** This is configuration safety, not tax advice.
- **V1 treatment:** only `EXCLUSIVE` rules can be saved (`TAX_TREATMENT_NOT_ENABLED` otherwise). The V1 schema permits `tax_treatment IN ('NONE','EXCLUSIVE')` on quotes and items. INCLUSIVE exists in the engine only and requires a new `pricing_version`.
- Rule scope uses the normalized `tax_rule_operations` table (empty means all operations). `customer_type` is a CHECKed column. A region-specific rule beats a country-wide rule for the same `tax_code`, and distinct codes produce distinct lines.

### 10.2 Commerce country vs billing country (correction 18)

- V1 input is `user_profiles.country`, documented as the **account profile country used as the V1 commerce country**. It is not guaranteed to be the billing country. Registrant/account country and a future payment billing address may differ.
- Quotes snapshot what was used:
  - `tax_country`, `tax_region`
  - `commerce_country_source = 'ACCOUNT_PROFILE_COUNTRY'` (CHECKed enum, extensible later to `BILLING_ADDRESS`)
- The engine takes a `TaxContext.country` argument and never reads profiles itself. The payment or billing phase can therefore supply a distinct billing address by adding a source value, with no schema redesign.
- If `ENFORCED` and the profile country is missing, the quote returns `409 COMMERCE_COUNTRY_REQUIRED` and the UI prompts the customer to complete their profile. **Geo IP is never used for tax.**

---

## 11. PriceQuote: schema, TTL, validity, timestamps, availability

### 11.1 Schema mapping

| Concept | Column |
|---|---|
| owner / domain / operation / years / provider | existing `user_id, domain, operation, years, registrar_provider_id` (V1: `years = 1`, `operation = 'REGISTER'` for checkout) |
| provider price | `provider_price_id`, `provider_cost_minor`, `provider_cost_currency`, `provider_price_observed_at` |
| customer currency | `currency`, `currency_source` |
| FX | `fx_rate_id`, `fx_rate`, `fx_source`, `fx_observed_at` (all NULL for identity) |
| converted cost | `converted_cost_minor` |
| retail / markup | `retail_amount_minor`, `markup_minor`, `pricing_rule_id`, `pricing_rule_version` |
| discount | `discount_minor`, `promotion_id`, `promotion_version`, `promo_code_entered` |
| tax | `tax_mode`, `tax_treatment`, `tax_minor`, `tax_country`, `tax_region`, `commerce_country_source`, plus `quote_tax_lines` |
| final | `final_amount_minor` |
| availability | `availability_observed_at`, `availability_source` (`LIVE`/`CACHE`) |
| explanation | `calculation_snapshot jsonb`, `engine_version` |
| lifecycle | `status`, `consumed_at`, `invalidated_at`, `invalidated_by`, `invalidation_reason`, `created_at`, `expires_at`, `pricing_version` |

Quotes require authentication (`user_id NOT NULL`).

### 11.2 TTL and freshness at creation

- `ttl = system_settings['pricing.quote_ttl_seconds']`, default 900 and clamped to 60–3600.
- **Source freshness is evaluated at creation only, against the transaction's DB `now()`:**
  - the provider price is `is_available` and `now() − observed_at ≤ pricing.provider_price_max_age` (default 48h);
  - the FX row is usable (§7);
  - the rule is applicable and has the currency parameters it needs;
  - the promo is valid, if one was entered;
  - the tax policy is satisfiable.
- Any failure returns a customer-safe code and no quote is created.

### 11.3 Validity policy (correction 21): explicit decision

**An issued quote's immutable price remains valid until its own `expires_at`, unless an authorized admin explicitly INVALIDATES it.** After issue, the following do **not** shorten or void it:

- the FX row's `valid_until` passing;
- the provider price aging past the freshness threshold;
- pricing rule, promo or tax configuration changes.

`expires_at = created_at + ttl`, with **no** `min()` against source validity. Justification: the TTL (≤ 1h) is far shorter than FX max age (24h) and price max age (48h), so the exposure is bounded by the TTL.

Tested: create a quote, expire the FX row, advance price age, edit the rule, and verify the quote is still valid and can still be checked out before `expires_at`.

### 11.4 DB-authoritative timestamps (correction 22)

The quote transaction runs at `REPEATABLE READ`. Its first statement is `SELECT now() AS tx_now`; in PostgreSQL, `now()` is constant for the transaction. That single `tx_now` is used for:

- freshness checks;
- `calculation_snapshot.quotedAt`;
- `created_at` (set explicitly to `tx_now`, which also equals the default);
- `expires_at = tx_now + ttl`.

The quote INSERT trigger enforces `NEW.created_at = now()`, `NEW.expires_at > now()`, and `(calculation_snapshot->>'quotedAt')::timestamptz = NEW.created_at`. No application-host timestamp enters the quote, so the audit explanation cannot contain conflicting times.

### 11.5 Availability at quote vs checkout (correction 23)

- **Quote creation requires an availability check.** It calls `DomainSearchService.check(fqdn, { maxCacheAgeSeconds: 30 })` **before** the quote transaction opens, so provider I/O never runs inside a DB transaction. The result (`available`, `premium`, `observedAt`, `source`) is snapshotted. Unavailable returns `DOMAIN_UNAVAILABLE`; premium returns `PREMIUM_NOT_SUPPORTED`.
- **A quote is pricing plus observed availability, not a reservation.**
- **Order creation makes no provider calls** at all: no availability re-check inside the locked checkout transaction and no registration.
- Phase 6 remains authoritative at fulfillment, including its FQDN-conflict guard and failure handling.

### 11.6 DomainSearchService (D4)

- Location: `apps/api/src/modules/domain-search/`.
- Pipeline: **canonicalize** (reuses Phase 6 `FqdnService.canonicalize`, the only permitted import from `registrar-ops`, so search and fulfillment agree on the canonical form) → **availability and premium** via the provider `DomainSearchCapability` through the registrar resolver → **safe result** `{ fqdn, tld, available, premium, observedAt, source }`.
- It contains **no** markup, FX, promotion or tax code. The architecture-lint test forbids `commerce-core/engine` imports in this module.
- Redis cache: key `search:v1:{fqdn}`, TTL 60 s. Callers pass `maxCacheAgeSeconds` (public search 60, quote 30).
- Rate limits (via the reused `RateLimitService`): per IP 30/min on public search, per user 20/min on quotes.
- Provider errors or an open circuit return `SEARCH_TEMPORARILY_UNAVAILABLE`, with no guessing.
- Unsupported or disabled TLD returns `TLD_NOT_SUPPORTED`.

### 11.7 Indicative vs authoritative (correction 26)

| Surface | Nature | Marker |
|---|---|---|
| `GET /pricing/tlds`, `GET /domain-search` price, UI catalog and search rows | **Indicative** retail display, not guaranteed | DTO `priceType: 'INDICATIVE'`; UI copy "Indicative price · confirmed at checkout" |
| `POST /quotes` / `GET /quotes/:id` | **Authoritative**, frozen until `expiresAt` or invalidation | DTO `priceType: 'QUOTE'` |
| `POST /orders` | **Consumes** the frozen quote | Order DTO references quote ids |

Search and catalog responses combine `DomainSearchService` output with `PricingService.indicative()` at the **controller or application layer only**.

---

## 12. Immutability and trigger semantics

### 12.1 V1 completeness and FX consistency (correction 14)

The full SQL is in Appendix A. A CHECK expression that evaluates to NULL **passes**, so every nullable column used in these constraints is guarded with an explicit `IS NOT NULL`.

**`chk_quotes_v1_complete`** (for `pricing_version = 1`) requires:

- `operation` canonical, `years = 1`, `is_premium = false`, `domain = lower(domain)`;
- `tld_id`, `provider_price_id` and `provider_price_observed_at` present;
- `provider_cost_minor ≥ 0`, and both `provider_cost_currency` and `currency` are 3 uppercase letters;
- `converted_cost_minor ≥ 0`, `markup_minor` present, and `retail_amount_minor = converted_cost_minor + markup_minor ≥ 0`;
- `0 ≤ discount_minor ≤ retail_amount_minor`, `tax_minor ≥ 0`;
- `tax_mode` ∈ {DISABLED, ENFORCED} and `tax_treatment` ∈ {NONE, EXCLUSIVE}, with the mode/treatment coupling (DISABLED ⇒ NONE and 0; ENFORCED ⇒ EXCLUSIVE and country present);
- `final_amount_minor = retail − discount + (EXCLUSIVE ? tax : 0) ≥ 0`;
- `pricing_rule_id` and `pricing_rule_version` present;
- promotion id and version both NULL (with `discount = 0`) or both present;
- availability, currency-source and commerce-country-source fields present;
- snapshot is a JSON object, and `engine_version` is present.

`user_id` and `registrar_provider_id` are already NOT NULL.

**`chk_quotes_v1_fx`** covers two cases:

- **Same currency:** `fx_rate_id`, `fx_rate`, `fx_source` and `fx_observed_at` are all NULL, **and** `converted_cost_minor = provider_cost_minor`.
- **Different currency:** all four are NOT NULL and `fx_rate > 0`.

**Insert-time cross-table checks** (trigger `quotes_validate_insert`):

- the referenced `fx_rates` row has `base = provider_cost_currency`, `quote = currency`, and `rate`, `source` and `observed_at` equal to the copied values;
- the referenced price row matches tld, provider, operation, years, currency, amount and observed_at;
- the rule and promo `version` columns equal the copied versions;
- `created_at = now()`, `expires_at > now()`, `status = 'ACTIVE'`;
- `pricing_version = 1` (new legacy quotes are impossible).

**`chk_order_items_v1_complete` and `chk_order_items_v1_fx`** apply the same completeness rules, plus:

- `quote_id` and `quote_pricing_version` present, with `quote_pricing_version = pricing_version`;
- `amount_minor` = final.

The BEFORE INSERT trigger additionally requires **every snapshot column to equal its quote's value**, the quote to be `ACTIVE`, unexpired, and owned by the order's user, and the order to be a V1 `DRAFT`.

**Deferred integrity** uses `CONSTRAINT TRIGGER … DEFERRABLE INITIALLY DEFERRED`, which are assertions and not FKs:

- quote: `tax_minor = Σ quote_tax_lines`, with ENFORCED ⇒ ≥ 1 line and DISABLED ⇒ 0 lines;
- order: ≥ 1 item, a single currency, `subtotal = Σ retail`, `discount = Σ discount`, `tax = Σ tax`, `total = Σ amount_minor`, and `total = subtotal − discount + tax`;
- order item: its quote is `CONSUMED` at commit, and `tax_minor = Σ order_item_tax_lines`.

### 12.2 Quote status trigger (correction 15)

`quotes_guard_update` (BEFORE UPDATE):

1. `OLD.pricing_version = 0` (legacy): **reject all updates**. Legacy rows are read-only.
2. Allowlist: only `status`, `consumed_at`, `invalidated_at`, `invalidated_by` and `invalidation_reason` may differ. It compares `to_jsonb(NEW) − allowlist` with `to_jsonb(OLD) − allowlist`, so **any** monetary or snapshot change, and any future column not in the allowlist, is rejected (`P7001`).
3. If `status` changes, only `ACTIVE→CONSUMED` and `ACTIVE→INVALIDATED` are allowed. `CONSUMED→ACTIVE`, `INVALIDATED→ACTIVE`, `CONSUMED→INVALIDATED` and `INVALIDATED→CONSUMED` are rejected (`P7002`).
4. If `status` is unchanged, the lifecycle fields must also be unchanged. Once set, `consumed_at` and `invalidated_*` are immutable.

Row CHECK `chk_quotes_status`:

| Status | `consumed_at` | `invalidated_at`, `invalidated_by`, `invalidation_reason` |
|---|---|---|
| `ACTIVE` | NULL | all NULL |
| `CONSUMED` | NOT NULL | all NULL |
| `INVALIDATED` | **NULL** | all NOT NULL |

`quotes_guard_delete` rejects DELETE of V1 quotes.

### 12.3 Order-item trigger preserving Phase 6 writes (correction 16)

`order_items_guard_update` (BEFORE UPDATE), for `pricing_version ≥ 1` only:

- **Explicit mutable allowlist:** `registrar_operation_id`. This is the Phase 6 fulfillment link, and it also covers the Phase 6 FK `ON DELETE SET NULL` cascade.
- Every other column is immutable (`P7005`) through the `to_jsonb(NEW) − allowlist` comparison.
- Legacy rows (`pricing_version = 0`, e.g. Phase 6 fixtures) are unaffected.
- **Column classification test:** a test enumerates `information_schema.columns` for `order_items` and asserts that every column is listed either in `ORDER_ITEM_IMMUTABLE_COLUMNS` or in the trigger allowlist. A future phase that adds a lifecycle column must therefore classify it deliberately and extend the allowlist in its own migration. A column is never silently blocked, and pricing is never silently made mutable.
- `order_item_tax_lines`: UPDATE and DELETE are rejected. DELETE of V1 items is rejected.

### 12.4 Orders trigger

`orders_guard_update`, for `pricing_version ≥ 1` only:

- **Mutable allowlist:** `status, updated_at, completed_at, submitted_at, cancelled_at, cancellation_reason`. Everything else is immutable, including all amounts, currency, user, idempotency fields and `pricing_expires_at`.
- `status` changes must follow the **documented** order state machine (`ORDER_STATE_MACHINE.md §1.1`) exactly. The DB permits `PENDING_PAYMENT→PROCESSING`, because the payment phase needs it. Phase 7's guarantee that it never performs that transition is enforced at the application layer (§26.1).
- Legacy (`pricing_version = 0`) orders are unaffected, so Phase 6 fixtures and behavior are unchanged.

### 12.5 Immutability rules summary

- There are no application UPDATE paths on pricing columns.
- Changes to provider price, FX, rules, promos or tax affect only **new** quotes.
- Expired quotes are never re-priced; a new `POST /quotes` is required.
- Admin invalidation never edits amounts.

---

## 13. Quote and order idempotency

- **`POST /orders`** requires an `Idempotency-Key` header (UUID, one per checkout attempt, reused by the client on retries).
  - Stored as `orders.checkout_idempotency_key`, with `UNIQUE (user_id, checkout_idempotency_key)`.
  - `checkout_request_hash = sha256(canonical JSON of sorted quoteIds)`.
  - Same key and same hash returns the existing order (200).
  - Same key with a different hash returns `409 IDEMPOTENCY_KEY_REUSED`.
  - On an insert race, the loser catches 23505 on `uq_orders_checkout_idem`, rolls back, re-reads, and returns the winner.
- **Quote single use:** `uq_order_items_quote` plus `status=CONSUMED`.
- **Submit** is a conditional update `WHERE status='DRAFT'`. If the order is already `PENDING_PAYMENT`, the call returns 200 with the current state.
- **Quote creation** accepts an optional `Idempotency-Key`, deduplicated for 60 s in Redis. This is a convenience only.

---

## 14. Multi-item order design

- `POST /orders { quoteIds: string[1..20] }`.
- One currency per order. A mixed-currency request returns `422 CURRENCY_MISMATCH`, and the order-level deferred check enforces it too.
- No duplicate `(lower(domain), operation)` within an order (unique index).
- Totals are computed in bigint from item snapshots and verified at commit by a deferred constraint trigger.
- **All or nothing:** any invalid quote fails the whole request, and the response lists the offending `quoteIds`.
- `orders.pricing_expires_at = min(quote.expires_at)`.

---

## 15. Transaction boundaries

### 15.1 TQ: create quote

1. Before the transaction: validate the strict request schema, then call `DomainSearchService.check()` (provider I/O).
2. `BEGIN ISOLATION LEVEL REPEATABLE READ`.
3. `SELECT now()` to get `tx_now`.
4. Load TLD, profile (commerce country, preference), price row, FX row, rule (with currency params), promo (with scopes and amounts), tax policy and tax rules.
5. Check freshness against `tx_now`.
6. Run the pure engine with `quotedAt = tx_now`.
7. Insert the quote (trigger validations fire), insert `quote_tax_lines`, and insert `audit_logs QUOTE_CREATED`.
8. `COMMIT`. The deferred tax-sum check runs at commit.

### 15.2 TO: create order (corrections 6 and 28)

This is one transaction at `READ COMMITTED` with explicit row locks. The steps run in this order, so every FK target exists before it is referenced. **No FK is made DEFERRABLE.**

1. Idempotency lookup: `SELECT id, checkout_request_hash FROM orders WHERE user_id=$u AND checkout_idempotency_key=$k`. If a row is found, return it, or return 409 on a hash mismatch.
2. Lock quotes: `SELECT … FROM quotes WHERE id = ANY($ids) ORDER BY id FOR UPDATE`.
3. Validate each quote:
   - owned by `$u`, `status='ACTIVE'`, `expires_at > now()`, `pricing_version = 1`;
   - `operation = 'REGISTER'`, `years = 1`;
   - one currency across all quotes, and no duplicate domain.
4. Lock applicable promotions: `SELECT … FROM promotions WHERE id = ANY($promoIds) ORDER BY id FOR UPDATE`.
5. Revalidate each promotion:
   - `is_active`, within its window at `now()`, version equals the quote's `promotion_version`;
   - per-user count of non-`RELEASED` rows + k ≤ `per_user_limit`;
   - `redemption_count` + k ≤ `usage_limit`, where k is the number of items in this order using the promo.
   - Failure returns `PROMOTION_NO_LONGER_VALID` and rolls back.
6. Pre-generate UUIDs in the app for the order and its items.
7. `INSERT orders` (DRAFT, v1, totals, currency, `pricing_expires_at`, idempotency key and hash). A 23505 here means an idempotency race: roll back and re-read.
8. `INSERT order_items`, copying each quote. The BEFORE INSERT trigger verifies equality with the quote.
9. `INSERT order_item_tax_lines`, copied from `quote_tax_lines`.
10. `INSERT promotion_redemptions` with status `RESERVED`, one per discounted item. The AFTER INSERT trigger performs the conditional counter increment; the CHECK is the backstop against a concurrent overshoot.
11. `UPDATE quotes SET status='CONSUMED', consumed_at=now() WHERE id = ANY($ids) AND status='ACTIVE'`. The affected row count must equal `|ids|`; otherwise raise and roll back.
12. `INSERT audit_logs`: `ORDER_CREATED`, one `QUOTE_CONSUMED` per quote, and `PROMOTION_RESERVED`.
13. `COMMIT`. Deferred assertions run here: order totals, items' quotes `CONSUMED`, and tax-line sums.

A real-PostgreSQL test runs the whole transaction and asserts that every row exists after commit (§24).

### 15.3 TS: submit

`UPDATE orders SET status='PENDING_PAYMENT', submitted_at=now() WHERE id=$id AND user_id=$u AND status='DRAFT' AND pricing_expires_at > now() RETURNING *`, plus `audit_logs`.

If zero rows are updated, the order is re-read to return the correct error. No payment rows are created.

### 15.4 TC: cancel (customer, or sweep)

1. `UPDATE orders SET status='CANCELLED', cancelled_at=now(), cancellation_reason=$r WHERE id=$id AND status IN ('DRAFT','PENDING_PAYMENT') AND <expiry predicate, §15.5>`.
2. `UPDATE promotion_redemptions SET status='RELEASED', released_at=now() WHERE order_id=$id AND status='RESERVED'`. The trigger decrements the counter once per row.
3. `audit_logs`.

### 15.5 Expiry and cancel predicate (correction 27)

- The predicate is defined in exactly one place: `OrderExpiryPolicy.cancellableWithoutPaymentConflictSql()`.
- **Phase 7 definition:** `NOT EXISTS (SELECT 1 FROM payments p WHERE p.order_id = orders.id)`. This is sufficient because Phase 7 creates no payment rows.
- **Documented obligation for the payment phase:** it must **replace** this predicate with an active-payment-aware policy. For example, block expiry only while a payment is in `CREATED|PENDING|PROCESSING|SUCCEEDED`, so historical `FAILED|EXPIRED|CANCELLED` attempts do not pin an order forever.
- A code comment and `ORDER_STATE_MACHINE.md` note record the replacement point, and a test names it.
- Timing: `DRAFT` expires at `pricing_expires_at`. `PENDING_PAYMENT` expires at `pricing_expires_at + checkout.pending_payment_grace_seconds` (default 1800).

### 15.6 Price sync

See §5.3–5.5: short fenced statements, one atomic promote transaction, and no production writes before validation.

---

## 16. Concurrency strategy

| Race | Mechanism |
|---|---|
| Double-click or two tabs on checkout | Idempotency unique index. The loser re-reads. |
| One quote in two orders | `FOR UPDATE` on quotes, the `status='ACTIVE'` recheck, and `uq_order_items_quote` as a backstop. |
| Quote expires mid-checkout | `expires_at > now()` is checked after the lock, and again by the item insert trigger. |
| Promo global limit | Promotion row lock, then the trigger increment with the `redemption_count <= usage_limit` CHECK. |
| Promo per-user limit | Counted under the promotion row lock. |
| Release twice | `WHERE status='RESERVED'` together with the transition guard. |
| Submit vs sweep | Both are conditional updates on status; exactly one wins. |
| Two sync runs | `uq_price_sync_active`. |
| Stale sync worker | Lease and token fencing with a `FOR UPDATE` promote (§5.5). |
| Deadlocks | Fixed lock order (quotes by id, then promotions by id), with one retry on `40P01`. |

All concurrency tests use real parallel PostgreSQL transactions (`TEST_DATABASE_URL`), following the Phase 6 integration-test pattern.

---

## 17. API endpoints

The global prefix is `api/v1`. Customer routes use `AuthGuard`. Admin routes use `AuthGuard, RolesGuard, PermissionGuard` with `@RequirePermission`. Request schemas are strict Zod schemas in `@prisnames/contracts/commerce`: **unknown keys are rejected with 400**, so money fields cannot be injected.

**Public (rate-limited):**
- `GET /pricing/tlds?currency=`: indicative retail catalog (year 1: register, renew and transfer), cached 5 min per currency.
- `GET /pricing/currencies`: supported currencies and the resolved default.
- `GET /domain-search?q=`: availability, premium flag and indicative price (`priceType: 'INDICATIVE'`).

**Customer:**
- `POST /quotes` `{ domain, operation, years, promoCode?, currency? }`
- `GET /quotes/:id`
- `POST /orders` `{ quoteIds }` + `Idempotency-Key`
- `POST /orders/:id/submit` (`DRAFT → PENDING_PAYMENT` only)
- `POST /orders/:id/cancel`
- `GET /orders`, `GET /orders/:id` (DTOs, D5)
- `PUT /account/preferences/currency`

**Admin:**
- `GET /admin/pricing/tlds`, `PATCH /admin/pricing/tlds/:id`
- `GET /admin/pricing/provider-prices`
- `POST /admin/pricing/provider-prices/sync` returns **202** `{ runId }` (enqueue only)
- `GET /admin/pricing/sync-runs`, `GET /admin/pricing/sync-runs/:id`
- `GET|POST|PATCH /admin/pricing/rules`, `POST /admin/pricing/rules/:id/deactivate`, `POST /admin/pricing/preview`
- `GET|POST|PATCH /admin/promotions`, `POST /admin/promotions/:id/deactivate`, `GET /admin/promotions/:id/redemptions`, `GET /admin/promotions/integrity`, `POST /admin/promotions/:id/recount`
- `GET /admin/tax/policy`, `PUT /admin/tax/policy`, `GET|POST|PATCH /admin/tax-rules`, `POST /admin/tax-rules/:id/deactivate`
- `GET /admin/fx/rates`, `POST /admin/fx/rates`
- `GET /admin/quotes`, `GET /admin/quotes/:id`, `POST /admin/quotes/:id/invalidate`
- `GET /admin/orders/:id/pricing`

There are **no DELETE endpoints** for rules, promotions, tax rules or FX rates.

---

## 18. DTO exposure rules (D5)

- **No controller returns a Drizzle or database row.** Every response goes through an explicit allowlist mapper: `toCustomerQuoteDto`, `toCustomerOrderDto`, `toCustomerOrderListDto`, `toPublicCatalogDto`, `toAdminQuoteDto`, `toAdminOrderPricingDto`, `toAdminSyncRunDto`.
- The existing `GET /orders` and `GET /orders/:id` (customer and admin) are replaced to use these mappers.
- All money uses `MoneyDto { amountMinor: string, currency, exponent }`. No `bigint` reaches `JSON.stringify`.
- **An architecture test** scans controller return statements, via a type-level check plus a runtime test that every endpoint response is JSON-serializable with a **non-empty** fixture.
- **Customer DTOs contain:** domain, operation, years, currency, retail, discount (promo `displayName` only), tax lines (`displayName`, amount), final, `expiresAt`, `serverNow`, `status`, `priceType`.
- **Customer DTOs never contain:** provider cost or currency, converted cost, markup, FX fields, rule/promo/tax-rule ids or versions, rates in bps, `calculation_snapshot`, provider ids or names, sync data, raw payloads, or provider errors.
- **Admin DTOs** add wholesale, FX, markup, references and the snapshot. Wholesale fields additionally require `PRICING_READ`, checked in the mapper.
- **Denylist test:** serializes every customer and public endpoint with fully populated, **non-empty** fixtures, including a multi-item order, and asserts that the forbidden keys and substrings are absent.

---

## 19. Admin permissions

These are added to `contracts/src/permissions` using the existing application-level mapping:

| Permission | Value |
|---|---|
| `PRICING_READ` | `pricing:read` |
| `PRICING_MANAGE` | `pricing:manage` (rules, TLD catalog, sync trigger, FX entry) |
| `PROMOTIONS_READ` | `promotions:read` |
| `PROMOTIONS_MANAGE` | `promotions:manage` |
| `TAX_READ` | `tax:read` |
| `TAX_MANAGE` | `tax:manage` (includes the policy mode) |
| `QUOTES_READ` | `quotes:read` |
| `QUOTES_MANAGE` | `quotes:manage` (invalidate) |

| Role | Added |
|---|---|
| ADMIN | all eight |
| FINANCE | PRICING_READ, PROMOTIONS_READ, PROMOTIONS_MANAGE, TAX_READ, TAX_MANAGE, QUOTES_READ (+ existing ORDERS_READ_ALL) |
| SUPPORT | QUOTES_READ (without wholesale fields) |
| SUPER_ADMIN | implicit override (unchanged) |

Every mutation writes `admin_actions` and `audit_logs`.

---

## 20. Frontend screens and flows

These follow the `apps/web` App Router structure, the `@prisnames/ui` components and the CSS-variable tokens. There is no payment UI.

### 20.1 Public pages

- **`/domains`**: search, then rows with availability and an **indicative** price, then "Select". The selection is held in client state plus `sessionStorage`; there is no durable cart.
- **`/pricing`**: indicative TLD table.
- **Header currency selector:** sets the cookie, and for logged-in users also calls the preference API.

### 20.2 Checkout (`/checkout`)

1. **Review.** Selected domains are quoted in parallel. Each line shows retail, discount, tax lines and final, with a promo field that re-quotes. The page prompts for profile country when the tax mode requires it.
2. **Expiry indicator.** The countdown is computed from `expiresAt − serverNow` plus the client offset, and is informational only. At zero, the lines are marked expired and **"Get new prices"** re-quotes.
3. **Price-change confirmation.** If a new quote differs from the old one, both are shown and the customer must confirm the new price.
4. **Confirm.** `POST /orders` with a stable Idempotency-Key, then submit.
5. **Order placed (`PENDING_PAYMENT`).** Summary plus "Awaiting payment. Online payment is not yet available." There is no pay button and no wording that implies payment happened.

### 20.3 Dashboard

- **`/dashboard/orders`**: list and detail, with the breakdown.
- **Cancel** is available for DRAFT and PENDING_PAYMENT orders.
- A cancelled order shows "Prices from this order can't be reused. Get a new quote to try again." (§9.5).

### 20.4 Admin

`/admin/tlds`, `/admin/pricing` (prices and freshness, sync runs, sync button, rules, preview), `/admin/promotions` (with an integrity panel), `/admin/tax` (policy mode and rules), `/admin/fx`, and `/admin/orders/[id]` (breakdown).

### 20.5 Exact money display (correction 19)

`formatMoneyExact(money: MoneyDto, locale): string` lives in `commerce-core/format`. It is pure and has zero imports.

1. Validate `amountMinor` against `/^-?\d+$/` and check that `exponent` is between 0 and 4.
2. **String arithmetic only:** split off the sign, left-pad to `exponent + 1` digits, then slice into `intDigits` and `fracDigits`. BigInt is never converted to `Number`.
3. **Layout template from Intl, using a constant sample only.** Call `new Intl.NumberFormat(locale, { style: 'currency', currency, minimumFractionDigits: exponent, maximumFractionDigits: exponent }).formatToParts(SAMPLE)` with `SAMPLE = 1234567.891` (and `-SAMPLE` for the sign layout). From the parts, derive:
   - currency symbol text and position (prefix or suffix, including spacing literals);
   - group separator, decimal separator and minus sign;
   - **grouping sizes**, from the observed `integer` part lengths. For example, `en-IN` gives `12,34,567`, so primary 3 and secondary 2; `en-US` gives 3 and 3.
   The **monetary value never passes through Intl or IEEE-754**. Only the fixed layout sample does.
4. Group `intDigits` with the derived sizes, then assemble using the template's part order, substituting our own integer, group, decimal and fraction strings.
5. Templates are memoized per `(locale, currency, exponent)`.

- `DISPLAY_LOCALE_BY_CURRENCY` is centralized: `INR→en-IN`, `USD→en-US`, `GBP→en-GB`, `EUR→en-IE`, `CAD→en-CA`, `AUD→en-AU`.
- **Required tests:**
  - `129900 INR` gives `₹1,299.00`;
  - `12345678 INR` gives `₹1,23,456.78`;
  - `"123456789012345678901" INR`, well beyond `MAX_SAFE_INTEGER`, keeps every digit and lakh/crore grouping;
  - USD `$1,299.00`, EUR `€1,299.00`, GBP `£1,299.00`;
  - JPY exponent 0 gives `¥1,299`;
  - KWD exponent 3 gives three fraction digits;
  - zero; negative, for display of a discount line;
  - **a parity test**: for 10,000 random *safe* integers the output is identical to `Intl.NumberFormat(...).format(n / 10^e)`, which proves the template extraction is correct;
  - an ESLint rule bans `Number(` and `parseFloat` in `format/`.
- Backend correctness does not depend on display: all backend math is bigint or fixed-point.

---

## 21. Background jobs (BullMQ Job Schedulers; correction 20)

- There is a new `pricing` queue in `apps/worker`.
- Every recurring job is registered with **`queue.upsertJobScheduler(schedulerId, { every }, { name, data, opts })`**, exactly as Phase 6 does (`retry.processor.ts`, `reconciliation.processor.ts`, `webhook-recovery.processor.ts`).
- **No deprecated `repeat` options** are used. The worker's `bullmq` range is aligned to `^5.81.5`.
- PostgreSQL remains authoritative: every job's effect is a fenced or conditional SQL statement, and jobs are safe to run twice.

| Scheduler id | Every | Action |
|---|---|---|
| `price-sync-scheduler` | 6h (setting) | Insert a `QUEUED` run if none is active, then process it (§5.3). |
| `price-sync-lease-sweep-scheduler` | 60 s | Expire leases (`RUNNING → LEASE_EXPIRED`), and re-enqueue `QUEUED` runs older than 5 min. |
| `pricing-freshness-monitor-scheduler` | 15 min | Metrics and logs for stale enabled-TLD prices, unusable or near-expiry FX pairs, unset tax mode, and the promo counter integrity mismatch (§9.4). |
| `order-pricing-expiry-sweep-scheduler` | 5 min | Cancel expired DRAFT/PENDING_PAYMENT orders using the §15.5 predicate, and release reservations. |
| `pricing-staging-cleanup-scheduler` | 24h | Delete staging rows for terminal runs older than 14 days. |

The public catalog cache rebuild is **event-driven** (`queue.add`) after a sync promotion or a rule, promo or FX change. It is not a scheduler.

**No Phase 7 job** calls fulfillment, touches `registrar_operations`, or transitions an order to `PROCESSING`.

---

## 22. Auditability model

Why a quote came to a given price is answered from the quote row, its tax lines, and the snapshot, **without reading current configuration**.

```json
{
  "engineVersion": 1, "roundingPolicy": "HALF_UP_V1",
  "quotedAt": "<= quotes.created_at (DB tx now())>",
  "availability": { "available": true, "premium": false, "observedAt": "...", "source": "LIVE" },
  "provider": { "providerId": "...", "priceRowId": "...", "amountMinor": "1050", "currency": "USD",
                "observedAt": "...", "sourceReference": "price_level:...", "syncRunId": "..." },
  "fx": { "mode": "RATE", "rateId": "...", "rate": "83.250000000000", "source": "MANUAL",
          "observedAt": "...", "validUntil": "..." },          // or { "mode": "IDENTITY" }
  "convertedCostMinor": "87413",
  "markup": { "ruleId": "...", "ruleVersion": 3, "scope": "TLD_OPERATION", "strategy": "MAX_FIXED_PERCENT",
              "percentBps": 2000, "fixedMinor": "15000", "roundingIncrementMinor": "100", "markupMinor": "15087" },
  "retailMinor": "102500",
  "promotion": null,
  "tax": { "mode": "DISABLED" | "ENFORCED", "country": "IN", "region": null,
           "commerceCountrySource": "ACCOUNT_PROFILE_COUNTRY", "lines": [ ... ] },
  "finalMinor": "102500",
  "currency": "INR", "currencySource": "ACCOUNT_PREFERENCE"
}
```

- The snapshot and tax lines are copied to the order item, and both are immutable (§12).
- **Reproduce test:** recomputes `final` from the snapshot inputs with `engineVersion 1` and asserts equality for every generated test quote.
- Rule, promo, tax and policy changes carry a version plus before/after audit rows.
- `fx_rates` is append-only.
- Sync runs and staging (for 14 days) show what the provider returned.

---

## 23. Failure matrix

| Condition | Where | Behavior | Customer sees |
|---|---|---|---|
| Provider price stale or unavailable | quote | fail, metric | `PRICE_TEMPORARILY_UNAVAILABLE` |
| FX missing, expired or too old | quote | fail, **never 1:1** | `CURRENCY_TEMPORARILY_UNAVAILABLE` |
| No rule, missing currency param, or below cost | quote | fail, admin log | `PRICE_TEMPORARILY_UNAVAILABLE` |
| Tax mode unset | quote | fail, admin alert | `CHECKOUT_TEMPORARILY_UNAVAILABLE` |
| ENFORCED and no matching tax rule | quote | fail | `CHECKOUT_TEMPORARILY_UNAVAILABLE` |
| ENFORCED and no commerce country | quote | 409 | `COMMERCE_COUNTRY_REQUIRED` |
| Domain unavailable or premium | quote | fail | `DOMAIN_UNAVAILABLE` / `PREMIUM_NOT_SUPPORTED` |
| Provider search error or circuit open | quote/search | fail, no guess | `SEARCH_TEMPORARILY_UNAVAILABLE` |
| `years ≠ 1` or non-REGISTER operation | quote | 422 | `OPTION_NOT_AVAILABLE` |
| Invalid promo | quote | 422 | `PROMO_CODE_INVALID` |
| Money fields in request | quote/order | 400 strict schema | `INVALID_REQUEST` |
| Quote expired | order | 409 | `QUOTE_EXPIRED` → re-quote |
| Quote used, invalidated, or not owned | order | 409 / 404 | `QUOTE_NOT_USABLE` / not found |
| Currency mismatch | order | 422 | `CURRENCY_MISMATCH` |
| Promo exhausted, expired or changed since quote | order | 409, rollback | `PROMOTION_NO_LONGER_VALID` → re-quote |
| Idempotency key reused differently | order | 409 | `IDEMPOTENCY_KEY_REUSED` |
| Submit after pricing expiry | submit | 409 | `ORDER_PRICING_EXPIRED` |
| Deferred integrity assertion fails | commit | rollback, error log (indicates a bug) | generic error |
| Immutability trigger fires | any | rejected, error log (indicates a bug) | generic error |
| Sync currency mismatch or missing | worker | provider error, run `FAILED`, nothing promoted | none |
| Sync coverage below threshold, empty or duplicate | worker | run `FAILED`, nothing promoted | none |
| Sync lease lost | worker | abort, nothing promoted | none |
| Redis down | any | DB fallback. Quote and promo rate limiters **fail closed** (429); public catalog is served from the DB. | normal or 429 |

---

## 24. Test matrix

All of the following are **in addition** to the existing suite, which must remain green.

**Money (commerce-core unit):**
- ops, currency mismatch, exponents 0, 2 and 3
- half-up at .5 boundaries
- the 10^15 ceiling; zero allowed, negative throws
- fast-check determinism over 10k inputs
- lint ban on float money

**FX:**
- identity (all FX fields NULL); USD→INR, INR→USD, JPY↔USD
- missing, expired, too old; never 1:1
- cache outage falls back to the DB, and the rate is re-read by id in the transaction
- append-only trigger rejects UPDATE and DELETE

**Markup:**
- each strategy; MAX in both directions; override
- per-currency rounding increment
- precedence levels; no rule; missing currency param with no fall-through; below cost
- one active rule per scope
- **DB rejects malformed rules:** PERCENT without bps, FIXED with bps, OVERRIDE without scope
- app rejects FIXED without amounts; coverage report

**Promotions:**
- code vs automatic; best-auto tiebreak
- window, inactive, scope tables (TLD FK, operation, currency), min amount
- fixed, percent, cap; clamp to 0
- **DB rejects** PERCENT without bps and FIXED with bps
- FIXED with no amount for the currency is inapplicable
- global and per-user limits
- **counter:** reserve +1; consume unchanged; release −1; repeated release has no effect; a failed transaction leaves no change; transitions out of RELEASED or CONSUMED are rejected; DELETE rejected; `CHECK ≥ 0`
- **concurrency:** 20 parallel checkouts on `usage_limit=1` gives exactly one success and `redemption_count = 1`
- integrity endpoint detects a manually injected mismatch; recount is audited

**Tax:**
- mode unset fails; DISABLED gives NONE and 0 with no lines; ENFORCED with no rule fails
- ENFORCED with an explicit 0% rule gives a 0 line; region beats country; multiple lines; effective dates; operation scope table
- INCLUSIVE save rejected
- missing commerce country gives 409; mode change is audited

**Quote:**
- happy path in each of the 6 currencies
- DB completeness CHECKs: each required field nulled individually is rejected
- FX CHECK: same-currency with any FX field is rejected; cross-currency with any FX field missing is rejected
- insert trigger rejects mismatched FX rate, price row, rule version, client-supplied `created_at`, and a `quotedAt` ≠ `created_at`
- `created_at == snapshot.quotedAt`
- expiry uses the DB clock (tested with a skewed app clock)
- **validity policy:** after the quote, expiring FX, aging price and editing the rule all leave it valid until `expires_at`; admin invalidate works
- cross-user 404; strict schema rejects money fields
- reproduce-from-snapshot
- stale, unavailable or premium fails; years = 2 rejected
- availability is called before the transaction; `availability_observed_at` is set

**Quote triggers (direct SQL):**
- ACTIVE→CONSUMED with `consumed_at` succeeds; without it fails
- ACTIVE→INVALIDATED with fields succeeds
- CONSUMED→ACTIVE, INVALIDATED→ACTIVE and CONSUMED→INVALIDATED fail
- changing `consumed_at` after it is set fails
- any money or snapshot column update fails
- legacy row update fails; V1 delete fails

**Order-item trigger:**
- a Phase 7 item then setting `registrar_operation_id` (a Phase 6 write) succeeds; clearing it via the Phase 6 FK SET NULL path succeeds
- updating amount, FX, markup, tax, snapshot, `quote_id` or domain is rejected
- column classification test
- a legacy item is unaffected

**Orders trigger:**
- documented transitions allowed, others rejected (V1 only)
- amount update rejected; legacy order unaffected

**Checkout (real PostgreSQL):**
- **the full TO transaction commits**, with order, items, tax lines, redemptions (after the items), consumed quotes and audit rows all present, and the counter correct
- single and multi-item; totals equal Σ (deferred check); a manual mismatch is rejected at commit
- expired, used or invalidated quote
- idempotent replay; key reuse with different quotes gives 409
- **10 parallel checkouts of the same quote give exactly one order**
- currency mismatch; duplicate domain
- submit `DRAFT→PENDING_PAYMENT`; re-submit is idempotent; submit after expiry fails
- cancel releases the promo; the quote stays CONSUMED and cannot be reused (§9.5); re-quote works
- sweep cancels only rows matching the no-payment predicate; a fixture with a payment row is not cancelled
- **no path yields PROCESSING:** application transition allowlist test; architecture-lint forbids importing registrar-ops services or queues (except `FqdnService`); after each flow, an assertion confirms zero `registrar_operations` rows were created

**Price sync (real PostgreSQL plus a fake provider):**
- happy path promotes atomically
- page N fails validation, so pages 1…N−1 are **not** promoted and production rows are byte-identical
- currency mismatch or missing fails with nothing written
- coverage below threshold fails
- an absent enabled TLD gives `SUCCEEDED_WITH_WARNINGS` with the old row untouched
- duplicate key, unknown TLDs, `"--"` marker (becomes unavailable, amount retained), empty response
- **fencing:** A claims; the sweeper expires A; B claims and promotes; A's heartbeat and promote affect 0 rows and A's data never appears
- a second admin trigger gives 409; the admin endpoint returns 202 without calling the provider (spy)

**Search:**
- canonicalization parity with `FqdnService`; cache hit and miss
- rate limit gives 429; provider error is safe
- no pricing imports (lint)

**D5 / DTO:**
- every endpoint JSON-serializes a **non-empty** multi-item order
- denylist on all customer and public DTOs; MoneyDto amounts are strings

**Security:**
- every admin endpoint gives 403 to customers
- per-role matrix including FINANCE; cross-user isolation; public rate limits; promo brute-force limit

**Format (commerce-core/format):** as listed in §20.5.

**Currency resolver:** priority order; geo never overrides stored preferences; pure (no I/O imports, lint); the app service persists GEO_DEFAULT once and never overwrites USER_SELECTED.

**Migration:** see §25.

**Phase 6 regression:** see §26.2. **Phase 5 regression:** see §27.

---

## 25. Migration verification

1. **Clean apply.** Apply 0000–0004 on an empty DB. `verify-migrations.sh` is extended to apply 0002–0004 (it currently stops at 0001) and to assert every new table, column, constraint, index, function and trigger via `information_schema`, `pg_constraint`, `pg_indexes` and `pg_trigger`.
2. **Upgrade path.** Build a DB at 0003 and insert Phase 6-shaped data: orders at PROCESSING and COMPLETED, `REGISTER` items with `registrar_operation_id`, legacy quotes, and the canary shape. Apply 0004, then check:
   - the data is intact, with `pricing_version = 0` everywhere;
   - legacy rows satisfy the new CHECKs;
   - Phase 6 UPDATE paths on legacy orders and items still succeed;
   - legacy quotes cannot be checked out.
3. **Pre-flight blocks** in 0004 abort with a clear `RAISE EXCEPTION` if:
   - `registrar_provider_prices.operation`, `order_items.operation` or `quotes.operation` contain non-canonical values (none are expected; §26.2 classification);
   - negative prices exist;
   - duplicate `(order_id, lower(domain), operation)` rows exist.
   Existing data is never silently rewritten.
4. **Executability.** CI runs `psql -v ON_ERROR_STOP=1 -f 0004_*.sql` on both the clean and upgrade DBs. The drizzle-kit introspection diff against the TS schema must be empty.
5. **Money-column test.** `money-columns.test.ts` is extended to every new `*_minor` column.
6. **Rollback.** A documented manual down-script (drop new triggers, functions, tables and columns; restore the old FK) is tested once on a scratch DB.

---

## 26. Phase 6 integration boundary and D1 regression plan

### 26.1 Boundary

- New modules: `pricing`, `quotes`, `checkout`, `promotions`, `tax`, `fx`, `domain-search` (API), `pricing` (worker), plus `commerce-core`.
- **Architecture-lint extension:** these modules may not import `RegistrarOperationService`, registrar-ops repositories, or the fulfillment queue. The **only** allowed registrar-ops import is `fqdn.service` (§11.6).
- `OrderService` remains the sole owner of `orders.status`. It gains `createDraftFromQuotes(tx, …)`, `submitForPayment`, `cancelUnpaid` and `expireUnpaid`. An application-level allowlist permits Phase 7 callers only `DRAFT→PENDING_PAYMENT` and `DRAFT|PENDING_PAYMENT→CANCELLED`.
- **No `markPaid` or `PENDING_PAYMENT→PROCESSING` method is added**, not even as a stub.
- No production or test endpoint advances an order past `PENDING_PAYMENT`. Phase 6 test fixtures keep inserting `PROCESSING` orders via SQL as legacy (`pricing_version = 0`) rows.
- Quotes reserve nothing, and Phase 6's FQDN guard stays authoritative.

### 26.2 D1: narrow Phase 6 defect fix and regression plan

**Classification of every operation-like literal (grep at `0a76dce`) before any change:**

| Location | Literal | Class | Action |
|---|---|---|---|
| `apps/api/src/modules/orders/order.service.ts:64` | `'registration'`, `'renewal'` | **DEFECT**: order-item operation filter; no order item is ever written with these values | Replace with shared `FULFILLABLE_ORDER_ITEM_OPERATIONS = ['REGISTER','RENEW']`. This keeps the original intent (registration and renewal) with canonical spelling. TRANSFER and RESTORE stay non-fulfillable, exactly as today. |
| `apps/worker/src/processors/orphan-queued.processor.ts:38`, `retry.processor.ts:54` | `'registration'` | BullMQ **job name**, not an operation value | **Unchanged.** Renaming would affect processor routing and in-flight jobs. |
| `packages/registrar-dynadot/src/__tests__/sandbox-gate.test.ts:338` | `'registration','renewal','transfer'` | Dynadot `search_type` **provider vocabulary** | Unchanged. |
| `apps/api/src/modules/auth/auth.controller.ts:62` | `'register'` | HTTP route | Unchanged. |
| `registrar-operation.service.ts` (`'REGISTER'`, `'RENEW'`), Phase 6 tests and canary (`'REGISTER'`) | canonical | already correct | Unchanged. |
| `docs/PAYMENTS.md §6.2` | `register/renew/transfer/restore` | documentation drift | Update to canonical uppercase. |
| DB `order_items.operation`, `quotes.operation`, `registrar_provider_prices.operation` | no CHECK | missing guard | Add CHECK constraints in 0004 after a pre-flight (§25.3). |

The grep is re-run during implementation, and any new occurrence is classified the same way before it is touched.

**Change set (narrow):**
1. `ORDER_ITEM_OPERATION` const plus `FULFILLABLE_ORDER_ITEM_OPERATIONS` in `@prisnames/database` enums.
2. The one-line filter change in `evaluateFulfillment()`. There is no other logic change.
3. New **`order.service.fulfillment.integration.test.ts`**. It constructs the **real** `OrderService` with the real `RegistrarOperationRepository` against `TEST_DATABASE_URL` and covers:
   - all REGISTER items succeeded → COMPLETED;
   - any failed and all terminal → FAILED;
   - a missing operation stays PROCESSING;
   - zero operations stays PROCESSING;
   - RENEW counted; TRANSFER-only stays PROCESSING;
   - **a regression case** proving that a `REGISTER` order now completes (it would have stayed PROCESSING before the fix).
4. The inline `evaluateFulfillment` re-implementation in `phase6-integration.test.ts` (§9 block) is replaced with calls to the real service, so the suite can no longer diverge from production logic.
5. Re-run the full Phase 6 DB integration suite and the sandbox canary (when credentials are present), and confirm counts: previous passing tests plus the new ones, with 0 failures.
6. Record it in `ORDER_STATE_MACHINE.md` (change log) as "**Phase 6 defect fix (D1)**: order-item operation vocabulary aligned to canonical values; no architectural change."

---

## 27. D2: Phase 5 narrow compatibility fix, sandbox evidence and regression plan

### 27.1 Evidence first

1. **Sandbox probe.** Add `get_tld_price` requests to the existing sandbox gate or probe harness, credential-gated like today, covering:
   - `currency=usd`, `currency=USD`, `currency=inr`, and one unsupported value;
   - `tlds=com,net`;
   - `show_multi_year=true`.
   For each, record `data.currency` (presence, case, value), `price_level`, and the multi-year arrays.
2. **Fixtures.** Store the redacted responses as `packages/registrar-dynadot/src/__tests__/fixtures/get-tld-price.sandbox.<date>.json`.
3. **Evidence docs.** Update `DYNADOT_INTEGRATION.md` row 57 and the Phase 5 evidence record with the observed currency behavior and the multi-year observation (D3). The multi-year arrays are recorded as **raw evidence only**.
4. **Contract statement.** The Dynadot REST v2 docs list `currency` as a result parameter. They do **not** guarantee that it always equals the requested value, and they do not define a fixed default. **Therefore no fallback currency is allowed.**

### 27.2 Adapter change (after evidence)

In `DynadotPricingFacet.getTldPrices`:
- Read `response.data.currency`, then trim and uppercase it.
- **Present, ISO-valid (in `CURRENCY_METADATA`), and equal to the requested currency:** use it for parsing and set `TldPrice.currency` to it.
- **Present but different from the requested currency:** throw `ProviderError(PROVIDER_PROTOCOL_ERROR, { reason: 'PRICING_CURRENCY_MISMATCH', requested, received })`.
- **Missing or empty:** throw `ProviderError(PROVIDER_PROTOCOL_ERROR, { reason: 'PRICING_CURRENCY_MISSING' })`. **No assumption is made.**
- **Present but not ISO-supported** (e.g. `BTC`): throw `ProviderError(PROVIDER_PROTOCOL_ERROR, { reason: 'PRICING_CURRENCY_UNSUPPORTED' })`.
- The request sends the currency in the case the probe proves works; the documented values are lowercase.
- `ProviderErrorCode` gains one **additive** value, `PROVIDER_PROTOCOL_ERROR`, which is non-retryable. Phase 6 error classification maps it to non-retryable; exhaustive switches are updated and tested.
- No retail, FX, markup or customer-currency logic enters `registrar-dynadot`. The architecture-lint check is extended to reject `commerce-core` imports from provider packages.

### 27.3 Regression

- Unit tests in `provider.test.ts` and pricing facet tests cover: equal, lowercase, mismatch, missing, unsupported, `"--"` sentinel unchanged, and `0.00` unchanged.
- Replay the stored sandbox fixture through the facet.
- **Full Phase 5 provider suite and sandbox gate re-run.** Registration, search and the other capabilities must be unaffected.
- Confirm the Phase 6 canary and integration suites still pass.

---

## 28. Explicitly deferred

- Payment gateways (Razorpay, Cashfree, PhonePe, Stripe), payment rows and webhooks
- `PENDING_PAYMENT→PROCESSING`, `CONSUMED` redemption marking, and the active-payment-aware expiry predicate (required of the payment phase, §15.5)
- Refunds, invoices and invoice numbering
- Renewal, transfer and restore **ordering** (priced in the catalog but not orderable), and auto-renew
- Multi-year quoting (until D3 evidence exists); premium pricing
- FX vendor integration and triangulation
- INCLUSIVE tax enablement (a new `pricing_version`), seeded tax rules, and any GST/VAT logic
- A distinct billing address (source enum is ready)
- Durable cart, promo stacking, referral and affiliate rewards
- DNS, nameserver, privacy and lock writes; email resale; provider failover
- Dropping the deprecated retail columns on `registrar_provider_prices`
- A price-history table

---

## 29. Acceptance criteria

1. Migration 0004 is **fully executable** (`ON_ERROR_STOP=1`) on both an empty DB and a Phase 6 DB, and the verification scripts and introspection diff pass.
2. D1 is fixed in the real `OrderService`, with a direct DB-backed test. The Phase 6 suites are green and the inline re-implementation has been removed.
3. D2 is backed by sandbox evidence and fixtures. The adapter uses the response currency and fails on mismatch, missing or unsupported values. The Phase 5 suites are green.
4. The pricing pipeline is deterministic bigint for all 6 currencies, with no float in any money path (lint enforced).
5. Missing, stale or expired FX, stale or unavailable prices, missing rules or params, an unset tax mode, and an unsatisfied ENFORCED tax policy all **fail** safely. There is never a 1:1 rate, an invented price or implicit 0% tax.
6. V1 quotes and order items satisfy the DB completeness and FX-consistency constraints. Snapshots reproduce their stored finals, and triggers enforce immutability, status transitions and the Phase 6 write allowlist.
7. The issued-quote validity policy (§11.3) and DB-authoritative timestamps (§11.4) are implemented and tested.
8. Checkout inserts in the FK-safe order (§15.2) and commits atomically on real PostgreSQL. Idempotency, single quote use and the 10-way concurrency tests pass.
9. The promotion counter is trigger-maintained, never negative, never above the limit, and released exactly once. The integrity check detects drift, and the concurrency tests pass.
10. Price sync is staged and atomic, never partially publishes, and is lease-fenced. The stale-worker test proves a superseded worker publishes nothing, and the admin trigger returns 202 without provider I/O.
11. Orders reach `PENDING_PAYMENT` at most. No Phase 7 path creates registrar operations, touches payments, or yields `PROCESSING`.
12. No controller returns raw rows. All money crosses JSON as strings, non-empty serialization tests pass, and the customer/public denylist tests pass.
13. Admin permissions are enforced, including FINANCE, and SUPER_ADMIN keeps its override.
14. The exact money formatter passes every §20.5 case, including values beyond `MAX_SAFE_INTEGER` and lakh grouping, and the UI marks indicative vs quoted prices.
15. All recurring jobs use `upsertJobScheduler`.
16. The full suite is green (previous 811 plus new, 0 failed), typecheck and build pass, and there are 0 production lint errors.

---

## 30. Implementation order (once approved)

1. D1 fix and direct test; D2 sandbox probe, evidence, adapter fix and tests. Re-run the Phase 5 and 6 suites.
2. `commerce-core` (money, engine, currency, normalize, format) with unit and property tests.
3. Migration 0004, the Drizzle schema, verification scripts, and the upgrade test.
4. FX admin and service; price sync (staging, lease, promote) with scheduler jobs.
5. Rules, promotions (counter triggers, integrity), tax policy and rules, and their admin APIs.
6. `DomainSearchService`, quotes, public pricing.
7. Checkout, orders, sweeps, and the DTO replacement (D5).
8. Frontend: formatter, then public pages, then checkout, then dashboard, then admin.
9. Concurrency, fencing and migration upgrade suites.
10. Full regression checkpoint.

---

## Appendix A — Executable migration `0004_phase7_pricing_checkout.sql`

```sql
-- Migration: 0004_phase7_pricing_checkout
-- Phase 7: Retail pricing, quotes & checkout foundation
-- Prerequisites: 0000, 0001, 0002, 0003

BEGIN;

-- ════════════════════════════════════════════════════════════════
-- 0. PRE-FLIGHT — abort rather than rewrite unexpected data
-- ════════════════════════════════════════════════════════════════
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM registrar_provider_prices
             WHERE operation NOT IN ('REGISTER','RENEW','TRANSFER','RESTORE')) THEN
    RAISE EXCEPTION '0004 pre-flight: registrar_provider_prices.operation has non-canonical values';
  END IF;
  IF EXISTS (SELECT 1 FROM registrar_provider_prices WHERE provider_cost_minor < 0) THEN
    RAISE EXCEPTION '0004 pre-flight: negative provider_cost_minor present';
  END IF;
  IF EXISTS (SELECT 1 FROM order_items
             WHERE operation NOT IN ('REGISTER','RENEW','TRANSFER','RESTORE')) THEN
    RAISE EXCEPTION '0004 pre-flight: order_items.operation has non-canonical values';
  END IF;
  IF EXISTS (SELECT 1 FROM quotes
             WHERE operation NOT IN ('REGISTER','RENEW','TRANSFER','RESTORE')) THEN
    RAISE EXCEPTION '0004 pre-flight: quotes.operation has non-canonical values';
  END IF;
  IF EXISTS (SELECT 1 FROM order_items
             GROUP BY order_id, lower(domain), operation HAVING count(*) > 1) THEN
    RAISE EXCEPTION '0004 pre-flight: duplicate (order_id, domain, operation) in order_items';
  END IF;
END $$;

-- ════════════════════════════════════════════════════════════════
-- 1. TLDS
-- ════════════════════════════════════════════════════════════════
ALTER TABLE tlds
  ADD COLUMN display_order INTEGER NOT NULL DEFAULT 1000,
  ADD COLUMN last_price_sync_at TIMESTAMPTZ;

-- ════════════════════════════════════════════════════════════════
-- 2. PROVIDER PRICE SYNC RUNS + STAGING
-- ════════════════════════════════════════════════════════════════
CREATE TABLE provider_price_sync_runs (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  registrar_provider_id  UUID NOT NULL REFERENCES registrar_providers(id) ON DELETE RESTRICT,
  trigger_source         VARCHAR(20) NOT NULL,
  triggered_by           UUID REFERENCES users(id) ON DELETE RESTRICT,
  status                 VARCHAR(30) NOT NULL DEFAULT 'QUEUED',
  requested_currency     VARCHAR(3) NOT NULL,
  response_currency      VARCHAR(3),
  run_token              UUID,
  run_version            INTEGER NOT NULL DEFAULT 0,
  claimed_by             VARCHAR(100),
  heartbeat_at           TIMESTAMPTZ,
  lease_expires_at       TIMESTAMPTZ,
  queued_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at             TIMESTAMPTZ,
  finished_at            TIMESTAMPTZ,
  pages_fetched          INTEGER NOT NULL DEFAULT 0,
  rows_staged            INTEGER NOT NULL DEFAULT 0,
  rows_promoted          INTEGER NOT NULL DEFAULT 0,
  rows_unavailable       INTEGER NOT NULL DEFAULT 0,
  unknown_tlds           INTEGER NOT NULL DEFAULT 0,
  missing_enabled_tlds   INTEGER NOT NULL DEFAULT 0,
  error_code             VARCHAR(50),
  error_summary          VARCHAR(1000),
  warnings               JSONB,
  CONSTRAINT chk_sync_runs_trigger CHECK (trigger_source IN ('SCHEDULED','ADMIN')),
  CONSTRAINT chk_sync_runs_admin_actor CHECK (trigger_source <> 'ADMIN' OR triggered_by IS NOT NULL),
  CONSTRAINT chk_sync_runs_status CHECK (status IN
    ('QUEUED','RUNNING','SUCCEEDED','SUCCEEDED_WITH_WARNINGS','FAILED','LEASE_EXPIRED')),
  CONSTRAINT chk_sync_runs_requested_ccy CHECK (requested_currency ~ '^[A-Z]{3}$'),
  CONSTRAINT chk_sync_runs_response_ccy CHECK (response_currency IS NULL OR response_currency ~ '^[A-Z]{3}$'),
  CONSTRAINT chk_sync_runs_lease CHECK (status <> 'RUNNING' OR (run_token IS NOT NULL
    AND heartbeat_at IS NOT NULL AND lease_expires_at IS NOT NULL AND started_at IS NOT NULL)),
  CONSTRAINT chk_sync_runs_finished CHECK ((status IN ('QUEUED','RUNNING')) = (finished_at IS NULL)),
  CONSTRAINT chk_sync_runs_counters CHECK (pages_fetched >= 0 AND rows_staged >= 0 AND rows_promoted >= 0
    AND rows_unavailable >= 0 AND unknown_tlds >= 0 AND missing_enabled_tlds >= 0)
);
CREATE UNIQUE INDEX uq_price_sync_active
  ON provider_price_sync_runs (registrar_provider_id) WHERE status IN ('QUEUED','RUNNING');
CREATE INDEX idx_price_sync_lease
  ON provider_price_sync_runs (lease_expires_at) WHERE status = 'RUNNING';
CREATE INDEX idx_price_sync_queued
  ON provider_price_sync_runs (queued_at) WHERE status = 'QUEUED';
CREATE INDEX idx_price_sync_provider_recent
  ON provider_price_sync_runs (registrar_provider_id, queued_at DESC);

CREATE TABLE provider_price_staging (
  sync_run_id       UUID NOT NULL REFERENCES provider_price_sync_runs(id) ON DELETE CASCADE,
  tld               VARCHAR(50) NOT NULL,
  operation         VARCHAR(20) NOT NULL,
  years             INTEGER NOT NULL,
  currency          VARCHAR(3) NOT NULL,
  amount_minor      BIGINT,
  is_available      BOOLEAN NOT NULL,
  observed_at       TIMESTAMPTZ NOT NULL,
  source_reference  VARCHAR(100),
  staged_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (sync_run_id, tld, operation, years),
  CONSTRAINT chk_staging_operation CHECK (operation IN ('REGISTER','RENEW','TRANSFER','RESTORE')),
  CONSTRAINT chk_staging_years CHECK (years = 1),
  CONSTRAINT chk_staging_currency CHECK (currency ~ '^[A-Z]{3}$'),
  CONSTRAINT chk_staging_amount CHECK (amount_minor IS NULL
    OR (amount_minor >= 0 AND amount_minor <= 1000000000000000)),
  CONSTRAINT chk_staging_availability CHECK (is_available = (amount_minor IS NOT NULL))
);

-- ════════════════════════════════════════════════════════════════
-- 3. REGISTRAR PROVIDER PRICES → wholesale only
-- ════════════════════════════════════════════════════════════════
ALTER TABLE registrar_provider_prices
  ALTER COLUMN retail_price_minor DROP NOT NULL,
  ALTER COLUMN retail_price_currency DROP NOT NULL,
  ADD COLUMN is_available BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN observed_at TIMESTAMPTZ,
  ADD COLUMN source_reference VARCHAR(100),
  ADD COLUMN last_sync_run_id UUID REFERENCES provider_price_sync_runs(id) ON DELETE RESTRICT;

ALTER TABLE registrar_provider_prices
  ADD CONSTRAINT chk_rpp_operation CHECK (operation IN ('REGISTER','RENEW','TRANSFER','RESTORE')),
  ADD CONSTRAINT chk_rpp_cost_range CHECK (provider_cost_minor >= 0 AND provider_cost_minor <= 1000000000000000),
  ADD CONSTRAINT chk_rpp_currency CHECK (provider_cost_currency ~ '^[A-Z]{3}$'),
  ADD CONSTRAINT chk_rpp_years CHECK (years BETWEEN 1 AND 10);

-- ════════════════════════════════════════════════════════════════
-- 4. FX RATES (append-only)
-- ════════════════════════════════════════════════════════════════
CREATE TABLE fx_rates (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  base_currency     VARCHAR(3) NOT NULL,
  quote_currency    VARCHAR(3) NOT NULL,
  rate              NUMERIC(24,12) NOT NULL,
  source            VARCHAR(50) NOT NULL,
  source_reference  VARCHAR(100),
  observed_at       TIMESTAMPTZ NOT NULL,
  fetched_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  valid_until       TIMESTAMPTZ NOT NULL,
  created_by        UUID REFERENCES users(id) ON DELETE RESTRICT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_fx_rates_ccy CHECK (base_currency ~ '^[A-Z]{3}$' AND quote_currency ~ '^[A-Z]{3}$'),
  CONSTRAINT chk_fx_rates_pair CHECK (base_currency <> quote_currency),
  CONSTRAINT chk_fx_rates_rate CHECK (rate > 0),
  CONSTRAINT chk_fx_rates_validity CHECK (valid_until > observed_at)
);
CREATE INDEX idx_fx_rates_pair_latest ON fx_rates (base_currency, quote_currency, observed_at DESC);

-- ════════════════════════════════════════════════════════════════
-- 5. PRICING RULES
-- ════════════════════════════════════════════════════════════════
CREATE TABLE pricing_rules (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tld_id            UUID REFERENCES tlds(id) ON DELETE RESTRICT,
  operation         VARCHAR(20),
  strategy          VARCHAR(20) NOT NULL,
  percent_bps       INTEGER,
  allow_below_cost  BOOLEAN NOT NULL DEFAULT false,
  is_active         BOOLEAN NOT NULL DEFAULT true,
  version           INTEGER NOT NULL DEFAULT 1,
  created_by        UUID REFERENCES users(id) ON DELETE RESTRICT,
  updated_by        UUID REFERENCES users(id) ON DELETE RESTRICT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_pricing_rules_operation CHECK (operation IS NULL
    OR operation IN ('REGISTER','RENEW','TRANSFER','RESTORE')),
  CONSTRAINT chk_pricing_rules_strategy CHECK (strategy IN
    ('FIXED','PERCENT','MAX_FIXED_PERCENT','RETAIL_OVERRIDE')),
  CONSTRAINT chk_pricing_rules_bps_range CHECK (percent_bps IS NULL OR percent_bps BETWEEN 0 AND 100000),
  CONSTRAINT chk_pricing_rules_params CHECK (
       (strategy = 'PERCENT'           AND percent_bps IS NOT NULL)
    OR (strategy = 'FIXED'             AND percent_bps IS NULL)
    OR (strategy = 'MAX_FIXED_PERCENT' AND percent_bps IS NOT NULL)
    OR (strategy = 'RETAIL_OVERRIDE'   AND percent_bps IS NULL
                                       AND tld_id IS NOT NULL AND operation IS NOT NULL)),
  CONSTRAINT chk_pricing_rules_version CHECK (version >= 1)
);
CREATE UNIQUE INDEX uq_pricing_rules_active_scope ON pricing_rules (
  COALESCE(tld_id, '00000000-0000-0000-0000-000000000000'::uuid),
  COALESCE(operation, '*')
) WHERE is_active;

CREATE TABLE pricing_rule_currency_params (
  pricing_rule_id           UUID NOT NULL REFERENCES pricing_rules(id) ON DELETE RESTRICT,
  currency                  VARCHAR(3) NOT NULL,
  fixed_amount_minor        BIGINT,
  override_amount_minor     BIGINT,
  rounding_increment_minor  BIGINT,
  PRIMARY KEY (pricing_rule_id, currency),
  CONSTRAINT chk_prcp_currency CHECK (currency ~ '^[A-Z]{3}$'),
  CONSTRAINT chk_prcp_fixed CHECK (fixed_amount_minor IS NULL
    OR (fixed_amount_minor >= 0 AND fixed_amount_minor <= 1000000000000000)),
  CONSTRAINT chk_prcp_override CHECK (override_amount_minor IS NULL
    OR (override_amount_minor >= 0 AND override_amount_minor <= 1000000000000000)),
  CONSTRAINT chk_prcp_rounding CHECK (rounding_increment_minor IS NULL OR rounding_increment_minor > 0),
  CONSTRAINT chk_prcp_not_empty CHECK (fixed_amount_minor IS NOT NULL
    OR override_amount_minor IS NOT NULL OR rounding_increment_minor IS NOT NULL)
);

-- ════════════════════════════════════════════════════════════════
-- 6. PROMOTIONS (normalized scopes)
-- ════════════════════════════════════════════════════════════════
CREATE TABLE promotions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code              VARCHAR(40),
  code_canonical    VARCHAR(40),
  name              VARCHAR(100) NOT NULL,
  display_name      VARCHAR(100) NOT NULL,
  kind              VARCHAR(10) NOT NULL,
  percent_bps       INTEGER,
  starts_at         TIMESTAMPTZ NOT NULL,
  ends_at           TIMESTAMPTZ,
  usage_limit       INTEGER,
  per_user_limit    INTEGER,
  redemption_count  INTEGER NOT NULL DEFAULT 0,
  priority          INTEGER NOT NULL DEFAULT 100,
  is_active         BOOLEAN NOT NULL DEFAULT true,
  version           INTEGER NOT NULL DEFAULT 1,
  created_by        UUID REFERENCES users(id) ON DELETE RESTRICT,
  updated_by        UUID REFERENCES users(id) ON DELETE RESTRICT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_promotions_kind CHECK (kind IN ('FIXED','PERCENT')),
  CONSTRAINT chk_promotions_kind_params CHECK (
       (kind = 'PERCENT' AND percent_bps IS NOT NULL AND percent_bps BETWEEN 1 AND 10000)
    OR (kind = 'FIXED'   AND percent_bps IS NULL)),
  CONSTRAINT chk_promotions_code_pair CHECK ((code IS NULL) = (code_canonical IS NULL)),
  CONSTRAINT chk_promotions_code_canonical CHECK (code_canonical IS NULL
    OR (code_canonical = upper(btrim(code)) AND code_canonical ~ '^[A-Z0-9_-]{3,40}$')),
  CONSTRAINT chk_promotions_window CHECK (ends_at IS NULL OR ends_at > starts_at),
  CONSTRAINT chk_promotions_usage_limit CHECK (usage_limit IS NULL OR usage_limit > 0),
  CONSTRAINT chk_promotions_per_user_limit CHECK (per_user_limit IS NULL OR per_user_limit > 0),
  CONSTRAINT chk_promotions_count_nonneg CHECK (redemption_count >= 0),
  CONSTRAINT chk_promotions_within_limit CHECK (usage_limit IS NULL OR redemption_count <= usage_limit),
  CONSTRAINT chk_promotions_version CHECK (version >= 1)
);
CREATE UNIQUE INDEX uq_promotions_code ON promotions (code_canonical) WHERE code_canonical IS NOT NULL;
CREATE INDEX idx_promotions_auto_active ON promotions (starts_at, ends_at)
  WHERE is_active AND code_canonical IS NULL;

CREATE TABLE promotion_tlds (
  promotion_id  UUID NOT NULL REFERENCES promotions(id) ON DELETE RESTRICT,
  tld_id        UUID NOT NULL REFERENCES tlds(id) ON DELETE RESTRICT,
  PRIMARY KEY (promotion_id, tld_id)
);
CREATE INDEX idx_promotion_tlds_tld ON promotion_tlds (tld_id);

CREATE TABLE promotion_operations (
  promotion_id  UUID NOT NULL REFERENCES promotions(id) ON DELETE RESTRICT,
  operation     VARCHAR(20) NOT NULL,
  PRIMARY KEY (promotion_id, operation),
  CONSTRAINT chk_promotion_operations_op CHECK (operation IN ('REGISTER','RENEW','TRANSFER','RESTORE'))
);

CREATE TABLE promotion_currencies (
  promotion_id  UUID NOT NULL REFERENCES promotions(id) ON DELETE RESTRICT,
  currency      VARCHAR(3) NOT NULL,
  PRIMARY KEY (promotion_id, currency),
  CONSTRAINT chk_promotion_currencies_ccy CHECK (currency ~ '^[A-Z]{3}$')
);

CREATE TABLE promotion_currency_amounts (
  promotion_id          UUID NOT NULL REFERENCES promotions(id) ON DELETE RESTRICT,
  currency              VARCHAR(3) NOT NULL,
  fixed_discount_minor  BIGINT,
  min_amount_minor      BIGINT,
  max_discount_minor    BIGINT,
  PRIMARY KEY (promotion_id, currency),
  CONSTRAINT chk_pca_currency CHECK (currency ~ '^[A-Z]{3}$'),
  CONSTRAINT chk_pca_fixed CHECK (fixed_discount_minor IS NULL
    OR (fixed_discount_minor >= 0 AND fixed_discount_minor <= 1000000000000000)),
  CONSTRAINT chk_pca_min CHECK (min_amount_minor IS NULL
    OR (min_amount_minor >= 0 AND min_amount_minor <= 1000000000000000)),
  CONSTRAINT chk_pca_max CHECK (max_discount_minor IS NULL
    OR (max_discount_minor >= 0 AND max_discount_minor <= 1000000000000000))
);

-- ════════════════════════════════════════════════════════════════
-- 7. TAX RULES
-- ════════════════════════════════════════════════════════════════
CREATE TABLE tax_rules (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country         VARCHAR(2) NOT NULL,
  region          VARCHAR(50),
  tax_code        VARCHAR(30) NOT NULL,
  display_name    VARCHAR(100) NOT NULL,
  rate_bps        INTEGER NOT NULL,
  treatment       VARCHAR(10) NOT NULL,
  customer_type   VARCHAR(20),
  effective_from  TIMESTAMPTZ NOT NULL,
  effective_to    TIMESTAMPTZ,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  version         INTEGER NOT NULL DEFAULT 1,
  created_by      UUID REFERENCES users(id) ON DELETE RESTRICT,
  updated_by      UUID REFERENCES users(id) ON DELETE RESTRICT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_tax_rules_country CHECK (country ~ '^[A-Z]{2}$'),
  CONSTRAINT chk_tax_rules_rate CHECK (rate_bps BETWEEN 0 AND 10000),
  CONSTRAINT chk_tax_rules_treatment CHECK (treatment IN ('EXCLUSIVE','INCLUSIVE')),
  CONSTRAINT chk_tax_rules_customer_type CHECK (customer_type IS NULL
    OR customer_type IN ('INDIVIDUAL','BUSINESS')),
  CONSTRAINT chk_tax_rules_effective CHECK (effective_to IS NULL OR effective_to > effective_from),
  CONSTRAINT chk_tax_rules_code CHECK (tax_code ~ '^[A-Z0-9_]{2,30}$'),
  CONSTRAINT chk_tax_rules_version CHECK (version >= 1)
);
CREATE INDEX idx_tax_rules_lookup ON tax_rules (country, region) WHERE is_active;

CREATE TABLE tax_rule_operations (
  tax_rule_id  UUID NOT NULL REFERENCES tax_rules(id) ON DELETE RESTRICT,
  operation    VARCHAR(20) NOT NULL,
  PRIMARY KEY (tax_rule_id, operation),
  CONSTRAINT chk_tax_rule_operations_op CHECK (operation IN ('REGISTER','RENEW','TRANSFER','RESTORE'))
);

-- ════════════════════════════════════════════════════════════════
-- 8. QUOTES (extend)
-- ════════════════════════════════════════════════════════════════
ALTER TABLE quotes
  ADD COLUMN status                      VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN pricing_version             INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN engine_version              INTEGER,
  ADD COLUMN tld_id                      UUID REFERENCES tlds(id) ON DELETE RESTRICT,
  ADD COLUMN provider_price_id           UUID REFERENCES registrar_provider_prices(id) ON DELETE RESTRICT,
  ADD COLUMN provider_price_observed_at  TIMESTAMPTZ,
  ADD COLUMN provider_cost_currency      VARCHAR(3),
  ADD COLUMN fx_rate_id                  UUID REFERENCES fx_rates(id) ON DELETE RESTRICT,
  ADD COLUMN fx_rate                     NUMERIC(24,12),
  ADD COLUMN fx_source                   VARCHAR(50),
  ADD COLUMN fx_observed_at              TIMESTAMPTZ,
  ADD COLUMN converted_cost_minor        BIGINT,
  ADD COLUMN markup_minor                BIGINT,
  ADD COLUMN discount_minor              BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN tax_minor                   BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN tax_mode                    VARCHAR(10),
  ADD COLUMN tax_treatment               VARCHAR(10),
  ADD COLUMN tax_country                 VARCHAR(2),
  ADD COLUMN tax_region                  VARCHAR(50),
  ADD COLUMN commerce_country_source     VARCHAR(30),
  ADD COLUMN final_amount_minor          BIGINT,
  ADD COLUMN pricing_rule_id             UUID REFERENCES pricing_rules(id) ON DELETE RESTRICT,
  ADD COLUMN pricing_rule_version        INTEGER,
  ADD COLUMN promotion_id                UUID REFERENCES promotions(id) ON DELETE RESTRICT,
  ADD COLUMN promotion_version           INTEGER,
  ADD COLUMN promo_code_entered          VARCHAR(40),
  ADD COLUMN currency_source             VARCHAR(20),
  ADD COLUMN availability_observed_at    TIMESTAMPTZ,
  ADD COLUMN availability_source         VARCHAR(10),
  ADD COLUMN calculation_snapshot        JSONB,
  ADD COLUMN consumed_at                 TIMESTAMPTZ,
  ADD COLUMN invalidated_at              TIMESTAMPTZ,
  ADD COLUMN invalidated_by              UUID REFERENCES users(id) ON DELETE RESTRICT,
  ADD COLUMN invalidation_reason         VARCHAR(500);

-- New quotes must declare their pricing version explicitly (legacy rows already backfilled to 0).
ALTER TABLE quotes ALTER COLUMN pricing_version DROP DEFAULT;

ALTER TABLE quotes
  ADD CONSTRAINT chk_quotes_operation CHECK (operation IN ('REGISTER','RENEW','TRANSFER','RESTORE')),
  ADD CONSTRAINT chk_quotes_pricing_version CHECK (pricing_version IN (0, 1)),
  ADD CONSTRAINT chk_quotes_expiry CHECK (expires_at > created_at),
  ADD CONSTRAINT chk_quotes_status CHECK (
       (status = 'ACTIVE'      AND consumed_at IS NULL     AND invalidated_at IS NULL
                               AND invalidated_by IS NULL  AND invalidation_reason IS NULL)
    OR (status = 'CONSUMED'    AND consumed_at IS NOT NULL AND invalidated_at IS NULL
                               AND invalidated_by IS NULL  AND invalidation_reason IS NULL)
    OR (status = 'INVALIDATED' AND consumed_at IS NULL     AND invalidated_at IS NOT NULL
                               AND invalidated_by IS NOT NULL AND invalidation_reason IS NOT NULL)),
  ADD CONSTRAINT chk_quotes_v1_complete CHECK (pricing_version = 0 OR (
        pricing_version = 1
    AND engine_version IS NOT NULL AND engine_version = 1
    AND years = 1
    AND is_premium = false
    AND domain = lower(domain)
    AND tld_id IS NOT NULL
    AND provider_price_id IS NOT NULL
    AND provider_price_observed_at IS NOT NULL
    AND provider_cost_minor >= 0
    AND provider_cost_currency IS NOT NULL AND provider_cost_currency ~ '^[A-Z]{3}$'
    AND currency ~ '^[A-Z]{3}$'
    AND converted_cost_minor IS NOT NULL AND converted_cost_minor >= 0
    AND markup_minor IS NOT NULL
    AND retail_amount_minor >= 0
    AND retail_amount_minor = converted_cost_minor + markup_minor
    AND discount_minor >= 0 AND discount_minor <= retail_amount_minor
    AND tax_minor >= 0
    AND tax_mode IS NOT NULL AND tax_mode IN ('DISABLED','ENFORCED')
    AND tax_treatment IS NOT NULL AND tax_treatment IN ('NONE','EXCLUSIVE')
    AND (tax_mode <> 'DISABLED' OR (tax_treatment = 'NONE' AND tax_minor = 0))
    AND (tax_mode <> 'ENFORCED' OR (tax_treatment = 'EXCLUSIVE'
                                    AND tax_country IS NOT NULL AND tax_country ~ '^[A-Z]{2}$'))
    AND commerce_country_source IS NOT NULL
    AND commerce_country_source IN ('ACCOUNT_PROFILE_COUNTRY','NOT_REQUIRED')
    AND final_amount_minor IS NOT NULL
    AND final_amount_minor = retail_amount_minor - discount_minor
                             + CASE WHEN tax_treatment = 'EXCLUSIVE' THEN tax_minor ELSE 0 END
    AND final_amount_minor >= 0
    AND pricing_rule_id IS NOT NULL AND pricing_rule_version IS NOT NULL
    AND ((promotion_id IS NULL AND promotion_version IS NULL AND discount_minor = 0)
      OR (promotion_id IS NOT NULL AND promotion_version IS NOT NULL))
    AND currency_source IS NOT NULL
    AND currency_source IN ('EXPLICIT_REQUEST','ACCOUNT_PREFERENCE','ACCOUNT_COUNTRY',
                            'BROWSER_PREFERENCE','GEO_DEFAULT','PLATFORM_DEFAULT')
    AND availability_observed_at IS NOT NULL
    AND availability_source IS NOT NULL AND availability_source IN ('LIVE','CACHE')
    AND calculation_snapshot IS NOT NULL AND jsonb_typeof(calculation_snapshot) = 'object')),
  ADD CONSTRAINT chk_quotes_v1_fx CHECK (pricing_version = 0 OR (
       (provider_cost_currency = currency
        AND fx_rate_id IS NULL AND fx_rate IS NULL AND fx_source IS NULL AND fx_observed_at IS NULL
        AND converted_cost_minor = provider_cost_minor)
    OR (provider_cost_currency <> currency
        AND fx_rate_id IS NOT NULL AND fx_rate IS NOT NULL AND fx_rate > 0
        AND fx_source IS NOT NULL AND fx_observed_at IS NOT NULL)));

CREATE INDEX idx_quotes_user_status ON quotes (user_id, status);

CREATE TABLE quote_tax_lines (
  quote_id          UUID NOT NULL REFERENCES quotes(id) ON DELETE RESTRICT,
  line_no           SMALLINT NOT NULL,
  tax_rule_id       UUID NOT NULL REFERENCES tax_rules(id) ON DELETE RESTRICT,
  tax_rule_version  INTEGER NOT NULL,
  tax_code          VARCHAR(30) NOT NULL,
  display_name      VARCHAR(100) NOT NULL,
  rate_bps          INTEGER NOT NULL,
  treatment         VARCHAR(10) NOT NULL,
  amount_minor      BIGINT NOT NULL,
  PRIMARY KEY (quote_id, line_no),
  CONSTRAINT chk_qtl_line_no CHECK (line_no >= 1),
  CONSTRAINT chk_qtl_rate CHECK (rate_bps BETWEEN 0 AND 10000),
  CONSTRAINT chk_qtl_treatment CHECK (treatment = 'EXCLUSIVE'),
  CONSTRAINT chk_qtl_amount CHECK (amount_minor >= 0)
);

-- ════════════════════════════════════════════════════════════════
-- 9. ORDERS (extend)
-- ════════════════════════════════════════════════════════════════
ALTER TABLE orders
  ADD COLUMN pricing_version           INTEGER NOT NULL DEFAULT 0,   -- default kept: Phase 6 fixtures insert legacy rows
  ADD COLUMN checkout_idempotency_key  VARCHAR(100),
  ADD COLUMN checkout_request_hash     VARCHAR(64),
  ADD COLUMN pricing_expires_at        TIMESTAMPTZ,
  ADD COLUMN submitted_at              TIMESTAMPTZ,
  ADD COLUMN cancelled_at              TIMESTAMPTZ,
  ADD COLUMN cancellation_reason       VARCHAR(50);

ALTER TABLE orders
  ADD CONSTRAINT chk_orders_pricing_version CHECK (pricing_version IN (0, 1)),
  ADD CONSTRAINT chk_orders_amounts_nonneg CHECK (subtotal_minor >= 0 AND discount_minor >= 0
    AND tax_minor >= 0 AND total_minor >= 0),
  ADD CONSTRAINT chk_orders_v1_complete CHECK (pricing_version = 0 OR (
        checkout_idempotency_key IS NOT NULL
    AND checkout_request_hash IS NOT NULL AND checkout_request_hash ~ '^[0-9a-f]{64}$'
    AND pricing_expires_at IS NOT NULL
    AND currency ~ '^[A-Z]{3}$'
    AND total_minor = subtotal_minor - discount_minor + tax_minor
    AND (status <> 'PENDING_PAYMENT' OR submitted_at IS NOT NULL)
    AND (status <> 'CANCELLED' OR (cancelled_at IS NOT NULL AND cancellation_reason IS NOT NULL))
    AND (cancellation_reason IS NULL OR cancellation_reason IN
         ('CUSTOMER_CANCELLED','PRICING_EXPIRED','ADMIN_CANCELLED'))));

CREATE UNIQUE INDEX uq_orders_checkout_idem ON orders (user_id, checkout_idempotency_key)
  WHERE checkout_idempotency_key IS NOT NULL;
CREATE INDEX idx_orders_pricing_expiry ON orders (pricing_expires_at)
  WHERE status IN ('DRAFT','PENDING_PAYMENT') AND pricing_version >= 1;

-- ════════════════════════════════════════════════════════════════
-- 10. ORDER ITEMS (extend)
-- ════════════════════════════════════════════════════════════════
ALTER TABLE order_items
  ADD COLUMN pricing_version         INTEGER NOT NULL DEFAULT 0,     -- default kept: Phase 6 fixtures
  ADD COLUMN quote_pricing_version   INTEGER,
  ADD COLUMN engine_version          INTEGER,
  ADD COLUMN tld_id                  UUID REFERENCES tlds(id) ON DELETE RESTRICT,
  ADD COLUMN provider_price_id       UUID REFERENCES registrar_provider_prices(id) ON DELETE RESTRICT,
  ADD COLUMN provider_cost_currency  VARCHAR(3),
  ADD COLUMN fx_rate_id              UUID REFERENCES fx_rates(id) ON DELETE RESTRICT,
  ADD COLUMN fx_rate                 NUMERIC(24,12),
  ADD COLUMN fx_source               VARCHAR(50),
  ADD COLUMN fx_observed_at          TIMESTAMPTZ,
  ADD COLUMN converted_cost_minor    BIGINT,
  ADD COLUMN retail_amount_minor     BIGINT,
  ADD COLUMN markup_minor            BIGINT,
  ADD COLUMN discount_minor          BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN tax_minor               BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN tax_mode                VARCHAR(10),
  ADD COLUMN tax_treatment           VARCHAR(10),
  ADD COLUMN pricing_rule_id         UUID REFERENCES pricing_rules(id) ON DELETE RESTRICT,
  ADD COLUMN pricing_rule_version    INTEGER,
  ADD COLUMN promotion_id            UUID REFERENCES promotions(id) ON DELETE RESTRICT,
  ADD COLUMN promotion_version       INTEGER,
  ADD COLUMN calculation_snapshot    JSONB;

-- quote FK: SET NULL → RESTRICT (constraint name from 0000 baseline)
ALTER TABLE order_items DROP CONSTRAINT order_items_quote_id_quotes_id_fk;
ALTER TABLE order_items ADD CONSTRAINT fk_order_items_quote
  FOREIGN KEY (quote_id) REFERENCES quotes(id) ON DELETE RESTRICT;

ALTER TABLE order_items
  ADD CONSTRAINT chk_order_items_operation CHECK (operation IN ('REGISTER','RENEW','TRANSFER','RESTORE')),
  ADD CONSTRAINT chk_order_items_pricing_version CHECK (pricing_version IN (0, 1)),
  ADD CONSTRAINT chk_order_items_v1_complete CHECK (pricing_version = 0 OR (
        pricing_version = 1
    AND quote_id IS NOT NULL
    AND quote_pricing_version IS NOT NULL AND quote_pricing_version = pricing_version
    AND engine_version IS NOT NULL AND engine_version = 1
    AND years = 1
    AND is_premium = false
    AND domain = lower(domain)
    AND tld_id IS NOT NULL
    AND provider_price_id IS NOT NULL
    AND provider_cost_minor >= 0
    AND provider_cost_currency IS NOT NULL AND provider_cost_currency ~ '^[A-Z]{3}$'
    AND currency ~ '^[A-Z]{3}$'
    AND converted_cost_minor IS NOT NULL AND converted_cost_minor >= 0
    AND markup_minor IS NOT NULL
    AND retail_amount_minor IS NOT NULL AND retail_amount_minor >= 0
    AND retail_amount_minor = converted_cost_minor + markup_minor
    AND discount_minor >= 0 AND discount_minor <= retail_amount_minor
    AND tax_minor >= 0
    AND tax_mode IS NOT NULL AND tax_mode IN ('DISABLED','ENFORCED')
    AND tax_treatment IS NOT NULL AND tax_treatment IN ('NONE','EXCLUSIVE')
    AND (tax_mode <> 'DISABLED' OR (tax_treatment = 'NONE' AND tax_minor = 0))
    AND (tax_mode <> 'ENFORCED' OR tax_treatment = 'EXCLUSIVE')
    AND amount_minor = retail_amount_minor - discount_minor
                       + CASE WHEN tax_treatment = 'EXCLUSIVE' THEN tax_minor ELSE 0 END
    AND amount_minor >= 0
    AND pricing_rule_id IS NOT NULL AND pricing_rule_version IS NOT NULL
    AND ((promotion_id IS NULL AND promotion_version IS NULL AND discount_minor = 0)
      OR (promotion_id IS NOT NULL AND promotion_version IS NOT NULL))
    AND calculation_snapshot IS NOT NULL AND jsonb_typeof(calculation_snapshot) = 'object')),
  ADD CONSTRAINT chk_order_items_v1_fx CHECK (pricing_version = 0 OR (
       (provider_cost_currency = currency
        AND fx_rate_id IS NULL AND fx_rate IS NULL AND fx_source IS NULL AND fx_observed_at IS NULL
        AND converted_cost_minor = provider_cost_minor)
    OR (provider_cost_currency <> currency
        AND fx_rate_id IS NOT NULL AND fx_rate IS NOT NULL AND fx_rate > 0
        AND fx_source IS NOT NULL AND fx_observed_at IS NOT NULL)));

CREATE UNIQUE INDEX uq_order_items_quote ON order_items (quote_id) WHERE quote_id IS NOT NULL;
CREATE UNIQUE INDEX uq_order_items_order_domain_op ON order_items (order_id, lower(domain), operation);
CREATE INDEX idx_order_items_order ON order_items (order_id);

CREATE TABLE order_item_tax_lines (
  order_item_id     UUID NOT NULL REFERENCES order_items(id) ON DELETE RESTRICT,
  line_no           SMALLINT NOT NULL,
  tax_rule_id       UUID NOT NULL REFERENCES tax_rules(id) ON DELETE RESTRICT,
  tax_rule_version  INTEGER NOT NULL,
  tax_code          VARCHAR(30) NOT NULL,
  display_name      VARCHAR(100) NOT NULL,
  rate_bps          INTEGER NOT NULL,
  treatment         VARCHAR(10) NOT NULL,
  amount_minor      BIGINT NOT NULL,
  PRIMARY KEY (order_item_id, line_no),
  CONSTRAINT chk_oitl_line_no CHECK (line_no >= 1),
  CONSTRAINT chk_oitl_rate CHECK (rate_bps BETWEEN 0 AND 10000),
  CONSTRAINT chk_oitl_treatment CHECK (treatment = 'EXCLUSIVE'),
  CONSTRAINT chk_oitl_amount CHECK (amount_minor >= 0)
);

-- ════════════════════════════════════════════════════════════════
-- 11. PROMOTION REDEMPTIONS (after orders/order_items exist)
-- ════════════════════════════════════════════════════════════════
CREATE TABLE promotion_redemptions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  promotion_id   UUID NOT NULL REFERENCES promotions(id) ON DELETE RESTRICT,
  user_id        UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  order_id       UUID NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  order_item_id  UUID NOT NULL REFERENCES order_items(id) ON DELETE RESTRICT,
  status         VARCHAR(20) NOT NULL,
  discount_minor BIGINT NOT NULL,
  currency       VARCHAR(3) NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  consumed_at    TIMESTAMPTZ,
  released_at    TIMESTAMPTZ,
  CONSTRAINT uq_promotion_redemptions_item UNIQUE (order_item_id),
  CONSTRAINT chk_pr_status CHECK (status IN ('RESERVED','CONSUMED','RELEASED')),
  CONSTRAINT chk_pr_discount CHECK (discount_minor >= 0),
  CONSTRAINT chk_pr_currency CHECK (currency ~ '^[A-Z]{3}$'),
  CONSTRAINT chk_pr_timestamps CHECK (
       (status = 'RESERVED' AND consumed_at IS NULL     AND released_at IS NULL)
    OR (status = 'CONSUMED' AND consumed_at IS NOT NULL AND released_at IS NULL)
    OR (status = 'RELEASED' AND consumed_at IS NULL     AND released_at IS NOT NULL))
);
CREATE INDEX idx_pr_promo_user_active ON promotion_redemptions (promotion_id, user_id)
  WHERE status <> 'RELEASED';
CREATE INDEX idx_pr_order ON promotion_redemptions (order_id);

-- ════════════════════════════════════════════════════════════════
-- 12. USER CURRENCY PREFERENCE
-- ════════════════════════════════════════════════════════════════
ALTER TABLE user_profiles
  ADD COLUMN preferred_currency VARCHAR(3),
  ADD COLUMN preferred_currency_source VARCHAR(20);
ALTER TABLE user_profiles
  ADD CONSTRAINT chk_user_profiles_pref_ccy CHECK (preferred_currency IS NULL
    OR preferred_currency ~ '^[A-Z]{3}$'),
  ADD CONSTRAINT chk_user_profiles_pref_src CHECK (
       (preferred_currency IS NULL AND preferred_currency_source IS NULL)
    OR (preferred_currency IS NOT NULL
        AND preferred_currency_source IN ('USER_SELECTED','GEO_DEFAULT')));

-- ════════════════════════════════════════════════════════════════
-- 13. FUNCTIONS & TRIGGERS
-- Error codes: P7001 immutable column, P7002 illegal quote transition,
-- P7003 immutable order column, P7004 illegal order transition,
-- P7005 immutable order item column, P7006 append-only, P7007 reference mismatch,
-- P7008 illegal redemption transition, P7010 deferred integrity failure
-- ════════════════════════════════════════════════════════════════

-- 13.1 Append-only guard (fx_rates, tax lines)
CREATE FUNCTION commerce_forbid_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION '% on % is not permitted (append-only)', TG_OP, TG_TABLE_NAME
    USING ERRCODE = 'P7006';
END $$;

CREATE TRIGGER trg_fx_rates_append_only BEFORE UPDATE OR DELETE ON fx_rates
  FOR EACH ROW EXECUTE FUNCTION commerce_forbid_mutation();
CREATE TRIGGER trg_quote_tax_lines_append_only BEFORE UPDATE OR DELETE ON quote_tax_lines
  FOR EACH ROW EXECUTE FUNCTION commerce_forbid_mutation();
CREATE TRIGGER trg_order_item_tax_lines_append_only BEFORE UPDATE OR DELETE ON order_item_tax_lines
  FOR EACH ROW EXECUTE FUNCTION commerce_forbid_mutation();

-- 13.2 Quotes — insert validation (DB timestamps, FX/price/rule/promo consistency)
CREATE FUNCTION quotes_validate_insert() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  fx  fx_rates%ROWTYPE;
  pp  registrar_provider_prices%ROWTYPE;
  v   INTEGER;
BEGIN
  IF NEW.pricing_version <> 1 THEN
    RAISE EXCEPTION 'new quotes must use pricing_version 1' USING ERRCODE = 'P7007';
  END IF;
  IF NEW.status <> 'ACTIVE' OR NEW.created_at <> now() OR NEW.expires_at <= now() THEN
    RAISE EXCEPTION 'quote must be ACTIVE with DB-authoritative timestamps' USING ERRCODE = 'P7007';
  END IF;
  IF (NEW.calculation_snapshot->>'quotedAt')::timestamptz IS DISTINCT FROM NEW.created_at THEN
    RAISE EXCEPTION 'snapshot quotedAt must equal created_at' USING ERRCODE = 'P7007';
  END IF;

  SELECT * INTO pp FROM registrar_provider_prices WHERE id = NEW.provider_price_id;
  IF NOT FOUND OR pp.tld_id <> NEW.tld_id OR pp.registrar_provider_id <> NEW.registrar_provider_id
     OR pp.operation <> NEW.operation OR pp.years <> NEW.years
     OR pp.provider_cost_currency <> NEW.provider_cost_currency
     OR pp.provider_cost_minor <> NEW.provider_cost_minor
     OR pp.observed_at IS DISTINCT FROM NEW.provider_price_observed_at
     OR NOT pp.is_available THEN
    RAISE EXCEPTION 'quote provider price does not match source row' USING ERRCODE = 'P7007';
  END IF;

  IF NEW.fx_rate_id IS NOT NULL THEN
    SELECT * INTO fx FROM fx_rates WHERE id = NEW.fx_rate_id;
    IF NOT FOUND OR fx.base_currency <> NEW.provider_cost_currency OR fx.quote_currency <> NEW.currency
       OR fx.rate <> NEW.fx_rate OR fx.source <> NEW.fx_source OR fx.observed_at <> NEW.fx_observed_at THEN
      RAISE EXCEPTION 'quote FX snapshot does not match fx_rates row' USING ERRCODE = 'P7007';
    END IF;
  END IF;

  SELECT version INTO v FROM pricing_rules WHERE id = NEW.pricing_rule_id;
  IF NOT FOUND OR v <> NEW.pricing_rule_version THEN
    RAISE EXCEPTION 'quote pricing rule version mismatch' USING ERRCODE = 'P7007';
  END IF;

  IF NEW.promotion_id IS NOT NULL THEN
    SELECT version INTO v FROM promotions WHERE id = NEW.promotion_id;
    IF NOT FOUND OR v <> NEW.promotion_version THEN
      RAISE EXCEPTION 'quote promotion version mismatch' USING ERRCODE = 'P7007';
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_quotes_validate_insert BEFORE INSERT ON quotes
  FOR EACH ROW EXECUTE FUNCTION quotes_validate_insert();

-- 13.3 Quotes — update guard (allowlist + explicit transitions)
CREATE FUNCTION quotes_guard_update() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  mutable CONSTANT TEXT[] := ARRAY['status','consumed_at','invalidated_at','invalidated_by','invalidation_reason'];
BEGIN
  IF OLD.pricing_version = 0 THEN
    RAISE EXCEPTION 'legacy quotes are read-only' USING ERRCODE = 'P7001';
  END IF;
  IF (to_jsonb(NEW) - mutable) IS DISTINCT FROM (to_jsonb(OLD) - mutable) THEN
    RAISE EXCEPTION 'quote pricing snapshot is immutable' USING ERRCODE = 'P7001';
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NOT (OLD.status = 'ACTIVE' AND NEW.status IN ('CONSUMED','INVALIDATED')) THEN
      RAISE EXCEPTION 'illegal quote transition % -> %', OLD.status, NEW.status USING ERRCODE = 'P7002';
    END IF;
  ELSIF (NEW.consumed_at, NEW.invalidated_at, NEW.invalidated_by, NEW.invalidation_reason)
        IS DISTINCT FROM (OLD.consumed_at, OLD.invalidated_at, OLD.invalidated_by, OLD.invalidation_reason) THEN
    RAISE EXCEPTION 'quote lifecycle fields are immutable once set' USING ERRCODE = 'P7002';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_quotes_guard_update BEFORE UPDATE ON quotes
  FOR EACH ROW EXECUTE FUNCTION quotes_guard_update();

CREATE FUNCTION commerce_forbid_v1_delete() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.pricing_version >= 1 THEN
    RAISE EXCEPTION 'DELETE of priced % rows is not permitted', TG_TABLE_NAME USING ERRCODE = 'P7006';
  END IF;
  RETURN OLD;
END $$;

CREATE TRIGGER trg_quotes_forbid_delete BEFORE DELETE ON quotes
  FOR EACH ROW EXECUTE FUNCTION commerce_forbid_v1_delete();
CREATE TRIGGER trg_orders_forbid_delete BEFORE DELETE ON orders
  FOR EACH ROW EXECUTE FUNCTION commerce_forbid_v1_delete();
CREATE TRIGGER trg_order_items_forbid_delete BEFORE DELETE ON order_items
  FOR EACH ROW EXECUTE FUNCTION commerce_forbid_v1_delete();

-- 13.4 Orders — update guard (allowlist + documented state machine), V1 only
CREATE FUNCTION orders_guard_update() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  mutable CONSTANT TEXT[] := ARRAY['status','updated_at','completed_at','submitted_at',
                                   'cancelled_at','cancellation_reason'];
BEGIN
  IF OLD.pricing_version = 0 THEN
    RETURN NEW;                                   -- legacy / Phase 6 rows unaffected
  END IF;
  IF (to_jsonb(NEW) - mutable) IS DISTINCT FROM (to_jsonb(OLD) - mutable) THEN
    RAISE EXCEPTION 'order pricing columns are immutable' USING ERRCODE = 'P7003';
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status AND (OLD.status, NEW.status) NOT IN (
      ('DRAFT','PENDING_PAYMENT'), ('DRAFT','CANCELLED'),
      ('PENDING_PAYMENT','PROCESSING'), ('PENDING_PAYMENT','CANCELLED'),
      ('PROCESSING','COMPLETED'), ('PROCESSING','FAILED'),
      ('FAILED','REFUND_REQUIRED'), ('REFUND_REQUIRED','REFUND_PENDING'),
      ('REFUND_PENDING','REFUNDED'), ('REFUND_PENDING','PARTIALLY_REFUNDED')) THEN
    RAISE EXCEPTION 'illegal order transition % -> %', OLD.status, NEW.status USING ERRCODE = 'P7004';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_orders_guard_update BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION orders_guard_update();

-- 13.5 Order items — insert must equal its quote; update allowlist preserves Phase 6 link
CREATE FUNCTION order_items_validate_insert() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  q  quotes%ROWTYPE;
  o  orders%ROWTYPE;
BEGIN
  IF NEW.pricing_version = 0 THEN
    RETURN NEW;                                   -- legacy / Phase 6 fixture inserts
  END IF;
  SELECT * INTO o FROM orders WHERE id = NEW.order_id;
  IF NOT FOUND OR o.pricing_version <> 1 OR o.status <> 'DRAFT' OR o.currency <> NEW.currency THEN
    RAISE EXCEPTION 'order item requires a V1 DRAFT order in the same currency' USING ERRCODE = 'P7007';
  END IF;
  SELECT * INTO q FROM quotes WHERE id = NEW.quote_id;
  IF NOT FOUND OR q.status <> 'ACTIVE' OR q.expires_at <= now() OR q.user_id <> o.user_id
     OR q.pricing_version <> NEW.quote_pricing_version THEN
    RAISE EXCEPTION 'order item quote is not usable' USING ERRCODE = 'P7007';
  END IF;
  IF (NEW.domain, NEW.operation, NEW.years, NEW.currency, NEW.is_premium, NEW.registrar_provider_id,
      NEW.tld_id, NEW.provider_price_id, NEW.provider_cost_minor, NEW.provider_cost_currency,
      NEW.fx_rate_id, NEW.fx_rate, NEW.fx_source, NEW.fx_observed_at,
      NEW.converted_cost_minor, NEW.retail_amount_minor, NEW.markup_minor, NEW.discount_minor,
      NEW.tax_minor, NEW.tax_mode, NEW.tax_treatment, NEW.amount_minor,
      NEW.pricing_rule_id, NEW.pricing_rule_version, NEW.promotion_id, NEW.promotion_version,
      NEW.engine_version, NEW.calculation_snapshot)
     IS DISTINCT FROM
     (q.domain, q.operation, q.years, q.currency, q.is_premium, q.registrar_provider_id,
      q.tld_id, q.provider_price_id, q.provider_cost_minor, q.provider_cost_currency,
      q.fx_rate_id, q.fx_rate, q.fx_source, q.fx_observed_at,
      q.converted_cost_minor, q.retail_amount_minor, q.markup_minor, q.discount_minor,
      q.tax_minor, q.tax_mode, q.tax_treatment, q.final_amount_minor,
      q.pricing_rule_id, q.pricing_rule_version, q.promotion_id, q.promotion_version,
      q.engine_version, q.calculation_snapshot) THEN
    RAISE EXCEPTION 'order item snapshot must equal its quote' USING ERRCODE = 'P7007';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_order_items_validate_insert BEFORE INSERT ON order_items
  FOR EACH ROW EXECUTE FUNCTION order_items_validate_insert();

CREATE FUNCTION order_items_guard_update() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  -- Explicit allowlist. Future lifecycle columns must be added here by their own migration
  -- (enforced by the column-classification test).
  mutable CONSTANT TEXT[] := ARRAY['registrar_operation_id'];
BEGIN
  IF OLD.pricing_version = 0 THEN
    RETURN NEW;
  END IF;
  IF (to_jsonb(NEW) - mutable) IS DISTINCT FROM (to_jsonb(OLD) - mutable) THEN
    RAISE EXCEPTION 'order item pricing snapshot is immutable' USING ERRCODE = 'P7005';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_order_items_guard_update BEFORE UPDATE ON order_items
  FOR EACH ROW EXECUTE FUNCTION order_items_guard_update();

-- 13.6 Promotion redemptions — insert consistency, transitions, counter maintenance
CREATE FUNCTION promotion_redemptions_validate() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  oi  order_items%ROWTYPE;
  o   orders%ROWTYPE;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status <> 'RESERVED' THEN
      RAISE EXCEPTION 'redemptions must be created RESERVED' USING ERRCODE = 'P7008';
    END IF;
    SELECT * INTO oi FROM order_items WHERE id = NEW.order_item_id;
    SELECT * INTO o  FROM orders WHERE id = NEW.order_id;
    IF oi.id IS NULL OR o.id IS NULL OR oi.order_id <> NEW.order_id
       OR oi.promotion_id IS DISTINCT FROM NEW.promotion_id
       OR oi.discount_minor <> NEW.discount_minor OR oi.currency <> NEW.currency
       OR o.user_id <> NEW.user_id THEN
      RAISE EXCEPTION 'redemption does not match its order item' USING ERRCODE = 'P7007';
    END IF;
    RETURN NEW;
  END IF;

  -- UPDATE: only RESERVED -> CONSUMED | RELEASED; identity/amount columns immutable
  IF (NEW.id, NEW.promotion_id, NEW.user_id, NEW.order_id, NEW.order_item_id,
      NEW.discount_minor, NEW.currency, NEW.created_at)
     IS DISTINCT FROM
     (OLD.id, OLD.promotion_id, OLD.user_id, OLD.order_id, OLD.order_item_id,
      OLD.discount_minor, OLD.currency, OLD.created_at) THEN
    RAISE EXCEPTION 'redemption identity is immutable' USING ERRCODE = 'P7008';
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NOT (OLD.status = 'RESERVED' AND NEW.status IN ('CONSUMED','RELEASED')) THEN
      RAISE EXCEPTION 'illegal redemption transition % -> %', OLD.status, NEW.status
        USING ERRCODE = 'P7008';
    END IF;
  ELSIF (NEW.consumed_at, NEW.released_at) IS DISTINCT FROM (OLD.consumed_at, OLD.released_at) THEN
    RAISE EXCEPTION 'redemption timestamps are immutable' USING ERRCODE = 'P7008';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_pr_validate BEFORE INSERT OR UPDATE ON promotion_redemptions
  FOR EACH ROW EXECUTE FUNCTION promotion_redemptions_validate();
CREATE TRIGGER trg_pr_forbid_delete BEFORE DELETE ON promotion_redemptions
  FOR EACH ROW EXECUTE FUNCTION commerce_forbid_mutation();

CREATE FUNCTION promotion_redemptions_counter() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- conditional increment: chk_promotions_within_limit rejects overshoot (23514)
    UPDATE promotions SET redemption_count = redemption_count + 1 WHERE id = NEW.promotion_id;
  ELSIF OLD.status = 'RESERVED' AND NEW.status = 'RELEASED' THEN
    -- exactly-once decrement; chk_promotions_count_nonneg surfaces drift (23514)
    UPDATE promotions SET redemption_count = redemption_count - 1 WHERE id = NEW.promotion_id;
  END IF;
  -- RESERVED -> CONSUMED: counter unchanged
  RETURN NULL;
END $$;

CREATE TRIGGER trg_pr_counter AFTER INSERT OR UPDATE OF status ON promotion_redemptions
  FOR EACH ROW EXECUTE FUNCTION promotion_redemptions_counter();

-- 13.7 Deferred integrity assertions (not FKs; run at COMMIT)
CREATE FUNCTION quotes_assert_tax_lines() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  n    INTEGER;
  s    BIGINT;
  q    quotes%ROWTYPE;
BEGIN
  SELECT * INTO q FROM quotes WHERE id = NEW.id;
  IF q.pricing_version = 0 THEN RETURN NULL; END IF;
  SELECT count(*), COALESCE(sum(amount_minor), 0) INTO n, s FROM quote_tax_lines WHERE quote_id = q.id;
  IF s <> q.tax_minor
     OR (q.tax_mode = 'DISABLED' AND n <> 0)
     OR (q.tax_mode = 'ENFORCED' AND n = 0) THEN
    RAISE EXCEPTION 'quote % tax lines inconsistent', q.id USING ERRCODE = 'P7010';
  END IF;
  RETURN NULL;
END $$;

CREATE CONSTRAINT TRIGGER trg_quotes_assert_tax_lines AFTER INSERT ON quotes
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION quotes_assert_tax_lines();

CREATE FUNCTION commerce_assert_order(p_order_id UUID) RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE
  o  orders%ROWTYPE;
  s  RECORD;
BEGIN
  SELECT * INTO o FROM orders WHERE id = p_order_id;
  IF NOT FOUND OR o.pricing_version = 0 THEN RETURN; END IF;
  SELECT count(*)                                   AS n,
         COALESCE(sum(retail_amount_minor), 0)      AS sub,
         COALESCE(sum(discount_minor), 0)           AS disc,
         COALESCE(sum(tax_minor), 0)                AS tax,
         COALESCE(sum(amount_minor), 0)             AS tot,
         count(*) FILTER (WHERE currency <> o.currency OR pricing_version <> o.pricing_version) AS bad
    INTO s FROM order_items WHERE order_id = p_order_id;
  IF s.n = 0 OR s.bad > 0 OR s.sub <> o.subtotal_minor OR s.disc <> o.discount_minor
     OR s.tax <> o.tax_minor OR s.tot <> o.total_minor THEN
    RAISE EXCEPTION 'order % totals do not match its items', p_order_id USING ERRCODE = 'P7010';
  END IF;
END $$;

CREATE FUNCTION orders_assert_totals() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM commerce_assert_order(NEW.id);
  RETURN NULL;
END $$;

CREATE CONSTRAINT TRIGGER trg_orders_assert_totals AFTER INSERT ON orders
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION orders_assert_totals();

CREATE FUNCTION order_items_assert_committed() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  qs   VARCHAR(20);
  n    INTEGER;
  s    BIGINT;
BEGIN
  IF NEW.pricing_version = 0 THEN RETURN NULL; END IF;
  SELECT status INTO qs FROM quotes WHERE id = NEW.quote_id;
  IF qs IS DISTINCT FROM 'CONSUMED' THEN
    RAISE EXCEPTION 'order item % quote not consumed at commit', NEW.id USING ERRCODE = 'P7010';
  END IF;
  SELECT count(*), COALESCE(sum(amount_minor), 0) INTO n, s
    FROM order_item_tax_lines WHERE order_item_id = NEW.id;
  IF s <> NEW.tax_minor OR (NEW.tax_mode = 'DISABLED' AND n <> 0)
     OR (NEW.tax_mode = 'ENFORCED' AND n = 0) THEN
    RAISE EXCEPTION 'order item % tax lines inconsistent', NEW.id USING ERRCODE = 'P7010';
  END IF;
  PERFORM commerce_assert_order(NEW.order_id);
  RETURN NULL;
END $$;

CREATE CONSTRAINT TRIGGER trg_order_items_assert_committed AFTER INSERT ON order_items
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION order_items_assert_committed();

COMMIT;
```

**Notes on Appendix A:**

- **Placement of the deferred triggers.** The `CONSTRAINT TRIGGER`s are integrity *assertions* evaluated at commit. They are not deferred FKs. Every FK stays immediate, and checkout satisfies them through its insert order (§15.2).
- **Why the default is dropped on quotes only.** `quotes.pricing_version` has no default after the migration, because no existing code inserts quotes, so new inserts must be explicit. `orders` and `order_items` keep `DEFAULT 0` because Phase 6 fixtures insert legacy-shaped rows without the column.
- **Counter trigger scope.** `trg_pr_counter` fires on `UPDATE OF status`, so timestamp-only updates cannot move the counter. The BEFORE trigger rejects those anyway.
- **Snapshot comparison.** Comparing `calculation_snapshot` as `jsonb` compares values, not whitespace or key order, so a faithful copy always compares equal.
- **Executability.** During implementation this SQL is run with `ON_ERROR_STOP=1` against a clean DB and a Phase 6 DB before it is committed. Any correction found there is applied to this appendix as well.
