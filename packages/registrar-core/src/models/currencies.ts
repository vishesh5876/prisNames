/**
 * PrisNames — ISO 4217 Currency Metadata
 *
 * Trusted currency exponents for exact monetary calculations.
 * Provider-supplied exponent values are NEVER used directly.
 *
 * Covers all currencies supported by Dynadot REST v2 API plus
 * commonly referenced currencies for completeness.
 */

export interface CurrencyMetadata {
  readonly exponent: number;
  readonly name: string;
}

/**
 * Trusted ISO-4217 currency metadata.
 * Unknown currencies are rejected by parseMoneyFromDecimal().
 */
export const CURRENCY_METADATA: Readonly<Record<string, CurrencyMetadata>> = {
  // Dynadot-supported currencies (documented in REST v2 API)
  USD: { exponent: 2, name: 'US Dollar' },
  EUR: { exponent: 2, name: 'Euro' },
  GBP: { exponent: 2, name: 'British Pound' },
  AUD: { exponent: 2, name: 'Australian Dollar' },
  BRL: { exponent: 2, name: 'Brazilian Real' },
  CAD: { exponent: 2, name: 'Canadian Dollar' },
  CHF: { exponent: 2, name: 'Swiss Franc' },
  CNY: { exponent: 2, name: 'Chinese Yuan' },
  CZK: { exponent: 2, name: 'Czech Koruna' },
  DKK: { exponent: 2, name: 'Danish Krone' },
  HKD: { exponent: 2, name: 'Hong Kong Dollar' },
  IDR: { exponent: 2, name: 'Indonesian Rupiah' },
  ILS: { exponent: 2, name: 'Israeli New Shekel' },
  INR: { exponent: 2, name: 'Indian Rupee' },
  MXN: { exponent: 2, name: 'Mexican Peso' },
  MYR: { exponent: 2, name: 'Malaysian Ringgit' },
  NOK: { exponent: 2, name: 'Norwegian Krone' },
  NZD: { exponent: 2, name: 'New Zealand Dollar' },
  PHP: { exponent: 2, name: 'Philippine Peso' },
  PLN: { exponent: 2, name: 'Polish Zloty' },
  RON: { exponent: 2, name: 'Romanian Leu' },
  RUB: { exponent: 2, name: 'Russian Ruble' },
  SEK: { exponent: 2, name: 'Swedish Krona' },
  SGD: { exponent: 2, name: 'Singapore Dollar' },
  THB: { exponent: 2, name: 'Thai Baht' },
  TRY: { exponent: 2, name: 'Turkish Lira' },
  TWD: { exponent: 2, name: 'New Taiwan Dollar' },
  UAH: { exponent: 2, name: 'Ukrainian Hryvnia' },
  ZAR: { exponent: 2, name: 'South African Rand' },

  // Zero-decimal currencies
  JPY: { exponent: 0, name: 'Japanese Yen' },
  KRW: { exponent: 0, name: 'South Korean Won' },
  VND: { exponent: 0, name: 'Vietnamese Dong' },

  // Three-decimal currencies
  BHD: { exponent: 3, name: 'Bahraini Dinar' },
  KWD: { exponent: 3, name: 'Kuwaiti Dinar' },
  OMR: { exponent: 3, name: 'Omani Rial' },
};

/**
 * Get the trusted exponent for a currency code.
 * Returns undefined for unknown currencies.
 */
export function getCurrencyExponent(currency: string): number | undefined {
  return CURRENCY_METADATA[currency.toUpperCase()]?.exponent;
}
