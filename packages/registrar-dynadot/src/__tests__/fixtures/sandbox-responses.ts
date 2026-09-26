/**
 * PrisNames — Dynadot REST v2 Sanitized Fixtures
 * 
 * Generated from real sandbox responses (2026-09-13).
 * All secrets, real PII, and account identifiers REDACTED.
 * 
 * These fixtures preserve actual Dynadot REST v2 response quirks:
 * - Nested data.account_info wrapper
 * - available: "Yes"/"No" strings (not booleans)
 * - all_years_register_price: string[] arrays
 * - phone_cc / fax_cc / zip field names
 * - "--" sentinel for unavailable prices
 * - "0.00" for genuinely free values
 * - Response envelope: { code, message, data }
 */

// ── Account Info ──

export const FIXTURE_ACCOUNT_INFO_RESPONSE = {
  code: 200,
  message: 'Success',
  data: {
    account_info: {
      account_name: 'sandbox-test-account',
      email: 'test@example.com',
      account_balance: '100.00',
      currency: 'USD',
    },
  },
} as const;

// ── Domain Search ──

export const FIXTURE_DOMAIN_SEARCH_AVAILABLE = {
  code: 200,
  message: 'Success',
  data: {
    domain_name: 'test-available-domain.xyz',
    available: 'Yes',    // String, not boolean
  },
} as const;

export const FIXTURE_DOMAIN_SEARCH_TAKEN = {
  code: 200,
  message: 'Success',
  data: {
    domain_name: 'example.com',
    available: 'No',     // String, not boolean
  },
} as const;

// ── Pricing ──

export const FIXTURE_PRICING_NORMAL = {
  code: 200,
  message: 'Success',
  data: {
    tld_price_list: [
      {
        tld: '.com',
        all_years_register_price: ['0.38'],  // string[], not number
        all_years_renew_price: ['0.30'],
        transfer_price: '0.54',
        restore_price: '0.29',
        grace_fee_price: '0.00',             // "0.00" = genuinely free, NOT "--"
      },
      {
        tld: '.xyz',
        all_years_register_price: ['39.00'],
        all_years_renew_price: ['87.00'],
        transfer_price: '86.00',
        restore_price: '89.00',
        grace_fee_price: '0.00',
      },
    ],
    pagination_result: {
      page: 1,
      page_size: 25,
      total: 442,
      has_next_page: 'No',
    },
  },
} as const;

export const FIXTURE_PRICING_WITH_SENTINEL = {
  code: 200,
  message: 'Success',
  data: {
    tld_price_list: [
      {
        tld: '.co.uk',
        all_years_register_price: ['81.00'],
        all_years_renew_price: ['81.00'],
        transfer_price: '--',    // SENTINEL: unavailable, NOT zero, NOT an error
        restore_price: '--',     // SENTINEL: unavailable
        grace_fee_price: '0.00',
      },
    ],
  },
} as const;

// ── Contacts ──

export const FIXTURE_CONTACT = {
  code: 200,
  message: 'Success',
  data: {
    contact_id: 3001,
    organization: 'Test Organization',
    name: 'Test User',
    email: 'test@example.com',
    phone_cc: '1',               // NOT phone_country_code
    phone_number: '5555550100',
    fax_cc: '',                   // NOT fax_country_code
    fax_number: '',
    address1: '100 Test St',
    address2: '',
    city: 'Testville',
    state: 'CA',
    zip: '90210',                // NOT zip_code
    country: 'US',
  },
} as const;

// ── Domain Info ──

export const FIXTURE_DOMAIN_INFO = {
  code: 200,
  message: 'Success',
  data: {
    domain_name: 'test-domain.xyz',
    status: 'active',
    expiration_date: 1757750400000,
    registration_date: 1726214400000,
    renew_option: 'auto',         // NOT 'auto_renew'
    is_locked: true,              // boolean
    privacy: 'full',
    nameserver_list: ['ns1.dynadot.com', 'ns1.dynadot.com'],  // duplicates possible
    registrant_contact_id: 3001,
    admin_contact_id: 3001,
    technical_contact_id: 3001,
    billing_contact_id: 3001,
  },
} as const;

// ── DNS ──

export const FIXTURE_DNS_EMPTY = {
  code: 200,
  message: 'Success',
  data: {
    glue_info: {
      glue_type: 'DNS',
      ttl: '28800',    // String, not number
    },
    // No dns_main_list or dns_sub_list when empty
  },
} as const;

// ── Registration ──

export const FIXTURE_REGISTRATION_REQUEST = {
  // Body structure verified by sandbox
  domain: {
    duration: 1,
    privacy: 'full',
  },
  currency: 'USD',
} as const;

// ── Response Envelope ──

export const FIXTURE_ERROR_RESPONSE = {
  code: 400,
  message: 'Bad Request',
  error: {
    description: 'The required parameter year is missing.',
  },
} as const;

export const FIXTURE_AUTH_ERROR = {
  code: 401,
  message: 'Unauthorized',
  error: {
    description: 'This API is only available for specific accounts. please contact support for more information.',
  },
} as const;

// ── Pagination ──

export const FIXTURE_PAGINATION_RESULT = {
  page: 1,
  page_size: 5,
  total: 1,
  has_next_page: 'No',    // String "Yes"/"No", not boolean
} as const;

export const FIXTURE_DOMAIN_LIST_RESPONSE = {
  code: 200,
  message: 'Success',
  data: {
    domain_info_list: [
      {
        domain_name: 'test-domain.xyz',
        status: 'active',
        expiration_date: 1757750400000,
      },
    ],
    pagination_result: {
      page: 1,
      page_size: 5,
      total: 1,
      has_next_page: 'No',
    },
  },
} as const;
