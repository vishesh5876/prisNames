import { envSchema } from './env';
import type { Env } from './env';

let _env: Env | null = null;

/**
 * Validate environment variables at startup.
 * Call this once during application boot. Throws on validation failure.
 */
export function validateEnv(overrides?: Partial<Record<string, string>>): Env {
  const raw = { ...process.env, ...overrides };
  const result = envSchema.safeParse(raw);

  if (!result.success) {
    const errors = result.error.issues
      .map((issue) => `  ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');

    throw new Error(`Environment validation failed:\n${errors}`);
  }

  _env = result.data;
  return _env;
}

/**
 * Get the validated environment. Must call validateEnv() first.
 */
export function getEnv(): Env {
  if (!_env) {
    throw new Error('Environment not validated. Call validateEnv() during application startup.');
  }
  return _env;
}
