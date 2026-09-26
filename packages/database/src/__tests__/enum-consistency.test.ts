/**
 * PrisNames — Enum Consistency Test
 *
 * Validates that TypeScript enum values match the approved architecture.
 * Reference: ORDER_STATE_MACHINE.md, DATABASE.md
 */

import { describe, it, expect } from 'vitest';
import {
  ORDER_STATUS, ORDER_STATUS_VALUES,
  PAYMENT_STATUS, PAYMENT_STATUS_VALUES,
  REFUND_STATUS, REFUND_STATUS_VALUES,
  REGISTRAR_OP_STATUS, REGISTRAR_OP_STATUS_VALUES,
  DOMAIN_LIFECYCLE, DOMAIN_LIFECYCLE_VALUES,
  TRANSFER_STATUS, TRANSFER_STATUS_VALUES,
  ACCOUNT_STATUS, ACCOUNT_STATUS_VALUES,
  INVOICE_STATUS, INVOICE_STATUS_VALUES,
  ABUSE_CATEGORY, ABUSE_CATEGORY_VALUES,
  ABUSE_STATUS, ABUSE_STATUS_VALUES,
  COMPLIANCE_STATUS,
  EMAIL_STATUS,
  WEBHOOK_STATUS,
  JOB_STATUS,
} from '../schema/enums.js';

describe('Enum Consistency', () => {
  it('ORDER_STATUS matches ORDER_STATE_MACHINE.md §1.1', () => {
    expect(ORDER_STATUS_VALUES).toEqual([
      'DRAFT', 'PENDING_PAYMENT', 'PROCESSING', 'COMPLETED',
      'FAILED', 'CANCELLED', 'REFUND_REQUIRED', 'REFUND_PENDING',
      'REFUNDED', 'PARTIALLY_REFUNDED',
    ]);
    expect(ORDER_STATUS_VALUES.length).toBe(10);
  });

  it('PAYMENT_STATUS matches ORDER_STATE_MACHINE.md §1.2', () => {
    expect(PAYMENT_STATUS_VALUES).toEqual([
      'CREATED', 'PENDING', 'PROCESSING', 'SUCCEEDED',
      'FAILED', 'EXPIRED', 'CANCELLED',
    ]);
    expect(PAYMENT_STATUS_VALUES.length).toBe(7);
  });

  it('REFUND_STATUS matches ORDER_STATE_MACHINE.md §1.3', () => {
    expect(REFUND_STATUS_VALUES).toEqual([
      'CREATED', 'PENDING', 'PROCESSING', 'COMPLETED',
      'FAILED', 'CANCELLED',
    ]);
    expect(REFUND_STATUS_VALUES.length).toBe(6);
  });

  it('REGISTRAR_OP_STATUS matches ORDER_STATE_MACHINE.md §1.4', () => {
    expect(REGISTRAR_OP_STATUS_VALUES).toEqual([
      'QUEUED', 'PROCESSING', 'ACCEPTED', 'SUCCEEDED',
      'UNKNOWN', 'RETRY_PENDING', 'FAILED', 'MANUAL_REVIEW', 'CANCELLED',
    ]);
    expect(REGISTRAR_OP_STATUS_VALUES.length).toBe(9);
  });

  it('DOMAIN_LIFECYCLE matches ORDER_STATE_MACHINE.md §1.5', () => {
    expect(DOMAIN_LIFECYCLE_VALUES).toEqual([
      'PENDING_REGISTRATION', 'ACTIVE', 'INACTIVE', 'EXPIRED',
      'REDEMPTION', 'PENDING_DELETE', 'DELETED', 'REGISTRATION_FAILED',
    ]);
    expect(DOMAIN_LIFECYCLE_VALUES.length).toBe(8);
  });

  it('TRANSFER_STATUS matches ORDER_STATE_MACHINE.md §1.7', () => {
    expect(TRANSFER_STATUS_VALUES).toEqual([
      'INITIATED', 'AUTH_CODE_SUBMITTED', 'PENDING_APPROVAL',
      'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED',
    ]);
    expect(TRANSFER_STATUS_VALUES.length).toBe(7);
  });

  it('ACCOUNT_STATUS has correct values', () => {
    expect(ACCOUNT_STATUS_VALUES).toEqual(['ACTIVE', 'DISABLED', 'SUSPENDED']);
  });

  it('INVOICE_STATUS has correct values', () => {
    expect(INVOICE_STATUS_VALUES).toEqual(['DRAFT', 'ISSUED', 'PAID', 'VOID', 'REFUNDED']);
  });

  it('ABUSE_CATEGORY has correct values', () => {
    expect(ABUSE_CATEGORY_VALUES.length).toBe(8);
    expect(ABUSE_CATEGORY_VALUES).toContain('PHISHING');
    expect(ABUSE_CATEGORY_VALUES).toContain('MALWARE');
  });

  it('ABUSE_STATUS has correct values', () => {
    expect(ABUSE_STATUS_VALUES.length).toBe(8);
    expect(ABUSE_STATUS_VALUES).toContain('OPEN');
    expect(ABUSE_STATUS_VALUES).toContain('ESCALATED_TO_REGISTRAR');
  });

  it('enum keys match their string values (no typos)', () => {
    const enums = [
      ORDER_STATUS, PAYMENT_STATUS, REFUND_STATUS, REGISTRAR_OP_STATUS,
      DOMAIN_LIFECYCLE, TRANSFER_STATUS, ACCOUNT_STATUS, INVOICE_STATUS,
      ABUSE_CATEGORY, ABUSE_STATUS, COMPLIANCE_STATUS, EMAIL_STATUS,
      WEBHOOK_STATUS, JOB_STATUS,
    ];

    for (const enumObj of enums) {
      for (const [key, value] of Object.entries(enumObj)) {
        expect(key).toBe(value);
      }
    }
  });
});
