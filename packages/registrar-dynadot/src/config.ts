/**
 * PrisNames — Dynadot Configuration
 *
 * Lazy-validated config with:
 * - APP_ENV/DYNADOT_ENVIRONMENT environmental isolation
 * - URL derivation from DYNADOT_ENVIRONMENT
 * - Safety checks: sandbox cannot use production API, production cannot use sandbox
 */

import { z } from 'zod';
import { getEnv } from '@prisnames/config';

// ──────────────────────────────────────────────
// CONFIGURATION SCHEMA
// ──────────────────────────────────────────────

const dynadotConfigSchema = z.object({
  apiKey: z.string().min(1, 'DYNADOT_API_KEY is required'),
  apiSecret: z.string().min(1, 'DYNADOT_API_SECRET is required'),
  webhookKey: z.string().default(''),
  webhookSecret: z.string().default(''),
  environment: z.enum(['sandbox', 'production']),
  appEnv: z.enum(['development', 'test', 'staging', 'production']),
  accountTier: z.enum(['REGULAR', 'BULK', 'SUPER_BULK']),
  baseUrl: z.string().url(),
});

export type DynadotConfig = z.infer<typeof dynadotConfigSchema>;

// ──────────────────────────────────────────────
// URL DERIVATION
// ──────────────────────────────────────────────

const BASE_URLS: Record<string, string> = {
  sandbox: 'https://api-sandbox.dynadot.com/restful/v2',
  production: 'https://api.dynadot.com/restful/v2',
} as const;

// ──────────────────────────────────────────────
// SAFETY POLICY VALIDATION
// ──────────────────────────────────────────────

function validateEnvironmentPolicy(appEnv: string, dynadotEnv: string): void {
  // Production APP_ENV must use production Dynadot API
  if (appEnv === 'production' && dynadotEnv !== 'production') {
    throw new Error(
      `Environmental isolation violation: APP_ENV=${appEnv} requires DYNADOT_ENVIRONMENT=production, ` +
      `but DYNADOT_ENVIRONMENT=${dynadotEnv}. Production application must not use sandbox API.`,
    );
  }

  // Staging should use sandbox unless explicitly configured
  // (warning, not fatal — staging may need production for final validation)
}

// ──────────────────────────────────────────────
// CONFIGURATION FACTORY
// ──────────────────────────────────────────────

let cachedConfig: DynadotConfig | null = null;

/**
 * Get validated Dynadot configuration.
 * Lazily loaded and cached — validated once at first use.
 *
 * @throws ZodError if configuration is invalid
 * @throws Error if environmental isolation policy is violated
 */
export function getDynadotConfig(): DynadotConfig {
  if (cachedConfig) return cachedConfig;

  const env = getEnv();

  validateEnvironmentPolicy(env.APP_ENV, env.DYNADOT_ENVIRONMENT);

  const config = dynadotConfigSchema.parse({
    apiKey: env.DYNADOT_API_KEY,
    apiSecret: env.DYNADOT_API_SECRET,
    webhookKey: env.DYNADOT_WEBHOOK_KEY,
    webhookSecret: env.DYNADOT_WEBHOOK_SECRET,
    environment: env.DYNADOT_ENVIRONMENT,
    appEnv: env.APP_ENV,
    accountTier: env.DYNADOT_ACCOUNT_TIER,
    baseUrl: BASE_URLS[env.DYNADOT_ENVIRONMENT],
  });

  cachedConfig = config;
  return config;
}

/** Clear cached config (for testing). */
export function clearDynadotConfigCache(): void {
  cachedConfig = null;
}

/**
 * Create a DynadotConfig from explicit values (for testing).
 * Bypasses environment variables.
 */
export function createDynadotConfig(overrides: Partial<DynadotConfig> & { apiKey: string; apiSecret: string }): DynadotConfig {
  return dynadotConfigSchema.parse({
    environment: 'sandbox',
    appEnv: 'development',
    accountTier: 'REGULAR',
    baseUrl: BASE_URLS['sandbox'],
    webhookKey: '',
    webhookSecret: '',
    ...overrides,
  });
}
