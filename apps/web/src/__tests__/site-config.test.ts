/**
 * Site configuration tests.
 *
 * Covers: production validation, development defaults, formatPageTitle,
 * branding does not default to PrisNames.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getSiteConfig, formatPageTitle, _resetSiteConfig } from '@prisnames/config';

describe('getSiteConfig', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    _resetSiteConfig();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    _resetSiteConfig();
  });

  it('returns development defaults when NODE_ENV is not production', () => {
    process.env.NODE_ENV = 'development';
    delete process.env.SITE_NAME;
    delete process.env.SITE_URL;
    const config = getSiteConfig();
    expect(config.name).toBe('Domains');
    expect(config.url).toBe('http://localhost:3000');
    expect(config.operator).toBe('Pristine Internet Services');
  });

  it('development defaults do NOT include PrisNames', () => {
    process.env.NODE_ENV = 'development';
    delete process.env.SITE_NAME;
    const config = getSiteConfig();
    expect(config.name).not.toContain('PrisNames');
    expect(config.name).not.toContain('prisnames');
  });

  it('throws when SITE_NAME is missing in production', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.SITE_NAME;
    process.env.SITE_URL = 'https://example.com';
    process.env.SUPPORT_EMAIL = 'help@example.com';
    process.env.SITE_OPERATOR = 'Example Corp';
    expect(() => getSiteConfig()).toThrow('SITE_NAME must be configured in production');
  });

  it('throws when SITE_URL is missing in production', () => {
    process.env.NODE_ENV = 'production';
    process.env.SITE_NAME = 'MyDomains';
    delete process.env.SITE_URL;
    process.env.SUPPORT_EMAIL = 'help@example.com';
    process.env.SITE_OPERATOR = 'Example Corp';
    expect(() => getSiteConfig()).toThrow('SITE_URL must be configured in production');
  });

  it('throws when SUPPORT_EMAIL is missing in production', () => {
    process.env.NODE_ENV = 'production';
    process.env.SITE_NAME = 'MyDomains';
    process.env.SITE_URL = 'https://example.com';
    delete process.env.SUPPORT_EMAIL;
    process.env.SITE_OPERATOR = 'Example Corp';
    expect(() => getSiteConfig()).toThrow('SUPPORT_EMAIL must be configured in production');
  });

  it('throws when SITE_OPERATOR is missing in production', () => {
    process.env.NODE_ENV = 'production';
    process.env.SITE_NAME = 'MyDomains';
    process.env.SITE_URL = 'https://example.com';
    process.env.SUPPORT_EMAIL = 'help@example.com';
    delete process.env.SITE_OPERATOR;
    expect(() => getSiteConfig()).toThrow('SITE_OPERATOR must be configured in production');
  });

  it('uses configured values in production', () => {
    process.env.NODE_ENV = 'production';
    process.env.SITE_NAME = 'ProductionSite';
    process.env.SITE_URL = 'https://production.com';
    process.env.SUPPORT_EMAIL = 'support@production.com';
    process.env.SITE_OPERATOR = 'Production Corp';
    const config = getSiteConfig();
    expect(config.name).toBe('ProductionSite');
    expect(config.url).toBe('https://production.com');
    expect(config.supportEmail).toBe('support@production.com');
    expect(config.operator).toBe('Production Corp');
  });

  it('caches config after first call', () => {
    process.env.NODE_ENV = 'development';
    process.env.SITE_NAME = 'First';
    const first = getSiteConfig();

    process.env.SITE_NAME = 'Second';
    const second = getSiteConfig();

    expect(first).toBe(second);
    expect(first.name).toBe('First');
  });
});

describe('formatPageTitle', () => {
  beforeEach(() => {
    _resetSiteConfig();
    process.env.NODE_ENV = 'development';
    process.env.SITE_NAME = 'TestSite';
  });

  afterEach(() => {
    _resetSiteConfig();
  });

  it('returns site name when no page title', () => {
    expect(formatPageTitle()).toBe('TestSite');
  });

  it('formats page title with site name', () => {
    expect(formatPageTitle('Login')).toBe('Login | TestSite');
  });
});
