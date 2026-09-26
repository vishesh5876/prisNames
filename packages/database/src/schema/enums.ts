/**
 * PrisNames — Database Enums
 *
 * TypeScript const objects for all status/state columns.
 * VARCHAR-backed in PostgreSQL with CHECK constraints — NOT pgEnum.
 * This enables safe migration evolution (adding values doesn't require ALTER TYPE).
 *
 * Each enum exports:
 * - A const object for TypeScript type safety
 * - A values tuple for CHECK constraint generation
 * - A TypeScript type derived from the values
 */

// ──────────────────────────────────────────────
// Helper to extract values tuple from const object
// ──────────────────────────────────────────────

function enumValues<T extends Record<string, string>>(obj: T): [T[keyof T], ...T[keyof T][]] {
  const vals = Object.values(obj) as T[keyof T][];
  return vals as [T[keyof T], ...T[keyof T][]];
}

// ──────────────────────────────────────────────
// ORDER STATUS — ORDER_STATE_MACHINE.md §1.1
// ──────────────────────────────────────────────

export const ORDER_STATUS = {
  DRAFT: 'DRAFT',
  PENDING_PAYMENT: 'PENDING_PAYMENT',
  PROCESSING: 'PROCESSING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED',
  REFUND_REQUIRED: 'REFUND_REQUIRED',
  REFUND_PENDING: 'REFUND_PENDING',
  REFUNDED: 'REFUNDED',
  PARTIALLY_REFUNDED: 'PARTIALLY_REFUNDED',
} as const;

export type OrderStatus = (typeof ORDER_STATUS)[keyof typeof ORDER_STATUS];
export const ORDER_STATUS_VALUES = enumValues(ORDER_STATUS);

// ──────────────────────────────────────────────
// PAYMENT STATUS — ORDER_STATE_MACHINE.md §1.2
// ──────────────────────────────────────────────

export const PAYMENT_STATUS = {
  CREATED: 'CREATED',
  PENDING: 'PENDING',
  PROCESSING: 'PROCESSING',
  SUCCEEDED: 'SUCCEEDED',
  FAILED: 'FAILED',
  EXPIRED: 'EXPIRED',
  CANCELLED: 'CANCELLED',
} as const;

export type PaymentStatus = (typeof PAYMENT_STATUS)[keyof typeof PAYMENT_STATUS];
export const PAYMENT_STATUS_VALUES = enumValues(PAYMENT_STATUS);

// ──────────────────────────────────────────────
// REFUND STATUS — ORDER_STATE_MACHINE.md §1.3
// ──────────────────────────────────────────────

export const REFUND_STATUS = {
  CREATED: 'CREATED',
  PENDING: 'PENDING',
  PROCESSING: 'PROCESSING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED',
} as const;

export type RefundStatus = (typeof REFUND_STATUS)[keyof typeof REFUND_STATUS];
export const REFUND_STATUS_VALUES = enumValues(REFUND_STATUS);

// ──────────────────────────────────────────────
// REGISTRAR OPERATION STATUS — ORDER_STATE_MACHINE.md §1.4
// ──────────────────────────────────────────────

export const REGISTRAR_OP_STATUS = {
  QUEUED: 'QUEUED',
  PROCESSING: 'PROCESSING',
  ACCEPTED: 'ACCEPTED',
  SUCCEEDED: 'SUCCEEDED',
  UNKNOWN: 'UNKNOWN',
  RETRY_PENDING: 'RETRY_PENDING',
  FAILED: 'FAILED',
  MANUAL_REVIEW: 'MANUAL_REVIEW',
  CANCELLED: 'CANCELLED',
} as const;

export type RegistrarOpStatus = (typeof REGISTRAR_OP_STATUS)[keyof typeof REGISTRAR_OP_STATUS];
export const REGISTRAR_OP_STATUS_VALUES = enumValues(REGISTRAR_OP_STATUS);

// ──────────────────────────────────────────────
// DOMAIN LIFECYCLE — ORDER_STATE_MACHINE.md §1.5
// ──────────────────────────────────────────────

export const DOMAIN_LIFECYCLE = {
  PENDING_REGISTRATION: 'PENDING_REGISTRATION',
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
  EXPIRED: 'EXPIRED',
  REDEMPTION: 'REDEMPTION',
  PENDING_DELETE: 'PENDING_DELETE',
  DELETED: 'DELETED',
  REGISTRATION_FAILED: 'REGISTRATION_FAILED',
} as const;

export type DomainLifecycleStatus = (typeof DOMAIN_LIFECYCLE)[keyof typeof DOMAIN_LIFECYCLE];
export const DOMAIN_LIFECYCLE_VALUES = enumValues(DOMAIN_LIFECYCLE);

// ──────────────────────────────────────────────
// TRANSFER STATUS — ORDER_STATE_MACHINE.md §1.7
// ──────────────────────────────────────────────

export const TRANSFER_STATUS = {
  INITIATED: 'INITIATED',
  AUTH_CODE_SUBMITTED: 'AUTH_CODE_SUBMITTED',
  PENDING_APPROVAL: 'PENDING_APPROVAL',
  PROCESSING: 'PROCESSING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED',
} as const;

export type TransferStatus = (typeof TRANSFER_STATUS)[keyof typeof TRANSFER_STATUS];
export const TRANSFER_STATUS_VALUES = enumValues(TRANSFER_STATUS);

// ──────────────────────────────────────────────
// ACCOUNT STATUS — DATABASE.md §3.1
// ──────────────────────────────────────────────

export const ACCOUNT_STATUS = {
  ACTIVE: 'ACTIVE',
  DISABLED: 'DISABLED',
  SUSPENDED: 'SUSPENDED',
} as const;

export type AccountStatus = (typeof ACCOUNT_STATUS)[keyof typeof ACCOUNT_STATUS];
export const ACCOUNT_STATUS_VALUES = enumValues(ACCOUNT_STATUS);

// ──────────────────────────────────────────────
// INVOICE STATUS — DATABASE.md §3.5
// ──────────────────────────────────────────────

export const INVOICE_STATUS = {
  DRAFT: 'DRAFT',
  ISSUED: 'ISSUED',
  PAID: 'PAID',
  VOID: 'VOID',
  REFUNDED: 'REFUNDED',
} as const;

export type InvoiceStatus = (typeof INVOICE_STATUS)[keyof typeof INVOICE_STATUS];
export const INVOICE_STATUS_VALUES = enumValues(INVOICE_STATUS);

// ──────────────────────────────────────────────
// ABUSE CATEGORY — DATABASE.md §3.6
// ──────────────────────────────────────────────

export const ABUSE_CATEGORY = {
  PHISHING: 'PHISHING',
  MALWARE: 'MALWARE',
  FINANCIAL_FRAUD: 'FINANCIAL_FRAUD',
  IMPERSONATION: 'IMPERSONATION',
  SPAM: 'SPAM',
  TRADEMARK: 'TRADEMARK',
  ILLEGAL_CONTENT: 'ILLEGAL_CONTENT',
  OTHER: 'OTHER',
} as const;

export type AbuseCategory = (typeof ABUSE_CATEGORY)[keyof typeof ABUSE_CATEGORY];
export const ABUSE_CATEGORY_VALUES = enumValues(ABUSE_CATEGORY);

// ──────────────────────────────────────────────
// ABUSE STATUS — DATABASE.md §3.6
// ──────────────────────────────────────────────

export const ABUSE_STATUS = {
  OPEN: 'OPEN',
  UNDER_REVIEW: 'UNDER_REVIEW',
  AWAITING_INFORMATION: 'AWAITING_INFORMATION',
  ACTION_REQUIRED: 'ACTION_REQUIRED',
  ESCALATED_TO_REGISTRAR: 'ESCALATED_TO_REGISTRAR',
  SUSPENDED: 'SUSPENDED',
  RESOLVED: 'RESOLVED',
  REJECTED: 'REJECTED',
} as const;

export type AbuseStatus = (typeof ABUSE_STATUS)[keyof typeof ABUSE_STATUS];
export const ABUSE_STATUS_VALUES = enumValues(ABUSE_STATUS);

// ──────────────────────────────────────────────
// COMPLIANCE STATUS — DATABASE.md §3.6
// ──────────────────────────────────────────────

export const COMPLIANCE_STATUS = {
  OPEN: 'OPEN',
  IN_PROGRESS: 'IN_PROGRESS',
  RESPONDED: 'RESPONDED',
  CLOSED: 'CLOSED',
} as const;

export type ComplianceStatus = (typeof COMPLIANCE_STATUS)[keyof typeof COMPLIANCE_STATUS];
export const COMPLIANCE_STATUS_VALUES = enumValues(COMPLIANCE_STATUS);

// ──────────────────────────────────────────────
// EMAIL STATUS — DATABASE.md §3.7
// ──────────────────────────────────────────────

export const EMAIL_STATUS = {
  QUEUED: 'QUEUED',
  SENT: 'SENT',
  DELIVERED: 'DELIVERED',
  BOUNCED: 'BOUNCED',
  FAILED: 'FAILED',
} as const;

export type EmailStatus = (typeof EMAIL_STATUS)[keyof typeof EMAIL_STATUS];
export const EMAIL_STATUS_VALUES = enumValues(EMAIL_STATUS);

// ──────────────────────────────────────────────
// WEBHOOK PROCESSING STATUS — DATABASE.md §3.7
// ──────────────────────────────────────────────

export const WEBHOOK_STATUS = {
  RECEIVED: 'RECEIVED',
  QUEUED: 'QUEUED',
  PROCESSING: 'PROCESSING',
  PROCESSED: 'PROCESSED',
  FAILED: 'FAILED',
} as const;

export type WebhookStatus = (typeof WEBHOOK_STATUS)[keyof typeof WEBHOOK_STATUS];
export const WEBHOOK_STATUS_VALUES = enumValues(WEBHOOK_STATUS);

// ──────────────────────────────────────────────
// JOB STATUS — DATABASE.md §3.7
// ──────────────────────────────────────────────

export const JOB_STATUS = {
  QUEUED: 'QUEUED',
  ACTIVE: 'ACTIVE',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
} as const;

export type JobStatus = (typeof JOB_STATUS)[keyof typeof JOB_STATUS];
export const JOB_STATUS_VALUES = enumValues(JOB_STATUS);
