/**
 * PrisNames — Money Model Tests
 *
 * Currency exponents, exact decimal parsing, no floating point.
 */

import { describe, it, expect } from 'vitest';
import {
  parseMoneyFromDecimal,
  formatMoneyToDecimal,
  UnsupportedCurrencyError,
  MoneyParseError,
} from '../models/money.js';

describe('parseMoneyFromDecimal', () => {
  it('parses USD (exponent=2)', () => {
    const result = parseMoneyFromDecimal('12.99', 'USD');
    expect(result.minorUnits).toBe(1299n);
    expect(result.currency).toBe('USD');
    expect(result.exponent).toBe(2);
  });

  it('parses JPY (exponent=0)', () => {
    const result = parseMoneyFromDecimal('1500', 'JPY');
    expect(result.minorUnits).toBe(1500n);
    expect(result.currency).toBe('JPY');
    expect(result.exponent).toBe(0);
  });

  it('parses BHD (exponent=3)', () => {
    const result = parseMoneyFromDecimal('4.567', 'BHD');
    expect(result.minorUnits).toBe(4567n);
    expect(result.currency).toBe('BHD');
    expect(result.exponent).toBe(3);
  });

  it('parses whole number with no decimal for USD', () => {
    const result = parseMoneyFromDecimal('10', 'USD');
    expect(result.minorUnits).toBe(1000n);
  });

  it('pads fractional part to match exponent', () => {
    const result = parseMoneyFromDecimal('5.5', 'USD');
    expect(result.minorUnits).toBe(550n);
  });

  it('handles zero', () => {
    const result = parseMoneyFromDecimal('0', 'USD');
    expect(result.minorUnits).toBe(0n);
  });

  it('handles zero with decimals', () => {
    const result = parseMoneyFromDecimal('0.00', 'USD');
    expect(result.minorUnits).toBe(0n);
  });

  it('handles large amounts without precision loss', () => {
    const result = parseMoneyFromDecimal('999999.99', 'USD');
    expect(result.minorUnits).toBe(99999999n);
  });

  it('allows trailing zeros beyond exponent', () => {
    const result = parseMoneyFromDecimal('10.500', 'USD');
    expect(result.minorUnits).toBe(1050n);
  });

  it('normalizes currency to uppercase', () => {
    const result = parseMoneyFromDecimal('10.00', 'usd');
    expect(result.currency).toBe('USD');
  });

  it('throws UnsupportedCurrencyError for unknown currency', () => {
    expect(() => parseMoneyFromDecimal('10.00', 'XYZ')).toThrow(UnsupportedCurrencyError);
  });

  it('throws MoneyParseError for too many decimal places', () => {
    expect(() => parseMoneyFromDecimal('10.999', 'USD')).toThrow(MoneyParseError);
  });

  it('throws MoneyParseError for non-numeric input', () => {
    expect(() => parseMoneyFromDecimal('abc', 'USD')).toThrow(MoneyParseError);
  });

  it('throws MoneyParseError for empty string', () => {
    expect(() => parseMoneyFromDecimal('', 'USD')).toThrow(MoneyParseError);
  });

  it('handles JPY with no decimals expected', () => {
    const result = parseMoneyFromDecimal('100', 'JPY');
    expect(result.minorUnits).toBe(100n);
  });

  it('rejects JPY with non-zero decimals', () => {
    expect(() => parseMoneyFromDecimal('100.5', 'JPY')).toThrow(MoneyParseError);
  });

  it('allows JPY with .0 (trailing zeros)', () => {
    const result = parseMoneyFromDecimal('100.0', 'JPY');
    expect(result.minorUnits).toBe(100n);
  });

  it('handles KWD (exponent=3)', () => {
    const result = parseMoneyFromDecimal('1.234', 'KWD');
    expect(result.minorUnits).toBe(1234n);
  });
});

describe('formatMoneyToDecimal', () => {
  it('formats USD correctly', () => {
    expect(formatMoneyToDecimal({ minorUnits: 1299n, currency: 'USD', exponent: 2 }))
      .toBe('12.99');
  });

  it('formats JPY correctly (no decimals)', () => {
    expect(formatMoneyToDecimal({ minorUnits: 1500n, currency: 'JPY', exponent: 0 }))
      .toBe('1500');
  });

  it('formats BHD correctly (3 decimals)', () => {
    expect(formatMoneyToDecimal({ minorUnits: 4567n, currency: 'BHD', exponent: 3 }))
      .toBe('4.567');
  });

  it('formats zero', () => {
    expect(formatMoneyToDecimal({ minorUnits: 0n, currency: 'USD', exponent: 2 }))
      .toBe('0.00');
  });

  it('formats small amounts with leading zero', () => {
    expect(formatMoneyToDecimal({ minorUnits: 5n, currency: 'USD', exponent: 2 }))
      .toBe('0.05');
  });

  it('roundtrips correctly', () => {
    const original = '123.45';
    const parsed = parseMoneyFromDecimal(original, 'USD');
    expect(formatMoneyToDecimal(parsed)).toBe(original);
  });
});
