# Phase 7 — Retail Pricing, Quotes & Checkout Foundation

**Status:** PLAN FOR REVIEW. No implementation code has been written.
**Baseline:** `main` @ `0a76dce` (Phase 6 locked: 811 passed / 88 skipped / 0 failed).
**Scope boundary:** ends at `PENDING_PAYMENT`. No payment gateway, no `PROCESSING`, no fulfillment calls.

---

## 0. Decisions needed before implementation

The repo review turned up five things that the plan cannot settle alone. Each has a recommendation.

| # | Finding (verified in code) | Recommendation |
|---|---|---|
| D1 | **Operation vocabulary is inconsistent.** `OrderService.evaluateFulfillment` (`apps/api/src/modules/orders/order.service.ts:64`) counts items with `operation === 'registration' \|\| 'renewal'` as fulfillable. Phase 6 registrar ops, the Phase 6 integration tests and the sandbox canary all use `'REGISTER'`. `PAYMENTS.md §6.2` says `register`. The integration test at `phase6-integration.test.ts:~890` re-implements the evaluation logic inline (filtering on `'REGISTER'`), so it never exercised the real service and the mismatch went unnoticed. If Phase 7 writes `REGISTER` items, then once payment exists every paid order would stay `PROCESSING` forever. | Adopt `REGISTER / RENEW / TRANSFER / RESTORE` as canonical (matches `registrar_operations.operation_type`). Add a **one-line correction** to the filter in `OrderService`, plus a test that calls the real `evaluateFulfillment`. This fixes an existing defect; it does not redesign Phase 6. It needs your explicit OK because it touches a locked file. |
| D2 | **Dynadot pricing currency is assumed, not read.** `DynadotPricingFacet.getTldPrices` stamps every price with the *requested* currency (`params.currency ?? 'USD'`) and ignores `response.data.currency`, which the response type already declares. | Additive fix in the facet: use the response currency; if it is present and differs from the requested one, throw a typed provider error. Add Phase 5 regression tests. Without this, ingestion cannot meet "use the actual provider response currency". Needs your OK because it touches Phase 5 code. |
| D3 | **Multi-year semantics are unverified.** `all_years_register_price[i]` is passed through opaquely. It is not established whether index *i* is the total price for *i+1* years or a per-year price. | V1 quotes/orders support `years = 1` only. Multi-year support comes only after a sandbox check shows which it is, recorded in `DYNADOT_INTEGRATION.md`. |
| D4 | **There is no domain search service in the API or web app.** `DomainSearchCapability` exists in `registrar-core` and `registrar-dynadot`, but there is no `DomainSearchService`, no `/domain-search` endpoint, and `/domains` in the web app is an "EmptyState: coming soon" page. The brief assumes Phase 6 already has search. | Phase 7 adds a **thin** `DomainSearchService` (availability + premium flag via the provider capability, short Redis cache, rate-limited). Pricing stays in `PricingService`. The alternative is deferring the search UI, but checkout then has no entry point. |
| D5 | **Existing customer order endpoints return raw rows.** `GET /orders` and `GET /orders/:id` return Drizzle rows with `bigint` columns. There is no BigInt JSON serializer, so any non-empty result would fail to serialize. They would also expose every column. | Replace them with explicit customer DTOs (amounts as decimal-safe strings). This falls within Phase 7's customer order API scope. |

Also noted (no decision needed): `PROJECT_SPEC.md §roadmap` numbers phases differently ("6 = TLD & Pricing", "7 = Domain Search"). This plan follows your numbering.

---

## 1. Existing schema review (exact)

### `tlds` (pricing.ts)
`id, tld (unique), is_enabled, supports_privacy, supports_transfer_lock, supports_dnssec, min_registration_years, max_registration_years, is_premium_supported, created_at, updated_at`.
Enough for a catalog. It lacks a display-order field and a "last price sync" field.

### `registrar_provider_prices` (pricing.ts)
`id, tld_id→tlds, registrar_provider_id→registrar_providers, operation varchar(20), years int,`
`provider_cost_minor bigint NOT NULL, provider_cost_currency varchar(3) NOT NULL,`
`retail_price_minor bigint NOT NULL, retail_price_currency varchar(3) NOT NULL,`
`markup_type varchar(10), markup_value int, is_promotion, promotion_price_minor, promotion_starts_at, promotion_ends_at,`
`last_synced_at, created_at, updated_at`.
`UNIQUE (tld_id, registrar_provider_id, operation, years)`.

**Problem:** this table mixes wholesale data with retail, markup and promotion data, which the brief requires to be separate. Retail is also single-currency, while customer currency varies. There is no CHECK on `operation`, and no observed-at, source or availability fields.

### `quotes` (commerce.ts)
`id, user_id NOT NULL→users, domain, operation, years, retail_amount_minor, currency, provider_cost_minor, is_premium, registrar_provider_id, expires_at NOT NULL, created_at`.
Indexes: `user_id`, `expires_at`.
**Missing:** provider currency, FX snapshot, markup/discount/tax breakdown, final amount, rule references, status/consumption, version.

### `orders` (commerce.ts)
`id, user_id, status (CHECK ORDER_STATUS), currency, subtotal_minor, tax_minor, discount_minor, total_minor (default 0), created_at, updated_at, completed_at`.
**Missing:** checkout idempotency, pricing expiry, submit/cancel timestamps.

### `order_items` (commerce.ts + 0003)
`id, order_id, domain, operation, years, amount_minor, currency, is_premium, quote_id→quotes ON DELETE SET NULL, registrar_provider_id, provider_cost_minor, registrar_operation_id (unique partial, Phase 6), created_at`.
**Missing:** provider currency, FX snapshot, retail/markup/discount/tax breakdown. `quote_id` is nullable, has no uniqueness, and uses `SET NULL`, which would break the audit trail.

### Other relevant existing pieces
- `payments / refunds / invoices`: untouched in Phase 7.
- `user_profiles.country varchar(2)`: the billing-country source. There is no currency preference column.
- `audit_logs` (generic, append-only, `metadata/before_state/after_state jsonb`): reused for pricing and checkout audit events.
- `admin_actions`: reused for admin pricing mutations.
- `system_settings (key, value, value_type)`: reused for tunables (quote TTL, stale thresholds).
- `registrar-core`: `MoneyAmount {minorUnits: bigint, currency, exponent}`, `parseMoneyFromDecimal` (exact, rejects extra precision), `CURRENCY_METADATA` (ISO exponents; includes INR, USD, GBP, EUR, CAD, AUD).
- `contracts/permissions`: application-level `PERMISSIONS` plus a `ROLE_PERMISSIONS` map; `PermissionGuard` and `@RequirePermission`. SUPER_ADMIN is implicit.
- Money-column test (`money-columns.test.ts`): asserts BIGINT on `*_minor` columns. It will be extended to the new tables.
- No cart table exists and none is designed in the docs, so none will be added (§20 of brief).

---

## 2. Tables and columns reused

| Existing | Phase 7 use |
|---|---|
| `tlds` | TLD catalog. Add `display_order`, `last_price_sync_at`. |
| `registrar_provider_prices` | **Wholesale only** ("current observed provider price"). Retail, markup and promo columns become nullable and deprecated, with no writers or readers. They are dropped in a later cleanup migration, not in Phase 7. |
| `quotes.retail_amount_minor` | Retail base after markup and rounding, before discount and tax. |
| `quotes.currency` | Customer currency. |
| `quotes.provider_cost_minor` | Provider wholesale amount (paired with new `provider_cost_currency`). |
| `orders.subtotal/discount/tax/total_minor` | Sums of item snapshot values. |
| `order_items.amount_minor` | **Final item total** charged to the customer. |
| `order_items.provider_cost_minor` | Wholesale snapshot. |
| `order_items.quote_id` | Quote linkage, made unique and RESTRICT. |
| `user_profiles.country` | Billing country for currency and tax context. |
| `audit_logs`, `admin_actions`, `system_settings` | As above. |

---

## 3. Proposed migration `0004_phase7_pricing_checkout.sql`

Single transaction (`BEGIN … COMMIT`), following the style of 0003. It is additive, apart from relaxing NOT NULL on deprecated retail columns and replacing one FK.

```sql
-- 3.1 tlds
ALTER TABLE tlds ADD COLUMN display_order INTEGER NOT NULL DEFAULT 1000,
                 ADD COLUMN last_price_sync_at TIMESTAMPTZ;

-- 3.2 registrar_provider_prices → wholesale only
ALTER TABLE registrar_provider_prices
  ALTER COLUMN retail_price_minor DROP NOT NULL,
  ALTER COLUMN retail_price_currency DROP NOT NULL,
  ADD COLUMN is_available BOOLEAN NOT NULL DEFAULT true,       -- provider "--" sentinel ⇒ false, never 0
  ADD COLUMN observed_at TIMESTAMPTZ,                           -- when the provider returned this value
  ADD COLUMN source_reference VARCHAR(100),                     -- e.g. Dynadot price_level
  ADD COLUMN last_sync_run_id UUID;                             -- FK added after 3.3
ALTER TABLE registrar_provider_prices
  ADD CONSTRAINT chk_rpp_operation CHECK (operation IN ('REGISTER','RENEW','TRANSFER','RESTORE')),
  ADD CONSTRAINT chk_rpp_cost_nonneg CHECK (provider_cost_minor >= 0),
  ADD CONSTRAINT chk_rpp_currency CHECK (provider_cost_currency ~ '^[A-Z]{3}$');
-- (pre-check: migration aborts with a clear message if existing rows violate these)

-- 3.3 provider_price_sync_runs (operational visibility)
CREATE TABLE provider_price_sync_runs (
  id UUID PK, registrar_provider_id UUID NOT NULL FK RESTRICT,
  trigger VARCHAR(20) NOT NULL CHECK (trigger IN ('SCHEDULED','ADMIN')),
  triggered_by UUID FK users SET NULL,
  status VARCHAR(20) NOT NULL CHECK (status IN ('RUNNING','SUCCEEDED','PARTIAL','FAILED')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(), finished_at TIMESTAMPTZ,
  tlds_seen INT NOT NULL DEFAULT 0, rows_upserted INT NOT NULL DEFAULT 0,
  rows_unavailable INT NOT NULL DEFAULT 0, tlds_failed INT NOT NULL DEFAULT 0,
  response_currency VARCHAR(3), error_code VARCHAR(50), error_summary VARCHAR(1000)
);
-- partial unique: only one RUNNING run per provider (sync lock)
CREATE UNIQUE INDEX uq_price_sync_running ON provider_price_sync_runs(registrar_provider_id) WHERE status='RUNNING';

-- 3.4 fx_rates (append-only snapshots)
CREATE TABLE fx_rates (
  id UUID PK,
  base_currency VARCHAR(3) NOT NULL, quote_currency VARCHAR(3) NOT NULL,
  rate NUMERIC(24,12) NOT NULL CHECK (rate > 0),     -- 1 base = rate quote; never read as JS float
  source VARCHAR(50) NOT NULL,                        -- 'MANUAL', later vendor id
  source_reference VARCHAR(100),
  observed_at TIMESTAMPTZ NOT NULL,                   -- vendor/admin timestamp
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  valid_until TIMESTAMPTZ NOT NULL,
  created_by UUID FK users SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (base_currency <> quote_currency)
);
CREATE INDEX idx_fx_rates_pair_latest ON fx_rates(base_currency, quote_currency, observed_at DESC);

-- 3.5 pricing_rules (markup)
CREATE TABLE pricing_rules (
  id UUID PK,
  tld_id UUID NULL FK RESTRICT,                  -- NULL = global
  operation VARCHAR(20) NULL CHECK (operation IS NULL OR operation IN ('REGISTER','RENEW','TRANSFER','RESTORE')),
  strategy VARCHAR(20) NOT NULL CHECK (strategy IN ('FIXED','PERCENT','MAX_FIXED_PERCENT','RETAIL_OVERRIDE')),
  percent_bps INT NULL CHECK (percent_bps IS NULL OR percent_bps BETWEEN 0 AND 100000),
  rounding_increment_minor BIGINT NULL CHECK (rounding_increment_minor IS NULL OR rounding_increment_minor > 0),
  allow_below_cost BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  version INT NOT NULL DEFAULT 1,
  created_by, updated_by UUID FK users SET NULL, created_at, updated_at
);
-- one active rule per scope (NULLs normalised)
CREATE UNIQUE INDEX uq_pricing_rules_scope ON pricing_rules
  (COALESCE(tld_id,'00000000-0000-0000-0000-000000000000'), COALESCE(operation,'*')) WHERE is_active;

CREATE TABLE pricing_rule_amounts (           -- currency-aware fixed / override amounts
  pricing_rule_id UUID FK CASCADE, currency VARCHAR(3), amount_minor BIGINT NOT NULL CHECK (amount_minor >= 0),
  PRIMARY KEY (pricing_rule_id, currency)
);

-- 3.6 promotions
CREATE TABLE promotions (
  id UUID PK, code VARCHAR(40) NULL,            -- NULL = automatic
  code_canonical VARCHAR(40) NULL,              -- upper(trim(code))
  name VARCHAR(100) NOT NULL,
  kind VARCHAR(10) NOT NULL CHECK (kind IN ('FIXED','PERCENT')),
  percent_bps INT NULL CHECK (percent_bps BETWEEN 1 AND 10000),
  tld_ids UUID[] NULL, operations VARCHAR(20)[] NULL, currencies VARCHAR(3)[] NULL,
  starts_at TIMESTAMPTZ NOT NULL, ends_at TIMESTAMPTZ NULL CHECK (ends_at IS NULL OR ends_at > starts_at),
  usage_limit INT NULL CHECK (usage_limit > 0), per_user_limit INT NULL CHECK (per_user_limit > 0),
  redemption_count INT NOT NULL DEFAULT 0 CHECK (redemption_count >= 0),
  priority INT NOT NULL DEFAULT 100, is_active BOOLEAN NOT NULL DEFAULT true,
  version INT NOT NULL DEFAULT 1, created_by, updated_by, created_at, updated_at,
  CHECK (usage_limit IS NULL OR redemption_count <= usage_limit)
);
CREATE UNIQUE INDEX uq_promotions_code ON promotions(code_canonical) WHERE code_canonical IS NOT NULL;

CREATE TABLE promotion_currency_amounts (      -- fixed discount / min amount / max cap per currency
  promotion_id UUID FK CASCADE, currency VARCHAR(3),
  fixed_discount_minor BIGINT NULL CHECK (>= 0), min_amount_minor BIGINT NULL CHECK (>= 0),
  max_discount_minor BIGINT NULL CHECK (>= 0),
  PRIMARY KEY (promotion_id, currency)
);

CREATE TABLE promotion_redemptions (
  id UUID PK, promotion_id UUID NOT NULL FK RESTRICT, user_id UUID NOT NULL FK RESTRICT,
  order_id UUID NOT NULL FK RESTRICT, order_item_id UUID NOT NULL FK RESTRICT,
  status VARCHAR(20) NOT NULL CHECK (status IN ('RESERVED','CONSUMED','RELEASED')),
  discount_minor BIGINT NOT NULL CHECK (discount_minor >= 0), currency VARCHAR(3) NOT NULL,
  created_at, released_at TIMESTAMPTZ, consumed_at TIMESTAMPTZ,
  UNIQUE (order_item_id)                        -- one promo per item in V1
);
CREATE INDEX idx_promo_redemptions_user ON promotion_redemptions(promotion_id, user_id) WHERE status <> 'RELEASED';

-- 3.7 tax_rules
CREATE TABLE tax_rules (
  id UUID PK, country VARCHAR(2) NOT NULL, region VARCHAR(50) NULL,
  tax_code VARCHAR(30) NOT NULL,                -- admin label, e.g. 'VAT_STANDARD'; no legal claim implied
  display_name VARCHAR(100) NOT NULL,           -- customer-visible line label
  rate_bps INT NOT NULL CHECK (rate_bps BETWEEN 0 AND 10000),
  treatment VARCHAR(10) NOT NULL CHECK (treatment IN ('EXCLUSIVE','INCLUSIVE')),
  operations VARCHAR(20)[] NULL, customer_type VARCHAR(20) NULL,
  effective_from TIMESTAMPTZ NOT NULL, effective_to TIMESTAMPTZ NULL,
  is_active BOOLEAN NOT NULL DEFAULT true, version INT NOT NULL DEFAULT 1,
  created_by, updated_by, created_at, updated_at
);
CREATE INDEX idx_tax_rules_lookup ON tax_rules(country, region) WHERE is_active;

-- 3.8 quotes (extend)
ALTER TABLE quotes
  ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','CONSUMED','INVALIDATED')),
  ADD COLUMN pricing_version INT NOT NULL DEFAULT 0,      -- 0 = legacy row; never checkout-able
  ADD COLUMN tld_id UUID FK tlds RESTRICT,
  ADD COLUMN provider_cost_currency VARCHAR(3),
  ADD COLUMN provider_price_id UUID,                       -- ref only (row is mutable; values are copied)
  ADD COLUMN provider_price_observed_at TIMESTAMPTZ,
  ADD COLUMN fx_rate_id UUID FK fx_rates RESTRICT,
  ADD COLUMN fx_rate NUMERIC(24,12), ADD COLUMN fx_source VARCHAR(50), ADD COLUMN fx_observed_at TIMESTAMPTZ,
  ADD COLUMN converted_cost_minor BIGINT,                  -- provider cost in customer currency
  ADD COLUMN markup_minor BIGINT, ADD COLUMN discount_minor BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN tax_minor BIGINT NOT NULL DEFAULT 0, ADD COLUMN tax_treatment VARCHAR(10),
  ADD COLUMN final_amount_minor BIGINT,
  ADD COLUMN pricing_rule_id UUID, ADD COLUMN pricing_rule_version INT,
  ADD COLUMN promotion_id UUID, ADD COLUMN promotion_version INT, ADD COLUMN promo_code_entered VARCHAR(40),
  ADD COLUMN tax_country VARCHAR(2), ADD COLUMN tax_region VARCHAR(50),
  ADD COLUMN currency_source VARCHAR(20),                  -- which resolver tier chose the currency
  ADD COLUMN calculation_snapshot JSONB,                   -- full self-describing breakdown (§22)
  ADD COLUMN consumed_at TIMESTAMPTZ;
-- v1 rows must be complete and arithmetically consistent:
ALTER TABLE quotes ADD CONSTRAINT chk_quotes_v1_complete CHECK (pricing_version = 0 OR (
  provider_cost_currency IS NOT NULL AND converted_cost_minor IS NOT NULL AND markup_minor IS NOT NULL
  AND final_amount_minor IS NOT NULL AND calculation_snapshot IS NOT NULL AND tld_id IS NOT NULL
  AND discount_minor >= 0 AND discount_minor <= retail_amount_minor AND tax_minor >= 0
  AND retail_amount_minor = converted_cost_minor + markup_minor
  AND final_amount_minor = retail_amount_minor - discount_minor
                           + CASE WHEN tax_treatment='EXCLUSIVE' THEN tax_minor ELSE 0 END
  AND final_amount_minor >= 0
  AND (fx_rate_id IS NULL) = (provider_cost_currency = currency)));
ALTER TABLE quotes ADD CONSTRAINT chk_quotes_expiry CHECK (expires_at > created_at);

-- 3.9 orders (extend)
ALTER TABLE orders
  ADD COLUMN pricing_version INT NOT NULL DEFAULT 0,
  ADD COLUMN checkout_idempotency_key VARCHAR(100),
  ADD COLUMN checkout_request_hash VARCHAR(64),
  ADD COLUMN pricing_expires_at TIMESTAMPTZ,
  ADD COLUMN submitted_at TIMESTAMPTZ, ADD COLUMN cancelled_at TIMESTAMPTZ,
  ADD COLUMN cancellation_reason VARCHAR(50);
CREATE UNIQUE INDEX uq_orders_checkout_idem ON orders(user_id, checkout_idempotency_key)
  WHERE checkout_idempotency_key IS NOT NULL;
ALTER TABLE orders ADD CONSTRAINT chk_orders_amounts_nonneg
  CHECK (subtotal_minor >= 0 AND discount_minor >= 0 AND tax_minor >= 0 AND total_minor >= 0);
CREATE INDEX idx_orders_pricing_expiry ON orders(pricing_expires_at) WHERE status IN ('DRAFT','PENDING_PAYMENT');

-- 3.10 order_items (extend)
ALTER TABLE order_items
  ADD COLUMN pricing_version INT NOT NULL DEFAULT 0,
  ADD COLUMN tld_id UUID, ADD COLUMN provider_cost_currency VARCHAR(3),
  ADD COLUMN fx_rate_id UUID, ADD COLUMN fx_rate NUMERIC(24,12), ADD COLUMN fx_source VARCHAR(50), ADD COLUMN fx_observed_at TIMESTAMPTZ,
  ADD COLUMN converted_cost_minor BIGINT, ADD COLUMN retail_subtotal_minor BIGINT, ADD COLUMN markup_minor BIGINT,
  ADD COLUMN discount_minor BIGINT NOT NULL DEFAULT 0, ADD COLUMN tax_minor BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN tax_treatment VARCHAR(10),
  ADD COLUMN pricing_rule_id UUID, ADD COLUMN promotion_id UUID,
  ADD COLUMN quote_pricing_version INT, ADD COLUMN calculation_snapshot JSONB;
-- same completeness/arithmetic CHECK as quotes for pricing_version >= 1 (amount_minor = final)
ALTER TABLE order_items DROP CONSTRAINT <existing quote FK>;
ALTER TABLE order_items ADD CONSTRAINT fk_order_items_quote FOREIGN KEY (quote_id) REFERENCES quotes(id) ON DELETE RESTRICT;
CREATE UNIQUE INDEX uq_order_items_quote ON order_items(quote_id) WHERE quote_id IS NOT NULL;   -- a quote is consumed once
CREATE UNIQUE INDEX uq_order_items_order_domain_op ON order_items(order_id, lower(domain), operation);

-- 3.11 user currency preference
ALTER TABLE user_profiles ADD COLUMN preferred_currency VARCHAR(3),
  ADD COLUMN preferred_currency_source VARCHAR(20);        -- 'USER_SELECTED' | 'GEO_DEFAULT'

-- 3.12 immutability triggers (see §12)
CREATE FUNCTION forbid_pricing_snapshot_update() ... ;
CREATE TRIGGER trg_quotes_immutable BEFORE UPDATE ON quotes FOR EACH ROW EXECUTE ...;
CREATE TRIGGER trg_order_items_pricing_immutable BEFORE UPDATE ON order_items FOR EACH ROW EXECUTE ...;
CREATE TRIGGER trg_fx_rates_append_only BEFORE UPDATE OR DELETE ON fx_rates ...;
```

Drizzle schema files are updated to match: `pricing.ts`, `commerce.ts`, and a new `fx.ts` / `promotions.ts` / `tax.ts`, plus relations. `_journal.json` gets entry idx 4. The migration and its snapshot are generated, then hand-reviewed like 0003.

---

## 4. Money types and arithmetic strategy

- New pure package **`packages/commerce-core`** with no I/O, no Nest and no DB. It holds money ops, rounding, FX math, and the markup, promotion and tax engines as pure functions, plus the currency resolver. The API wires them together, and every calculation is testable in isolation.
- It reuses `MoneyAmount` and `CURRENCY_METADATA` from `registrar-core`, so ISO exponents have one source (no duplicate table). `registrar-core` is not modified.
- **Representation:** `bigint` minor units plus a 3-letter currency. Mixed-currency arithmetic throws `CurrencyMismatchError`.
- **No `number` in money paths.** Percentages are integer **basis points**. FX rates are parsed from the NUMERIC string into `{ scaled: bigint, scale: 12 }`. An ESLint rule (`no-restricted-syntax`) in `commerce-core` bans `parseFloat`, `Number(` and `Math.round` in money files.
- **One canonical rounding primitive:** `divRoundHalfUp(n: bigint, d: bigint)`. It is defined for `n ≥ 0, d > 0`; negative input throws, because every intermediate value in the pipeline is non-negative by construction.
- **Canonical pipeline** (fixed order; each step rounds at most once):
  1. `C = convertFx(P)`: same currency means `C = P`. Otherwise `C = divRoundHalfUp(P × rateScaled × 10^max(0, eC−eP), 10^12 × 10^max(0, eP−eC))`.
  2. `markup` per strategy (§8). `pct = divRoundHalfUp(C × bps, 10_000)`.
  3. `retail = C + markup`. Optional `rounding_increment_minor` rounds **up** (ceiling) to the increment, e.g. whole rupees, and `markup` is recomputed as `retail − C`.
  4. `discount` (§9), clamped to `[0, retail]`.
  5. `taxable = retail − discount`. Exclusive tax: `Σ divRoundHalfUp(taxable × bps, 10_000)`, one per tax line. Inclusive (modelled, disabled in V1; see §10): `tax = taxable − divRoundHalfUp(taxable × 10_000, 10_000 + bps)`.
  6. `final = taxable + exclusiveTax`.
- **Bounds:** an input is rejected if any amount exceeds `10^15` minor units (a sanity ceiling well inside BIGINT). Zero is valid (free promo).
- **Wire format:** every money value in a DTO is `{ amountMinor: string, currency: string, formatted?: never }`. The frontend formats it with `Intl.NumberFormat` from `(BigInt → string → decimal string via exponent)`; it never uses float math (§29).

---

## 5. Provider price ingestion design

```
PriceSyncJob / Admin trigger
  → ProviderPriceSyncService (apps/api + worker; provider-neutral)
      → registrarResolver.get(provider).getCapability(DOMAIN_PRICING).getTldPrices()
      → ProviderPriceNormalizer (commerce-core): TldPrice → NormalizedProviderPrice[]
            {tld, operation: REGISTER|RENEW|TRANSFER|RESTORE, years, currency (response), amountMinor | UNAVAILABLE, observedAt, sourceReference}
      → ProviderPriceRepository.upsertBatch(runId, rows)
```

- Distinct rows per operation. `REGISTER` and `RENEW` year 1 come from year-1 values. Multi-year rows are not written until D3 is resolved.
- Provider `"--"` becomes `is_available = false`, the existing row is kept, and the stale cost is not zeroed. `0.00` becomes a genuine zero.
- Requested sync currency is `system_settings.pricing.provider_sync_currency` (default `USD`). The **response currency** is recorded per run (D2). If it differs from what was requested, the run is marked `FAILED` and nothing is written.
- Unknown TLDs (not in `tlds`) are counted and logged, never auto-created. Admins enable TLDs explicitly.
- Upserts happen per TLD inside one transaction per page. A failed TLD increments `tlds_failed`, and its previous row is kept.
- **Never-shrink guard:** if a page returns zero rows, or fewer than `min_expected_ratio` (default 50%) of the previously known TLDs, the whole run becomes `FAILED` with nothing written (§26).
- `last_synced_at` and `observed_at` update only on rows actually refreshed. `tlds.last_price_sync_at` updates on success.
- Concurrency: the partial unique index `uq_price_sync_running` means a second trigger returns `409 SYNC_ALREADY_RUNNING`. Runs stuck in RUNNING longer than 30 min are marked FAILED by the sweep.

---

## 6. Currency resolver

`CurrencyResolver` lives in `commerce-core` and is pure. It takes a context and returns `{currency, source}`.

Priority:
1. `explicitRequested` (query or body `currency`), if it is in `SUPPORTED_CUSTOMER_CURRENCIES`
2. authenticated `user_profiles.preferred_currency`, else the country map of `user_profiles.country`
3. `pn_currency` cookie (saved browser preference)
4. geo country, **only when the user has no stored preference and no cookie**. It comes from a configured trusted header (e.g. `CF-IPCountry`). The header is ignored unless `TRUST_GEO_HEADER=true`.
5. `PLATFORM_DEFAULT_CURRENCY` (`USD`)

- `SUPPORTED_CUSTOMER_CURRENCIES = ['INR','USD','GBP','EUR','CAD','AUD']` is a single constant in `commerce-core`.
- `COUNTRY_TO_CURRENCY` is the single centralized map: `IN→INR, US→USD, GB→GBP, CA→CAD, AU→AUD`, and EU member states to EUR. Anything else resolves to the platform default. No controller or component carries its own mapping (enforced by a test that greps for currency literals outside `commerce-core` and the contracts package).
- **Travelling:** geo never overwrites a stored preference. The first geo-derived currency is persisted with `preferred_currency_source='GEO_DEFAULT'`. Only an explicit selection writes `USER_SELECTED`, and geo never downgrades `USER_SELECTED`.
- `PUT /api/v1/account/preferences/currency` stores `USER_SELECTED`.
- The quote records `currency_source`.

---

## 7. FX abstraction, cache and storage

- `FxProvider` interface: `fetchRates(base, quotes[]) → FxRateSnapshot[]`. The V1 implementation is **`ManualFxProvider`**, where an admin enters rates (with `observed_at` and `valid_until`) through the admin API. No FX vendor exists in the repo, so none is selected; a vendor adapter slots in later behind the same interface.
- `FxService.getUsableRate(from, to, now)`:
  - `from === to` returns `IDENTITY` (no row, and `fx_rate_id` is null).
  - Otherwise it takes the latest `fx_rates` row for the pair where `valid_until > now` **and** `now − observed_at ≤ fx.max_age` (system setting, default 24h).
  - If there is none, it throws `FxRateUnavailableError`. **There is no 1:1 fallback, no inverse-derivation and no cross-rate triangulation in V1.** Each pair must be entered explicitly.
- Redis caches the "current usable rate" per pair for 60s (key includes the row id). A cache miss or Redis outage falls back to the DB. The cache is never authoritative.
- `fx_rates` is append-only, enforced by a trigger. Correcting a rate means adding a new row.
- The quote copies `fx_rate_id`, `fx_rate` (string), `fx_source` and `fx_observed_at`.

---

## 8. Markup rule model and precedence

Strategies: `FIXED` (amount per currency), `PERCENT` (bps), `MAX_FIXED_PERCENT`, and `RETAIL_OVERRIDE` (explicit retail amount per currency).

**Precedence** (first active match wins, with no merging):
1. `tld_id = X AND operation = OP`
2. `tld_id = X AND operation IS NULL`
3. `tld_id IS NULL AND operation = OP`
4. `tld_id IS NULL AND operation IS NULL` (global default)

Rules:
- The partial unique index guarantees at most one active rule per scope, so matching is deterministic.
- **No applicable rule:** quote creation fails with `PRICING_UNAVAILABLE`. The system never sells at raw cost.
- **Currency-aware amounts:** if the winning rule needs a fixed or override amount and has no `pricing_rule_amounts` row for the customer currency, the quote fails. The engine does not fall through to a lower-precedence rule, because that would silently change the price.
- **Below-cost guard:** if `retail < converted_cost` and `allow_below_cost = false`, the quote fails `PRICING_UNAVAILABLE` and a `PRICING_BELOW_COST` warning is logged for admins. This catches FX moves that make an override unprofitable.
- Every rule edit increments `version` and writes an `admin_actions` row plus an `audit_logs` row with before and after states.
- Existing quotes keep their own copied numbers.

---

## 9. Promotion model

- **Code-based** (`code_canonical`) or **automatic** (`code IS NULL`).
- Filters: `tld_ids`, `operations`, `currencies`, `starts_at/ends_at`, `min_amount_minor[currency]`.
- Discount: `FIXED` uses `fixed_discount_minor[currency]`, and the promo is inapplicable if that currency has no row. `PERCENT` uses `bps` with an optional `max_discount_minor[currency]` cap.
- **Stacking V1:** at most one promotion per item. If the customer entered a valid code, it wins. Otherwise the best automatic promo applies (highest discount, then `priority`, then `id` as a deterministic tiebreak).
- **Clamp:** `discount = min(discount, retail)`, so the final amount never goes below zero (also enforced by the DB CHECK).
- **Evaluated twice:**
  - at quote time, as a preview written into the snapshot;
  - at order creation, inside the transaction, as a reservation that checks limits under lock (§16).
- If the promo became invalid between quote and order (expired, exhausted, deactivated), order creation fails with `PROMOTION_NO_LONGER_VALID`. The customer re-quotes, and the quote's price is never silently changed (§12).
- **Redemption lifecycle:**
  - `RESERVED` at DRAFT creation;
  - `RELEASED` on order cancel or pricing expiry;
  - `CONSUMED` is set by the future payment phase on SUCCEEDED; Phase 7 only defines the method.
  - Limits count `RESERVED + CONSUMED`.
- **Invalid code** returns a generic `PROMO_CODE_INVALID`. It does not distinguish expired from nonexistent, to avoid code enumeration, and it is rate-limited per user.
- Referral and affiliate programs are excluded.

---

## 10. Tax abstraction

```ts
interface TaxContext { country: string; region?: string; customerType?: 'INDIVIDUAL'|'BUSINESS'; operation; tldId; currency; taxableMinor: bigint; at: Date }
interface TaxLine    { ruleId; ruleVersion; taxCode; displayName; rateBps; treatment; amountMinor: bigint }
interface TaxEngine  { calculate(ctx): TaxLine[] }
```

- `ConfigurableTaxEngine` reads active `tax_rules` for `(country, region?)` that are effective at `at` and match the operation. A region-specific rule takes precedence over a country-wide rule for the same `tax_code`. Multiple distinct `tax_code`s produce multiple lines.
- **No rule configured** means zero tax lines and `taxMinor = 0`. The snapshot records `tax.status = 'NO_RULE_CONFIGURED'` so the choice is visible later. **The plan ships with no seeded tax rules and makes no GST, VAT or sales-tax claims.** Configuring them is a business/legal task for you.
- **Tax country:** `user_profiles.country` is required for quotes, with a `409 BILLING_COUNTRY_REQUIRED` and a UI prompt if it is missing. Geo IP is never used for tax.
- **V1 treatment:** `EXCLUSIVE` only. The admin API rejects `INCLUSIVE` rules with `TAX_TREATMENT_NOT_ENABLED`. The engine, the column and the math are in place, but enabling inclusive treatment requires a decision on how inclusive tax shows on orders and invoices.
- Snapshot: each `TaxLine` is copied into `calculation_snapshot.tax.lines`, and `quotes.tax_minor` holds the sum.

---

## 11. PriceQuote schema and TTL

This is the existing `quotes` table extended per §3.8. Mapping to the brief's model:

| Brief field | Column |
|---|---|
| quoteId / userId / domain / operationType / years / registrarProviderId | existing columns |
| providerCurrency / providerAmountMinor | `provider_cost_currency` / `provider_cost_minor` |
| customerCurrency | `currency` |
| fxRate / fxRateSource / fxRateObservedAt | `fx_rate` / `fx_source` / `fx_observed_at` (+ `fx_rate_id`) |
| baseRetailAmountMinor | `retail_amount_minor` |
| markup / discount / tax / final | `markup_minor` / `discount_minor` / `tax_minor` / `final_amount_minor` |
| pricingRuleIds / promotionIds / taxRuleIds | `pricing_rule_id(+version)`, `promotion_id(+version)`, `calculation_snapshot.tax.lines[].ruleId` |
| quotedAt / expiresAt / status / version | `created_at` / `expires_at` / `status` / `pricing_version` |

- **Quotes require authentication**, because `user_id` is NOT NULL. Anonymous visitors see public retail prices (§22) and log in to quote.
- **TTL:** `system_settings.pricing.quote_ttl_seconds`, default 900 and clamped to between 60 and 3600. `expires_at = db now() + ttl`, set in SQL from the database clock, never from the app host or the client.
- **Expiry is derived** (`expires_at <= now()` in SQL). No job has to flip a status for correctness; `status` only records CONSUMED and INVALIDATED.
- **Quote preconditions:**
  - TLD is enabled;
  - `years` is within the TLD bounds and equals 1 for V1 (D3);
  - operation is `REGISTER` for V1 checkout, because renew and transfer are priced in the catalog but not orderable until their fulfillment exists;
  - the domain is available and not premium (via `DomainSearchService`, D4; premium is rejected with `PREMIUM_NOT_SUPPORTED`);
  - the provider price row is available and fresh (§4 of the brief, below);
  - FX is usable, and a pricing rule applies.

**Freshness:** a price is too stale if `now − provider_price.observed_at > pricing.provider_price_max_age` (default 48h). Quote creation then fails with `PRICE_TEMPORARILY_UNAVAILABLE` (customer-safe copy), and an alert metric is emitted.

---

## 12. Quote immutability rules

1. There are no application `UPDATE` paths on pricing columns. Repository methods for quotes only `insert`, `markConsumed` and `invalidate`.
2. **DB trigger** `trg_quotes_immutable`: rejects any UPDATE that changes a column other than `status` or `consumed_at`. It only allows `ACTIVE→CONSUMED` and `ACTIVE→INVALIDATED`.
3. **DB trigger** on `order_items`: rejects UPDATEs to any pricing or snapshot column where `pricing_version >= 1`. Phase 6's `registrar_operation_id` update stays allowed.
4. Changes to provider prices, FX, markup, promos or tax affect only **new** quotes. This is covered by tests that mutate each input after quoting and assert the quote and order are byte-identical.
5. Expired quotes are never re-priced in place. The client must `POST /quotes` again and gets a new id with new numbers. The UI shows a comparison if the price changed.
6. Admin "invalidate quote" (e.g. a pricing mistake) sets `INVALIDATED`. It never edits the amounts.

---

## 13. Quote/order idempotency

- **Checkout:** `POST /orders` requires an `Idempotency-Key` header (a UUID generated by the client per checkout attempt).
  - Stored as `orders.checkout_idempotency_key`, unique per user.
  - `checkout_request_hash = sha256(canonical JSON of sorted quoteIds)`.
  - Same key and same hash returns the **existing order** (200, same body).
  - Same key with a different hash returns `409 IDEMPOTENCY_KEY_REUSED`.
- **Quote reuse:** `uq_order_items_quote` guarantees that a quote can back only one order item, ever. A second order using the same quote fails with `QUOTE_ALREADY_USED` and returns the id of the order that holds it, if it is the same user's.
- **Submit:** `POST /orders/:id/submit` is naturally idempotent. A conditional update `WHERE status='DRAFT'` runs; if the order is already `PENDING_PAYMENT`, the call returns 200 with the current state.
- **Quote creation:** not idempotent by design (cheap, short-lived, rate-limited). The client may send an optional `Idempotency-Key` to dedupe double-clicks for 60s via Redis. That dedupe is a convenience, not a correctness mechanism.

---

## 14. Multi-item order design

- `POST /orders { quoteIds: string[] }`, with 1–20 items.
- **One customer currency per order.** Quotes in different currencies return `422 CURRENCY_MISMATCH`, and the UI re-quotes in one currency.
- No duplicate `(domain, operation)` within an order, enforced by the DB index and a pre-check.
- Order totals are computed server-side from item snapshots in bigint:
  - `subtotal = Σ retail_subtotal`
  - `discount = Σ discount`
  - `tax = Σ tax`
  - `total = Σ amount_minor`
- An assertion checks `total = subtotal − discount + tax`. It is re-verified in a test by reading back from the DB, and a DB CHECK enforces non-negativity.
- **Partial validity:** if any quote is expired, used or invalid, the **whole** request fails. The response lists the offending quote ids so the UI can re-quote just those. There is no silent partial order.
- `orders.pricing_expires_at = min(quote.expires_at)`.

---

## 15. Transaction boundaries

| Tx | Contents |
|---|---|
| **TQ – create quote** | Read-only calls happen *before* the tx: availability (provider), FX, rules and price lookups. The tx is then a single INSERT into `quotes` plus an `audit_logs` row, with `expires_at` from DB `now()`. Provider I/O never runs inside a DB transaction. |
| **TO – create order** (one tx, READ COMMITTED + row locks) | 1) Idempotency lookup. 2) `SELECT … FROM quotes WHERE id = ANY($ids) AND user_id=$u FOR UPDATE`. 3) Validate each quote: exists, owned, `status='ACTIVE'`, `expires_at > now()` (DB clock), `pricing_version ≥ 1`, supported operation, same currency. 4) Lock the promotion rows (`FOR UPDATE`, ordered by id to avoid deadlocks); recheck window, active flag and limits; insert `promotion_redemptions` as RESERVED; increment `redemption_count` with a conditional UPDATE. 5) INSERT `orders` (DRAFT). 6) INSERT `order_items`, copying the snapshots. 7) UPDATE quotes to CONSUMED. 8) `audit_logs` rows for ORDER_CREATED and QUOTE_CONSUMED. 9) Commit. |
| **TS – submit** | `UPDATE orders SET status='PENDING_PAYMENT', submitted_at=now() WHERE id=$id AND user_id=$u AND status='DRAFT' AND pricing_expires_at > now() RETURNING *` plus an audit row. Zero rows triggers a re-read to return the right error. Payment rows are **not** created (that belongs to the payment phase). |
| **TC – cancel** (customer or sweep) | Conditional `DRAFT|PENDING_PAYMENT → CANCELLED`. The sweep additionally requires `NOT EXISTS (SELECT 1 FROM payments WHERE order_id = …)`. Redemptions are RELEASED and `redemption_count` decremented, with an audit row. |
| **Sync run** | One tx per page of upserts, plus run-row updates in separate short txs. |

---

## 16. Concurrency strategy

| Race | Mechanism |
|---|---|
| Double-click or two tabs on checkout | Idempotency key unique index. The loser of the insert race catches `23505`, re-reads, and returns the existing order. |
| Same quote in two concurrent orders | `FOR UPDATE` on quotes serializes them. The `uq_order_items_quote` unique index is the backstop. |
| Quote expires mid-checkout | Expiry is checked in SQL against `now()` inside TO, after the lock. |
| Promo global limit | The promotion row lock plus conditional `UPDATE … SET redemption_count = redemption_count + 1 WHERE redemption_count < usage_limit`. The DB CHECK is the backstop. |
| Promo per-user limit | Counted under the promotion row lock, so concurrent orders by the same user serialize on it. |
| Submit vs cancel sweep | Both are conditional updates on `status`, so exactly one wins. |
| Two price syncs | Partial unique index on RUNNING. |
| Deadlocks | Lock order is always quotes (id asc), then promotions (id asc), then order insert. There is one retry on `40P01`. |

Concurrency tests run real parallel transactions against Postgres, following the Phase 6 integration-test pattern (`TEST_DATABASE_URL`).

---

## 17. API endpoints

Global prefix `api/v1`. Customer routes use `AuthGuard`. Admin routes use `AuthGuard, RolesGuard, PermissionGuard`, matching Phase 6.

**Public (no auth; rate-limited per IP via the existing `RateLimitService`):**
- `GET /pricing/tlds?currency=` returns the retail catalog for enabled TLDs, year 1: register, renew and transfer retail. Undiscounted retail only; automatic promos appear as `promoPrice`, pre-tax, and labelled "excl. tax". The response is cached in Redis per currency for 5 min and invalidated on rule, promo, price or FX change.
- `GET /pricing/currencies` returns the supported currencies and the resolved default for this request.
- `GET /domain-search?q=` (D4) returns availability, premium flag, and an indicative retail price from the same projection, clearly marked *indicative*, not a quote.

**Customer:**
- `POST /quotes` `{ domain, operation, years, promoCode?, currency? }`, strict schema. **Unknown keys are rejected with 400**, so money fields cannot be smuggled in (§13 of brief).
- `GET /quotes/:id` (owner only; 404 otherwise).
- `POST /orders` `{ quoteIds[] }` + `Idempotency-Key` header.
- `POST /orders/:id/submit` (`DRAFT → PENDING_PAYMENT` only).
- `POST /orders/:id/cancel` (`DRAFT|PENDING_PAYMENT → CANCELLED`, only while no payment row exists).
- `GET /orders`, `GET /orders/:id`, which replace the current raw-row responses (D5).
- `PUT /account/preferences/currency`.

**Admin:**
- `GET /admin/pricing/tlds`, `PATCH /admin/pricing/tlds/:id` (enable, bounds, order)
- `GET /admin/pricing/provider-prices`, `POST /admin/pricing/provider-prices/sync`, `GET /admin/pricing/sync-runs`
- `GET|POST|PATCH|DELETE(deactivate) /admin/pricing/rules`
- `GET|POST|PATCH /admin/promotions`, `GET /admin/promotions/:id/redemptions`
- `GET|POST|PATCH /admin/tax-rules`
- `GET /admin/fx/rates`, `POST /admin/fx/rates` (manual entry)
- `GET /admin/quotes`, `GET /admin/quotes/:id`, `POST /admin/quotes/:id/invalidate`
- `GET /admin/orders/:id/pricing` (full breakdown)
- `POST /admin/pricing/preview`, which dry-runs the pipeline for a TLD, operation and currency without persisting. Used to check rules before saving.

Request validation uses Zod schemas in `@prisnames/contracts` (`contracts/src/commerce/`), shared by the API and web.

---

## 18. DTO exposure rules

- **Explicit allow-list mappers only.** No Drizzle row is ever returned. There are separate `toCustomerQuoteDto`, `toCustomerOrderDto`, `toAdminQuoteDto` and `toAdminOrderPricingDto` mappers.
- **Customer quote and order DTOs contain:** domain, operation, years, currency, retail, discount (with promo *display name* only), tax lines (`displayName`, `amount`), final, `expiresAt`, `status`, `serverNow` (for the countdown).
- **Customer DTOs never contain:** `provider_cost_*`, `converted_cost_minor`, `markup_minor`, `fx_*`, `pricing_rule_*`, `promotion_id/version`, tax rule ids, rate bps, `calculation_snapshot`, `registrar_provider_id`, provider names, sync or raw payloads, or provider errors.
- **Admin DTOs** add wholesale, FX, markup, rule references and the full snapshot, gated by permission (§19).
- **Guard test:** a snapshot test serializes every customer DTO for a fully-populated fixture and asserts that a denylist of keys and substrings (`cost`, `markup`, `fx`, `provider`, `rule`, `snapshot`) is absent.
- Errors map to stable customer-safe codes. Provider and internal errors are logged, never echoed.

---

## 19. Admin permissions

Added to `PERMISSIONS` in `contracts/src/permissions`, keeping the existing app-level mapping (no DB table):

```
PRICING_READ       'pricing:read'        PRICING_MANAGE     'pricing:manage'   (rules, TLD catalog, sync trigger, FX entry)
PROMOTIONS_READ    'promotions:read'     PROMOTIONS_MANAGE  'promotions:manage'
TAX_READ           'tax:read'            TAX_MANAGE         'tax:manage'
QUOTES_READ        'quotes:read'         QUOTES_MANAGE      'quotes:manage'    (invalidate)
```

| Role | Added |
|---|---|
| ADMIN | all eight |
| FINANCE | PRICING_READ, PROMOTIONS_READ, PROMOTIONS_MANAGE, TAX_READ, TAX_MANAGE, QUOTES_READ (+ existing ORDERS_READ_ALL) |
| SUPPORT | QUOTES_READ (customer-facing breakdown only; wholesale fields need PRICING_READ, enforced in the mapper) |
| SUPER_ADMIN | implicit (unchanged) |

FINANCE gets PRICING_MANAGE only if you want it; the table above leaves it out. Every mutation writes `admin_actions` and `audit_logs`.

---

## 20. Frontend screens and flows

These follow the existing `apps/web` App Router layout, `@prisnames/ui` components and CSS-variable tokens. No payment UI is included.

**Public**
- **`/domains` (search):** query box, then result rows with availability, an indicative retail price in the selected currency, and a "Select" button. Selections are held in client state plus `sessionStorage` (not a durable cart). Replaces the EmptyState.
- **`/pricing`:** the TLD retail table (register / renew / transfer) with the currency selector.
- **Header:** a currency selector (6 currencies). It sets the `pn_currency` cookie, and for logged-in users it also calls the preference API.

**Checkout** (`/checkout`, authenticated)
1. **Review:** for each selected domain, `POST /quotes` in parallel. Each line shows retail, discount and tax lines, then the total. A promo code field re-quotes with the code. A billing-country prompt appears if the country is missing.
2. **Expiry indicator:** the countdown is computed from `expiresAt − serverNow` (offset-corrected, informational only). At zero, lines are marked expired and the "Refresh prices" button re-quotes.
3. **Price-change re-quote:** if a new quote differs from the old one, the old and new prices are shown side by side and the customer must confirm before continuing.
4. **Confirm:** `POST /orders` with a client-generated Idempotency-Key (kept across retries of the same attempt), then `POST /orders/:id/submit`.
5. **Order placed (`PENDING_PAYMENT`):** order summary and the text "Awaiting payment. Online payment is not yet available." There is no fake pay button, and no wording that implies payment happened.

**Dashboard**
- **`/dashboard/orders`** lists orders with customer-facing statuses (DRAFT is shown as "Not submitted"). `/dashboard/orders/[id]` shows the breakdown and a cancel action where allowed.

**Admin** (replacing the EmptyStates)
- `/admin/tlds`: catalog and enablement.
- `/admin/pricing`: provider prices with freshness badges, sync runs, a "Sync now" button, rule CRUD, and the preview tool.
- New `/admin/promotions`: CRUD and redemptions.
- New `/admin/tax`: rules CRUD.
- New `/admin/fx`: rates, staleness, manual entry.
- `/admin/orders/[id]`: pricing breakdown.

**Formatting:** one `formatMoney({amountMinor, currency}, locale)` helper in `packages/ui`. INR uses `en-IN`, which gives `₹1,299.00` and lakh grouping for large amounts. The decimal string is built from the bigint string using the ISO exponent before it reaches `Intl`, so no float arithmetic is involved.

---

## 21. Background jobs

These are new BullMQ repeatable jobs in `apps/worker`, following the existing processor pattern.

| Job | Schedule | Action |
|---|---|---|
| `provider-price-sync` | every 6h (setting) | Sync run per active provider with the pricing capability. |
| `price-sync-stale-run-sweep` | 10 min | RUNNING > 30 min becomes FAILED. |
| `pricing-freshness-monitor` | 15 min | Emits metric and warn log when any enabled TLD's price is older than the threshold, or any required FX pair is unusable or near expiry. |
| `order-pricing-expiry-sweep` | 5 min | Cancels `DRAFT` and `PENDING_PAYMENT` orders past `pricing_expires_at` + grace **with no payments row**, and releases promo reservations. |
| `pricing-catalog-cache-warm` | after sync, rule or FX change | Rebuilds the Redis public catalog projection. |

No job calls fulfillment, touches `registrar_operations`, or moves an order to `PROCESSING`.

---

## 22. Auditability model

"Why was example.com quoted at ₹X on date D?" is answered from the **quote row alone**, without reading current configuration:

```json
calculation_snapshot = {
  "engineVersion": 1, "roundingPolicy": "HALF_UP_V1",
  "provider": { "providerId": "...", "priceRowId": "...", "amountMinor": "1050", "currency": "USD",
                "observedAt": "...", "sourceReference": "price_level:..." },
  "fx": { "rateId": "...", "rate": "83.250000000000", "source": "MANUAL", "observedAt": "...", "validUntil": "..." },
  "convertedCostMinor": "87413",
  "markup": { "ruleId": "...", "ruleVersion": 3, "scope": "TLD_OPERATION", "strategy": "MAX_FIXED_PERCENT",
              "percentBps": 2000, "fixedMinor": "15000", "roundingIncrementMinor": "100", "markupMinor": "15087" },
  "retailMinor": "102500",
  "promotion": { "promotionId": "...", "version": 2, "codeEntered": "LAUNCH10", "kind": "PERCENT",
                 "percentBps": 1000, "capMinor": null, "discountMinor": "10250" },
  "tax": { "status": "APPLIED" | "NO_RULE_CONFIGURED", "country": "IN", "region": null,
           "lines": [{ "ruleId": "...", "ruleVersion": 1, "taxCode": "...", "rateBps": 1800,
                       "treatment": "EXCLUSIVE", "amountMinor": "16605" }] },
  "finalMinor": "108855", "currencySource": "ACCOUNT_PREFERENCE", "quotedAt": "..."
}
```

- The snapshot is copied verbatim to `order_items.calculation_snapshot`, and both are immutable (§12).
- The **"reproduce" test** recomputes the final amount from the snapshot inputs with the pure engine and asserts equality. This also guards against a future engine change silently altering history, which is why `engineVersion` is stored.
- Rule, promo and tax edits keep `version` plus before/after `audit_logs`.
- `fx_rates` is append-only. Provider price history is recoverable from quote snapshots and sync runs. A separate price-history table is deferred because snapshots already cover the audit question.

---

## 23. Failure matrix

| Condition | Where | Behavior | Customer sees |
|---|---|---|---|
| Provider price stale beyond threshold | quote | fail, alert metric | `PRICE_TEMPORARILY_UNAVAILABLE` |
| Provider price `"--"` / unavailable | quote | fail | `PRICE_TEMPORARILY_UNAVAILABLE` |
| FX missing or expired (different currency) | quote | fail, **no 1:1** | `CURRENCY_TEMPORARILY_UNAVAILABLE` + suggest USD |
| No markup rule / missing currency amount | quote | fail, admin log | `PRICE_TEMPORARILY_UNAVAILABLE` |
| Retail below cost | quote | fail, admin warn | `PRICE_TEMPORARILY_UNAVAILABLE` |
| Domain unavailable / premium | quote | fail | `DOMAIN_UNAVAILABLE` / `PREMIUM_NOT_SUPPORTED` |
| Provider search error or circuit open | quote | fail (no guess) | `SEARCH_TEMPORARILY_UNAVAILABLE` |
| Billing country missing | quote | 409 | prompt to complete profile |
| Unknown or invalid promo | quote | 422 | `PROMO_CODE_INVALID` |
| Client sends price fields | quote/order | 400 (strict schema) | `INVALID_REQUEST` |
| Quote expired | order | 409 | `QUOTE_EXPIRED` → re-quote |
| Quote used / not owned | order | 409 / 404 | `QUOTE_ALREADY_USED` / not found |
| Currency mismatch | order | 422 | `CURRENCY_MISMATCH` |
| Promo exhausted since quote | order | 409, whole tx rolls back | `PROMOTION_NO_LONGER_VALID` → re-quote |
| Idempotency key reused differently | order | 409 | `IDEMPOTENCY_KEY_REUSED` |
| Submit after pricing expiry | submit | 409 | `ORDER_PRICING_EXPIRED` |
| Submit on non-DRAFT | submit | 200 if already PENDING_PAYMENT, else 409 | current state |
| Sync partial or empty | worker | keep old rows, run PARTIAL/FAILED | none (admin visibility) |
| Sync response currency ≠ requested | worker | run FAILED, nothing written | none |
| Redis down | any | DB fallback, rate limiter fails closed for quote creation | normal or 429 |
| DB trigger rejects pricing update | any | 500 + error log (indicates a bug) | generic error |

---

## 24. Test matrix

All of the following are in addition to the existing suite. Phase 5 and 6 suites must stay green.

**Money (commerce-core, unit):**
- add, sub, compare within currency; mismatch throws
- exponents 0, 2 and 3 (JPY, INR, KWD)
- `divRoundHalfUp` at .5 boundaries
- amounts near the 10^15 ceiling
- zero allowed; negative inputs throw
- property-based tests (fast-check) confirming results are integers and deterministic across 10k random inputs
- lint rule forbidding float money

**FX:**
- same currency gives identity with no row
- USD→INR, INR→USD, JPY↔USD (exponent differences)
- missing pair, expired `valid_until`, `observed_at` beyond max age
- rounding at .5
- provider failure (the manual provider can't fail; interface contract tested with a fake)
- never 1:1 (explicit test)
- Redis cache miss or outage falls back to the DB
- `fx_rates` UPDATE or DELETE rejected by the trigger

**Markup:**
- fixed, percent, max(fixed, percent) in both directions, override
- rounding increment (ceiling)
- each precedence level wins over the lower ones
- no rule means failure
- winning rule lacks the currency amount means failure (no fall-through)
- below-cost guard; `allow_below_cost` bypass
- only one active rule per scope (DB)

**Promotions:**
- valid code, automatic, best-auto selection and tiebreak
- expired, not-yet-started, inactive
- TLD, operation and currency filters; min amount
- fixed, percent, cap
- clamp to retail, so final can be 0 and never negative
- global limit and per-user limit
- **concurrency:** N parallel orders on a limit of 1 gives exactly one success
- release on cancel and on the expiry sweep restores the count
- invalid-code response identical for nonexistent and expired

**Tax:**
- no rule gives zero with NO_RULE_CONFIGURED
- country rule, region beats country, multiple lines
- effective dates, operation filter
- exclusive math, inclusive math (engine-level only)
- admin rejects INCLUSIVE in V1
- missing billing country gives 409

**Quote:**
- happy path in each of the 6 currencies
- snapshot completeness (DB CHECK) and arithmetic identity
- expiry uses the DB clock (test with the app clock skewed)
- cross-user GET returns 404
- body with `price`, `finalAmount`, `fxRate` etc. returns 400
- after-quote changes to provider price, FX, rule, promo or tax each leave the quote unchanged
- direct UPDATE on the amount is rejected by the trigger
- the reproduce-from-snapshot test
- stale price, premium and unavailable domains fail
- `years ≠ 1` and `operation ≠ REGISTER` rejected for checkout in V1

**Quote → order:**
- single and multi-item happy paths; totals equal Σ items
- expired quote; used quote
- duplicate checkout with the same key gives the same order
- same key with different quotes gives 409
- **concurrent** checkout of the same quote from 10 parallel requests gives exactly one order
- currency mismatch
- duplicate domain in one order
- submit `DRAFT→PENDING_PAYMENT`, idempotent re-submit, submit after expiry
- **no code path yields PROCESSING:**
  - status transition table test
  - a grep-style test asserting the `commerce` module never imports the registrar-ops service or queue
  - a DB assertion that no `registrar_operations` rows are created by any Phase 7 flow
- expiry sweep cancels only orders without payments

**Security:**
- the customer DTO denylist test (every endpoint)
- a customer calling each admin endpoint gets 403
- the permission matrix per role, including FINANCE
- cross-user quote and order isolation
- public pricing contains no cost, markup or FX fields
- public pricing rate limit returns 429
- promo brute-force rate limit

**Migration:**
- clean apply of 0000–0004 on an empty DB
- upgrade: apply 0000–0003, seed Phase 6-shaped rows (orders, items with `REGISTER`, quotes), apply 0004, and check that the rows are intact, `pricing_version = 0` and constraints hold
- Drizzle schema matches the introspected DB
- the money-column BIGINT test is extended to the new tables

**Phase 6 regression:**
- full existing suite, plus the real `OrderService.evaluateFulfillment` test with `REGISTER` items (D1)

**Frontend (vitest + testing-library):**
- currency selector persistence
- INR formatting `₹1,299.00` and lakh grouping
- countdown uses server offset
- expired → re-quote flow
- price-change confirmation
- PENDING_PAYMENT screen has no pay button

---

## 25. Migration verification

1. `verify-migrations.sh` is extended to apply 0002, 0003 and 0004 (it currently stops at 0001), then assert the new tables, columns, constraints, triggers and indexes via `information_schema` and `pg_indexes`.
2. **Upgrade path test:** a script builds a DB at 0003, inserts representative Phase 6 data (including the sandbox-canary shape), applies 0004, and runs assertions. Existing quotes and orders stay readable and are flagged `pricing_version=0`. Legacy quotes cannot be checked out, and legacy orders are untouched by the new triggers and sweeps.
3. The pre-flight in 0004 aborts with a clear message if existing `registrar_provider_prices.operation` values fall outside the new CHECK set, instead of corrupting data.
4. Drizzle `drizzle-kit check` / introspection diff is empty.
5. The migration is idempotency-safe under the journal: it runs once and is wrapped in BEGIN/COMMIT.
6. Rollback note: 0004 is additive, so the down-path is a documented manual script (drop new tables and columns, restore NOT NULL after a backfill). It is tested once on a scratch DB.

---

## 26. Phase 6 integration boundary

- Phase 7 code lives in new modules: `apps/api/src/modules/pricing`, `quotes`, `checkout`, `promotions`, `tax` and `fx`, plus `commerce-core`.
- These modules **do not import** `RegistrarOperationService`, the fulfillment queue, or `registrar-ops` repositories. This is enforced by an ESLint `no-restricted-imports` rule scoped to those folders.
- `OrderService` remains the sole owner of `orders.status`. Phase 7 adds these methods to it:
  - `createDraftFromQuotes(tx, …)`
  - `submitForPayment(orderId, userId)` (`DRAFT→PENDING_PAYMENT`)
  - `cancelUnpaid(orderId, reason)`
  - No `markPaid` or `PENDING_PAYMENT→PROCESSING` method is added, not even as a stub. That transition belongs entirely to the payment phase.
- The state transition table in `OrderService` gains an explicit allow-list. Phase 7 callers can only request `DRAFT→PENDING_PAYMENT` and `DRAFT|PENDING_PAYMENT→CANCELLED`. A unit test asserts that `PROCESSING` is unreachable from any Phase 7 entry point.
- `order_items.operation` is written as `REGISTER`. This aligns with Phase 6 only if D1 is approved; otherwise paid orders will never evaluate as complete once payment exists.
- Quotes reserve nothing. Availability at quote time is informational, and Phase 6's FQDN-conflict guard and failure handling stay authoritative at fulfillment.
- No production or test endpoint moves an order past `PENDING_PAYMENT`. Test fixtures that need `PROCESSING` keep inserting via SQL, as Phase 6 tests already do.

---

## 27. Explicitly deferred

- Payment gateways (Razorpay, Cashfree, PhonePe, Stripe), payment rows, webhooks, `PENDING_PAYMENT→PROCESSING`, `CONSUMED` redemption marking
- refunds, invoices, invoice numbering
- renewal, transfer and restore **ordering** (priced in the catalog, not orderable), auto-renew
- multi-year quoting (until D3 is verified)
- premium domain pricing
- FX vendor integration, cross-rate triangulation
- inclusive tax enablement, any seeded tax rules, GST registration logic
- durable cart, promo stacking, referral/affiliate rewards
- DNS, nameserver, privacy and lock writes; email resale; provider failover
- dropping the deprecated retail columns on `registrar_provider_prices`
- price-history table

---

## 28. Acceptance criteria

1. Migration 0004 applies cleanly on an empty DB and on a Phase 6 DB. Verification scripts and the introspection diff pass.
2. The quote pipeline produces correct, deterministic minor-unit results for INR, USD, GBP, EUR, CAD and AUD. No float is used in any money path (lint enforced).
3. Missing, stale or expired FX, stale or unavailable provider prices, and missing rules all **fail** quote creation with customer-safe codes. There is no 1:1 fallback and no invented price.
4. Every v1 quote and order item carries a complete, immutable snapshot that recomputes to its stored final amount, and DB triggers block pricing mutations.
5. Changing provider price, FX, markup, promo or tax after quoting never alters existing quotes or orders (tested per input).
6. A quote is consumed by at most one order item under concurrency, and duplicate checkout with the same key returns the same order.
7. Promotion global and per-user limits hold under parallel load, and discounts never make a total negative.
8. Multi-item orders enforce a single currency, and totals equal the bigint sum of item snapshots.
9. Orders reach `PENDING_PAYMENT` at most. No Phase 7 path creates `registrar_operations`, touches payments, or yields `PROCESSING` (tested).
10. Customer and public DTOs never expose wholesale, markup, FX internals, rule ids or provider data (denylist test on every endpoint).
11. Admin endpoints enforce the new permissions, FINANCE gets the specified access, and SUPER_ADMIN keeps its override.
12. Price sync never replaces valid data with empty or partial data, and its runs are visible to admins.
13. The frontend shows INR as `₹1,299.00`, handles expiry and re-quote, and shows no fake payment.
14. The full suite is green: previous 811 tests pass unchanged (except the D1 correction, if approved), plus all Phase 7 tests. `typecheck` passes, `build` passes, and there are 0 production lint errors.

---

## Suggested implementation order (after approval)

1. `commerce-core` pure engines and tests
2. Migration 0004, Drizzle schema, verification
3. D1 and D2 corrections with regression tests (if approved)
4. FX, provider price sync and jobs
5. Rules, promos, tax, and the admin APIs
6. `DomainSearchService` (D4), quotes
7. Checkout, orders, sweeps, DTOs (D5)
8. Frontend (public, then checkout, then admin)
9. Concurrency and migration upgrade tests
10. Full regression checkpoint
