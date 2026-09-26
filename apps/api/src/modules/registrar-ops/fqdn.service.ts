/**
 * PrisNames — FQDN Service
 *
 * Canonicalization and validation of Fully Qualified Domain Names.
 * Uses explicit ASCII hostname validation — NOT URL parser.
 *
 * Rules:
 * - IDN (non-ASCII) domains explicitly rejected
 * - URL-like syntax rejected (@, :, /, ?, #, brackets)
 * - IP literals rejected
 * - Labels validated: letters, digits, hyphens only, no leading/trailing hyphens
 * - Underscore is NOT valid in hostname labels
 *
 * Reference: Phase 6 Implementation Plan §9
 */

import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { REGISTRAR_ERROR_CODES } from '@prisnames/contracts';

// Characters valid in URLs but invalid in raw domain input
const INVALID_FQDN_CHARS = /[/@:?#[\]\\!$&'()*+,;=]/;

// ASCII hostname label: letters, digits, hyphen, no leading/trailing hyphen
const VALID_LABEL = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;

// IPv4 pattern (reject IP literals)
const IPV4_PATTERN = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/;

export class InvalidFqdnError extends HttpException {
  constructor(message: string) {
    super(
      { code: REGISTRAR_ERROR_CODES.INVALID_FQDN, message },
      HttpStatus.BAD_REQUEST,
    );
  }
}

export class IdnNotSupportedError extends HttpException {
  constructor(message?: string) {
    super(
      {
        code: REGISTRAR_ERROR_CODES.IDN_NOT_SUPPORTED,
        message: message ?? 'International domain names (IDN) are not supported yet. Use ASCII domains only.',
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}

@Injectable()
export class FqdnService {
  /**
   * Canonicalize an FQDN input: trim, lowercase, validate.
   * Returns the canonical form suitable for idempotency keys and DB storage.
   *
   * @throws InvalidFqdnError for invalid domain syntax
   * @throws IdnNotSupportedError for non-ASCII characters
   */
  canonicalize(input: string): string {
    // 1. Trim surrounding whitespace FIRST
    let fqdn = input.trim();

    // 2. Reject empty
    if (fqdn.length === 0) {
      throw new InvalidFqdnError('FQDN cannot be empty');
    }

    // 3. REJECT non-ASCII input explicitly (IDN not verified)
    if (/[^\x20-\x7E]/.test(fqdn)) {
      throw new IdnNotSupportedError();
    }

    // 4. Reject URL-like syntax characters
    if (INVALID_FQDN_CHARS.test(fqdn)) {
      throw new InvalidFqdnError(`FQDN contains invalid characters: ${fqdn}`);
    }

    // 5. Remove one permitted trailing dot (DNS absolute form)
    if (fqdn.endsWith('.')) {
      fqdn = fqdn.slice(0, -1);
    }

    // 6. Lowercase
    fqdn = fqdn.toLowerCase();

    // 7. Reject IP literals
    if (IPV4_PATTERN.test(fqdn) || fqdn.startsWith('[')) {
      throw new InvalidFqdnError('IP addresses are not valid FQDNs for registration');
    }

    // 8. Validate total length
    if (fqdn.length > 253) {
      throw new InvalidFqdnError('FQDN exceeds 253 characters');
    }

    // 9. Validate labels
    const labels = fqdn.split('.');
    if (labels.length < 2) {
      throw new InvalidFqdnError('FQDN must have at least 2 labels');
    }
    for (const label of labels) {
      if (label.length === 0) {
        throw new InvalidFqdnError('FQDN contains empty label');
      }
      if (label.length > 63) {
        throw new InvalidFqdnError(`Label exceeds 63 characters: ${label}`);
      }
      if (!VALID_LABEL.test(label)) {
        throw new InvalidFqdnError(
          `Invalid label '${label}': must contain only letters, digits, hyphens; cannot start or end with hyphen`,
        );
      }
    }

    return fqdn;
  }

  /**
   * Parse SLD and TLD from a canonical FQDN.
   */
  parseParts(fqdn: string): { sld: string; tld: string } {
    const dotIndex = fqdn.indexOf('.');
    return {
      sld: fqdn.slice(0, dotIndex),
      tld: fqdn.slice(dotIndex + 1),
    };
  }

  /**
   * Generate idempotency key for a registrar operation.
   * Format: "{providerId}:{opType}:{canonicalFqdn}:{orderItemId}"
   */
  buildIdempotencyKey(
    providerId: string,
    opType: string,
    fqdn: string,
    orderItemId: string,
  ): string {
    return `${providerId}:${opType}:${fqdn}:${orderItemId}`;
  }
}
