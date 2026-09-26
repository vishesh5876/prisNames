import { describe, it, expect, beforeEach } from 'vitest';
import { validateEnv } from '../validate';

const VALID_ENV = {
  NODE_ENV: 'development',
  PORT: '4000',
  WORKER_PORT: '4001',
  API_URL: 'http://localhost:4000',
  WEB_URL: 'http://localhost:3000',
  DATABASE_URL: 'postgresql://prisnames:prisnames@localhost:5432/prisnames',
  REDIS_URL: 'redis://localhost:6379',
  AUTH_SECRET: 'test-secret-at-least-16-chars',
  AUTH_OTP_PEPPER: 'test-otp-pepper-must-be-at-least-32-characters-long',
  COOKIE_DOMAIN: 'localhost',
  SESSION_MAX_AGE_SECONDS: '604800',
  DYNADOT_ENVIRONMENT: 'sandbox',
  LOG_LEVEL: 'debug',
  LOG_FORMAT: 'pretty',
};

describe('validateEnv', () => {
  beforeEach(() => {
    // Reset the module state between tests
  });

  it('should validate a complete environment', () => {
    const env = validateEnv(VALID_ENV);
    expect(env.NODE_ENV).toBe('development');
    expect(env.PORT).toBe(4000);
    expect(env.DATABASE_URL).toBe('postgresql://prisnames:prisnames@localhost:5432/prisnames');
  });

  it('should throw on missing DATABASE_URL', () => {
    const { DATABASE_URL: _, ...envWithoutDb } = VALID_ENV;
    expect(() => validateEnv(envWithoutDb)).toThrow('DATABASE_URL');
  });

  it('should throw on missing REDIS_URL', () => {
    const { REDIS_URL: _, ...envWithoutRedis } = VALID_ENV;
    expect(() => validateEnv(envWithoutRedis)).toThrow('REDIS_URL');
  });

  it('should throw on short AUTH_SECRET', () => {
    expect(() => validateEnv({ ...VALID_ENV, AUTH_SECRET: 'short' })).toThrow('AUTH_SECRET');
  });

  it('should coerce PORT to number', () => {
    const env = validateEnv({ ...VALID_ENV, PORT: '9999' });
    expect(env.PORT).toBe(9999);
    expect(typeof env.PORT).toBe('number');
  });

  it('should use default values for optional fields', () => {
    const env = validateEnv(VALID_ENV);
    expect(env.EMAIL_PROVIDER).toBe('mailpit');
    expect(env.SMTP_PORT).toBe(1025);
    expect(env.DYNADOT_ACCOUNT_TIER).toBe('REGULAR');
  });

  it('should reject invalid NODE_ENV', () => {
    expect(() => validateEnv({ ...VALID_ENV, NODE_ENV: 'invalid' })).toThrow();
  });
});
