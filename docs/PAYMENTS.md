# PrisNames — Payments Architecture

> **Strategy**: Provider-abstracted, PaymentProvider interface  
> **State Machine**: PaymentStatus (7 states), RefundStatus (6 states)  
> **Money**: Integer minor units + currency code  
> **Providers (future)**: PhonePe, Triple-A, CoinGate

---

## 1. Architecture

### 1.1 Abstraction

```
Business Logic (OrderService)
        │
        │ depends on interface
        ▼
PaymentProvider (packages/payment-core)
        │
        │ resolved at runtime
        ▼
PhonePePaymentProvider    (future — when docs provided)
TripleAPaymentProvider    (future — when docs provided)
CoinGatePaymentProvider   (future — when docs provided)
```

**Rule**: Payment provider implementations are ONLY created when actual API documentation is provided. Do not implement fake external integrations.

### 1.2 Package Boundary

| Package | Contains |
|---------|----------|
| `packages/payment-core` | `PaymentProvider` interface, normalized models, error types |
| `packages/payment-{provider}` | Provider-specific implementation (created when documentation provided) |

---

## 2. PaymentProvider Interface

```typescript
// packages/payment-core/src/interfaces/payment-provider.interface.ts

interface PaymentProvider {
  readonly providerId: string;        // "phonepe", "triple_a", "coingate"
  readonly providerName: string;

  // Create a payment intent/session
  createPayment(params: CreatePaymentParams): Promise<PaymentCreationResult>;

  // Retrieve payment status from gateway
  getPayment(providerPaymentId: string): Promise<PaymentInfo>;

  // Verify incoming webhook signature
  verifyWebhook(headers: Record<string, string>, body: string): Promise<WebhookVerificationResult>;

  // Parse webhook payload into normalized event
  parseWebhookEvent(body: string): Promise<PaymentWebhookEvent>;

  // Issue a refund
  refund(params: RefundParams): Promise<RefundResult>;

  // Get refund status
  getRefundStatus(providerRefundId: string): Promise<RefundInfo>;
}

interface CreatePaymentParams {
  orderId: string;
  amount: MoneyAmount;
  description: string;
  returnUrl: string;
  webhookUrl: string;
  metadata?: Record<string, string>;
}

interface PaymentCreationResult {
  providerPaymentId: string;
  redirectUrl: string;         // URL to redirect customer for payment
  expiresAt: Date | null;
  status: string;
}

interface MoneyAmount {
  amount: number;              // Minor units (e.g., 1299 = $12.99)
  currency: string;            // ISO 4217 (e.g., "USD", "INR")
}
```

---

## 3. Payment Flow

### 3.1 Checkout Flow

```
1. Customer reviews order (Order.status = DRAFT)
        ↓
2. Customer selects payment method
        ↓
3. POST /api/v1/payments
     { orderId, paymentMethod }
        ↓
4. OrderService.markPendingPayment(orderId)
     → Order.status = PENDING_PAYMENT
        ↓
5. PaymentService.create(orderId)
     → Create payments record (Payment.status = CREATED)
     → PaymentProvider.createPayment(params)
        ↓
6. Receive redirectUrl from gateway
     → Payment.status = PENDING
        ↓
7. Redirect customer to payment gateway
        ↓
8. Customer completes payment on gateway
        ↓
9. Gateway redirects customer to return URL
     → Customer sees "Processing..." page
        ↓
10. Gateway sends webhook
```

### 3.2 Payment Webhook Processing

```
POST /api/v1/webhooks/payments/{provider}
        ↓
PaymentProvider.verifyWebhook(headers, body)
        ↓
PaymentProvider.parseWebhookEvent(body)
        ↓
Deduplicate by provider_payment_id
        ↓
Determine event type:

    PAYMENT_SUCCEEDED:
        → PaymentService.succeed(paymentId)
            → Payment.status = SUCCEEDED
            → Payment.status is now IMMUTABLE
        → OrderService.markProcessing(orderId)
            → Order.status = PROCESSING
        → Enqueue registrar operations for all order items
        → Queue payment receipt email

    PAYMENT_FAILED:
        → PaymentService.fail(paymentId)
            → Payment.status = FAILED
        → OrderService.markFailed(orderId)
            → Order.status = FAILED
        → Queue failure notification email

    PAYMENT_EXPIRED:
        → PaymentService.expire(paymentId)
            → Payment.status = EXPIRED
        → OrderService.markCancelled(orderId)
            → Order.status = CANCELLED
```

---

## 4. Money Handling

### 4.1 Representation

All monetary amounts use integer minor units with explicit currency:

```typescript
interface MoneyAmount {
  amount: number;     // Integer, minor units
  currency: string;   // ISO 4217
}

// Examples:
// $12.99 → { amount: 1299, currency: "USD" }
// ₹1,299.00 → { amount: 129900, currency: "INR" }
// 0.005 BTC → handled per crypto gateway rules
```

### 4.2 Rules

1. **Never use floating-point arithmetic for money**
2. All arithmetic uses integer operations (addition, subtraction, multiplication)
3. Division must use integer division with explicit rounding rules
4. All money values must include their currency
5. Currency mismatch in operations is a fatal error (not silently converted)
6. Display formatting (symbol, decimals, locale) is a presentation concern in `apps/web`
7. Database columns: `INTEGER` for amount, `VARCHAR(3)` for currency

### 4.3 Currency Conversion

- V1: Single base currency per order (likely INR or USD, TBD)
- Dynadot prices are in USD — conversion happens at quote time
- Conversion rates are not live-tracked (admin sets retail prices in customer currency)
- Future: Multi-currency support with rate snapshots at checkout

---

## 5. Quote System

Quotes prevent stale pricing from reaching checkout:

```
Search → Display price (informational)
        ↓
Customer selects domain → Create quote (price snapshot)
        ↓
Quote has expiration (default 15 min)
        ↓
At checkout → Validate quote not expired
        ↓
At payment confirmation → Final live price check against provider
        ↓
If price changed significantly → Reject, create new quote
```

### 5.1 Quote Entity

```typescript
interface Quote {
  id: string;
  userId: string;
  domain: string;
  operation: 'register' | 'renew' | 'transfer';
  years: number;
  retailAmount: MoneyAmount;
  providerCostAmount: MoneyAmount;
  isPremium: boolean;
  registrarProviderId: string;
  expiresAt: Date;
  createdAt: Date;
}
```

### 5.2 Premium Domain Price Validation

Premium domains NEVER use cached TLD pricing. Before checkout:

1. Recheck availability via `RegistrarProvider.checkAvailability()`
2. Recheck premium status
3. Recheck current price directly from provider
4. If price differs from quote → invalidate quote, notify customer

---

## 6. Order Architecture

### 6.1 Order Entity

```
Order ──1:N──▶ OrderItem (each item = one domain operation)
Order ──1:N──▶ Payment (typically 1, but supports retry)
Order ──1:N──▶ Refund (0 or more)
Order ──1:N──▶ RegistrarOperation (one per order_item)
```

### 6.2 Order Item Types

| Type | Description |
|------|-------------|
| `register` | New domain registration |
| `renew` | Domain renewal |
| `transfer` | Domain transfer-in |
| `restore` | Domain restoration from redemption |

Future order item types (not V1): SSL, Email, Hosting.

### 6.3 Order Calculations

```
subtotal = SUM(order_items.amount)
tax = calculated based on jurisdiction (V1: 0, future: configurable)
discount = applied promotions/coupons (V1: 0)
total = subtotal + tax - discount
```

All calculated at order creation. Stored as integers in minor units.

---

## 7. Refund Architecture

Refunds are a separate entity (see ORDER_STATE_MACHINE.md §1.3). They are NOT a reversal of Payment status.

### 7.1 Refund Triggers

| Trigger | Source |
|---------|--------|
| Registration failed after payment | Automatic |
| Domain unavailable at registration time | Automatic |
| Renewal failed | Automatic |
| Transfer failed | Automatic |
| Grace delete | Partial (registration cost minus ICANN fee) |
| Admin-initiated | Manual (requires reason, audit-logged) |
| Customer request | Manual (admin reviews and approves) |

### 7.2 Refund Flow

```
Trigger (auto or admin)
        ↓
RefundService.create(orderId, paymentId, amount, reason)
    → Refund.status = CREATED
        ↓
RefundService.initiate(refundId)
    → Refund.status = PENDING
    → PaymentProvider.refund(params)
        ↓
Gateway processes refund
        ↓
Webhook or poll:

    Success:
        → Refund.status = COMPLETED
        → Order.status = REFUNDED (or PARTIALLY_REFUNDED if partial)
        → Queue refund confirmation email
        → Audit log: 'refund.completed'

    Failed:
        → Refund.status = FAILED
        → Alert admin
        → Manual resolution required
```

### 7.3 Partial Refund

An order can be partially refunded when it has multiple items and only some fail:

```
Order with items: [registration A (succeeded), registration B (failed)]
    → Registration A → Order item succeeds
    → Registration B → Order item fails → Refund for item B only
    → Order.status = PARTIALLY_REFUNDED
```

---

## 8. Invoice Generation

Invoices are created when an order is completed:

- Sequential, human-readable invoice numbers (e.g., `INV-2026-000001`)
- Include order details, payment details, tax (if applicable)
- Status: DRAFT → ISSUED → PAID → VOID or REFUNDED
- Downloadable as PDF (future)
- Accessible via customer dashboard and admin panel

---

## 9. Future Payment Providers

| Provider | Type | When |
|----------|------|------|
| **PhonePe** | UPI/Card (India) | When documentation provided |
| **Triple-A** | Crypto payments | When documentation provided |
| **CoinGate** | Crypto payments | When documentation provided |

**Implementation Rules:**
1. Only implemented when actual API documentation is provided
2. Each provider creates `packages/payment-{provider}/` implementing `PaymentProvider`
3. Provider-specific DTOs and mappers stay inside their package
4. Business logic never imports provider-specific packages
5. Provider selection: initially admin-configured, future: customer choice at checkout
6. Feature flags control provider availability (e.g., `PHONEPE`, `CRYPTO_PAYMENTS`)
