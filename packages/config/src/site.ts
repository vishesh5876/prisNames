/**
 * Centralized site/branding configuration.
 *
 * All customer-facing branding is derived from environment variables.
 * Internal repository/package names (e.g. @prisnames/*) are unchanged.
 *
 * In production, SITE_NAME, SITE_URL, SUPPORT_EMAIL, and SITE_OPERATOR
 * must be configured explicitly. The build/deployment should fail if
 * these are absent.
 *
 * In development, neutral defaults are provided.
 */

export interface SiteConfig {
  /** Customer-facing site name */
  name: string;
  /** Short site description */
  description: string;
  /** Public URL (e.g. "https://example.com") */
  url: string;
  /** Support email address */
  supportEmail: string;
  /** Operator / legal entity name */
  operator: string;
}

let _siteConfig: SiteConfig | null = null;

/**
 * Get the site configuration.
 *
 * Reads from environment on first call, then caches.
 *
 * - In production: all values must be explicitly configured.
 *   Missing values cause a hard failure (build or runtime).
 * - In development: neutral defaults are provided.
 */
export function getSiteConfig(): SiteConfig {
  if (_siteConfig) return _siteConfig;

  const isProd = process.env.NODE_ENV === 'production';

  const name = process.env.SITE_NAME;
  const url = process.env.SITE_URL;
  const supportEmail = process.env.SUPPORT_EMAIL;
  const operator = process.env.SITE_OPERATOR;

  if (isProd) {
    if (!name) throw new Error('SITE_NAME must be configured in production');
    if (!url) throw new Error('SITE_URL must be configured in production');
    if (!supportEmail) throw new Error('SUPPORT_EMAIL must be configured in production');
    if (!operator) throw new Error('SITE_OPERATOR must be configured in production');
  }

  _siteConfig = {
    name: name || 'Domains',
    description: process.env.SITE_DESCRIPTION || 'Domain Registration & Management',
    url: url || 'http://localhost:3000',
    supportEmail: supportEmail || 'support@localhost',
    operator: operator || 'Pristine Internet Services',
  };

  return _siteConfig;
}

/**
 * Reset cached config (for testing).
 * @internal
 */
export function _resetSiteConfig(): void {
  _siteConfig = null;
}

/**
 * Generate a page title using the site name.
 */
export function formatPageTitle(pageTitle?: string): string {
  const site = getSiteConfig();
  return pageTitle ? `${pageTitle} | ${site.name}` : site.name;
}
