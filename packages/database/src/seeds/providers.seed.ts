/**
 * PrisNames — Registrar Provider Seed
 *
 * Seeds the Dynadot registrar provider entry.
 * Uses upsert for idempotency.
 */

import { type Database } from '../client.js';
import { registrarProviders } from '../schema/registrar.js';

export async function seedProviders(db: Database) {
  console.log('  🔄 Seeding registrar providers...');

  await db
    .insert(registrarProviders)
    .values({
      providerId: 'dynadot',
      providerName: 'Dynadot',
      isActive: true,
      config: {
        apiVersion: 'v2',
        baseUrl: 'https://api.dynadot.com/restful/v2',
        sandboxUrl: 'https://api.dynadot.com/restful/v2',
        webhookPath: '/api/v1/webhooks/dynadot',
      },
    })
    .onConflictDoNothing({ target: registrarProviders.providerId });

  console.log('  ✅ Seeded Dynadot provider');
}
