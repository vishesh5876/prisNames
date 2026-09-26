/**
 * PrisNames — Money Model
 *
 * Exact monetary representation using bigint minor units.
 * NEVER uses JavaScript floating-point for pricing.
 *
 * Currency exponents come from trusted ISO-4217 metadata,
 * NOT from provider-supplied values.
 */

import { CURRENCY_METADATA } from './currencies.js';

// ──────────────────────────────────────────────
// MONEY AMOUNT
// ──────────────────────────────────────────────

export interface MoneyAmount {
  /** Exact integer in smallest currency unit (cents, sen, fils, etc.) */
  readonly minorUnits: bigint;
  /** ISO 4217 currency code (e.g. "USD", "JPY", "BHD") */
  readonly currency: string;
  /** Number of decimal places — from trusted ISO-4217 metadata */
  readonly exponent: number;
}

// ──────────────────────────────────────────────
// MONEY UTILITIES
// ──────────────────────────────────────────────

/**
 * Parse a provider decimal string into a MoneyAmount using trusted exponent.
 *
 * @throws {UnsupportedCurrencyError} if the currency is not in our metadata
 * @throws {MoneyParseError} if the decimal string cannot be parsed exactly
 *
 * @example
 *   parseMoneyFromDecimal('12.99', 'USD')
 *   // → { minorUnits: 1299n, currency: 'USD', exponent: 2 }
 *
 *   parseMoneyFromDecimal('1500', 'JPY')
 *   // → { minorUnits: 1500n, currency: 'JPY', exponent: 0 }
 */
export function parseMoneyFromDecimal(decimalStr: string, currency: string): MoneyAmount {
  const meta = CURRENCY_METADATA[currency.toUpperCase()];
  if (!meta) {
    throw new UnsupportedCurrencyError(currency);
  }

  const normalized = decimalStr.trim();
  if (normalized === '' || normalized === '-') {
    throw new MoneyParseError(decimalStr, currency, 'Empty or invalid amount');
  }

  const exponent = meta.exponent;

  // Split on decimal point
  const dotIndex = normalized.indexOf('.');
  let wholePart: string;
  let fracPart: string;

  if (dotIndex === -1) {
    wholePart = normalized;
    fracPart = '';
  } else {
    wholePart = normalized.slice(0, dotIndex);
    fracPart = normalized.slice(dotIndex + 1);
  }

  // Validate parts contain only digits (and optional leading minus)
  const isNegative = wholePart.startsWith('-');
  const absWhole = isNegative ? wholePart.slice(1) : wholePart;

  if (!/^\d*$/.test(absWhole) || !/^\d*$/.test(fracPart)) {
    throw new MoneyParseError(decimalStr, currency, 'Non-numeric characters');
  }

  // Pad or truncate fractional part to match exponent
  if (fracPart.length > exponent) {
    // Check that extra digits are all zeros (no silent truncation)
    const extraDigits = fracPart.slice(exponent);
    if (!/^0*$/.test(extraDigits)) {
      throw new MoneyParseError(
        decimalStr,
        currency,
        `Too many fractional digits for ${currency} (exponent=${exponent})`,
      );
    }
    fracPart = fracPart.slice(0, exponent);
  } else {
    fracPart = fracPart.padEnd(exponent, '0');
  }

  const combined = `${absWhole}${fracPart}` || '0';
  let minorUnits = BigInt(combined);
  if (isNegative) minorUnits = -minorUnits;

  return { minorUnits, currency: currency.toUpperCase(), exponent };
}

/**
 * Format a MoneyAmount back to a decimal string for display.
 */
export function formatMoneyToDecimal(amount: MoneyAmount): string {
  const { minorUnits, exponent } = amount;
  const isNegative = minorUnits < 0n;
  const abs = isNegative ? -minorUnits : minorUnits;
  const str = abs.toString();

  if (exponent === 0) {
    return `${isNegative ? '-' : ''}${str}`;
  }

  const padded = str.padStart(exponent + 1, '0');
  const wholePart = padded.slice(0, padded.length - exponent);
  const fracPart = padded.slice(padded.length - exponent);

  return `${isNegative ? '-' : ''}${wholePart}.${fracPart}`;
}

// ──────────────────────────────────────────────
// ERRORS
// ──────────────────────────────────────────────

export class UnsupportedCurrencyError extends Error {
  readonly currency: string;

  constructor(currency: string) {
    super(`Unsupported currency: ${currency}. Not found in ISO-4217 metadata.`);
    this.name = 'UnsupportedCurrencyError';
    this.currency = currency;
  }
}

export class MoneyParseError extends Error {
  readonly rawValue: string;
  readonly currency: string;

  constructor(rawValue: string, currency: string, reason: string) {
    super(`Failed to parse money "${rawValue}" as ${currency}: ${reason}`);
    this.name = 'MoneyParseError';
    this.rawValue = rawValue;
    this.currency = currency;
  }
}
