/**
 * PrisNames — Legal Documents Seed
 *
 * Seeds legal document DEFINITIONS only.
 * Does NOT create active versions — placeholder versions are DRAFT/inactive
 * and are NOT eligible for customer acceptance.
 * Real legal versions will be activated in a later phase.
 */

import { type Database } from '../client.js';
import { legalDocuments } from '../schema/compliance.js';

const DOCUMENTS = [
  {
    slug: 'terms-of-service',
    title: 'Terms of Service',
    isRequired: true,
  },
  {
    slug: 'privacy-policy',
    title: 'Privacy Policy',
    isRequired: true,
  },
  {
    slug: 'domain-registration-agreement',
    title: 'Domain Registration Agreement',
    isRequired: true,
  },
] as const;

export async function seedLegalDocuments(db: Database) {
  console.log('  🔄 Seeding legal documents...');

  for (const doc of DOCUMENTS) {
    await db
      .insert(legalDocuments)
      .values(doc)
      .onConflictDoNothing({ target: legalDocuments.slug });
  }

  // NOTE: No legal_document_versions are created here.
  // Active, customer-acceptable versions must be created by an admin
  // after real legal text has been finalized and reviewed.

  console.log(`  ✅ Seeded ${DOCUMENTS.length} legal document definitions (no active versions)`);
}
