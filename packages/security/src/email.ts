/**
 * PrisNames — Email Normalization
 *
 * Canonical email strategy per DATABASE.md:
 * - email_canonical stores the lowercased email for uniqueness enforcement
 * - email stores the original casing for display purposes
 *
 * IMPORTANT: Do NOT rewrite addresses. Do NOT strip +tags.
 * Do NOT remove dots. Do NOT apply Gmail-specific normalization.
 *
 * john+work@gmail.com must NOT become john@gmail.com.
 */

/**
 * Normalize an email address for canonical storage.
 *
 * Only performs:
 * - Trim surrounding whitespace
 * - Lowercase the entire address
 *
 * Does NOT:
 * - Strip +tag aliases (john+work@gmail.com stays as-is)
 * - Remove dots (j.o.h.n@gmail.com stays as-is)
 * - Apply any provider-specific normalization
 *
 * @param email - Raw email address
 * @returns Canonical lowercase trimmed email
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
