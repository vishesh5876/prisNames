/**
 * PrisNames — Roles Seed
 *
 * Seeds the RBAC roles from AUTH.md §7.1.
 * Uses upsert (ON CONFLICT DO NOTHING) for idempotency.
 */

import { type Database } from '../client.js';
import { roles } from '../schema/auth.js';

const ROLES = [
  { name: 'USER', description: 'Default customer role' },
  { name: 'SUPPORT', description: 'Customer support staff' },
  { name: 'FINANCE', description: 'Financial operations' },
  { name: 'ABUSE', description: 'Abuse/compliance team' },
  { name: 'ADMIN', description: 'General administration' },
  { name: 'SUPER_ADMIN', description: 'Full system control' },
] as const;

export async function seedRoles(db: Database) {
  console.log('  🔄 Seeding roles...');

  for (const role of ROLES) {
    await db
      .insert(roles)
      .values(role)
      .onConflictDoNothing({ target: roles.name });
  }

  console.log(`  ✅ Seeded ${ROLES.length} roles`);
}
