/**
 * PrisNames — Feature Flags Seed
 *
 * Seeds initial feature flags. All default to false (disabled).
 */

import { type Database } from '../client.js';
import { featureFlags } from '../schema/operations.js';

const FLAGS = [
  { key: 'DOMAIN_REGISTRATION', value: false, description: 'Enable domain registration flow' },
  { key: 'DOMAIN_RENEWAL', value: false, description: 'Enable domain renewal flow' },
  { key: 'DOMAIN_TRANSFER', value: false, description: 'Enable domain transfer-in flow' },
  { key: 'PAYMENTS', value: false, description: 'Enable payment processing' },
  { key: 'AUTO_RENEWAL', value: false, description: 'Enable auto-renewal system' },
  { key: 'GRACE_DELETE', value: false, description: 'Enable grace deletion' },
] as const;

export async function seedFeatureFlags(db: Database) {
  console.log('  🔄 Seeding feature flags...');

  for (const flag of FLAGS) {
    await db
      .insert(featureFlags)
      .values(flag)
      .onConflictDoNothing({ target: featureFlags.key });
  }

  console.log(`  ✅ Seeded ${FLAGS.length} feature flags`);
}
