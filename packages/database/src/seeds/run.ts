/**
 * PrisNames — Role Seeder
 *
 * Creates all six approved roles: USER, SUPPORT, FINANCE, ABUSE, ADMIN, SUPER_ADMIN.
 * Matches AUTH.md §7 privilege levels.
 * Idempotent — safe to run multiple times.
 */

import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';
import { createDb } from '../client.js';
import { roles } from '../schema/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../../../../.env') });

const REQUIRED_ROLES = [
  { name: 'USER', description: 'Default customer role (privilege level 0)' },
  { name: 'SUPPORT', description: 'Customer support staff (privilege level 1)' },
  { name: 'FINANCE', description: 'Financial operations (privilege level 2)' },
  { name: 'ABUSE', description: 'Abuse and compliance team (privilege level 3)' },
  { name: 'ADMIN', description: 'Platform administrator (privilege level 4)' },
  { name: 'SUPER_ADMIN', description: 'Super administrator with full system control (privilege level 5)' },
];

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('❌ DATABASE_URL is not set');
    process.exit(1);
  }

  const { db, sql: sqlClient } = createDb(connectionString);

  console.log('🌱 Seeding roles...');

  for (const role of REQUIRED_ROLES) {
    await db
      .insert(roles)
      .values(role)
      .onConflictDoNothing({ target: roles.name });
    console.log(`  ✅ Role: ${role.name}`);
  }

  console.log(`✅ All ${REQUIRED_ROLES.length} roles seeded`);
  await sqlClient.end();
}

main().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
