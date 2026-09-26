/**
 * PrisNames — Schema Import Test
 *
 * Validates that all schema modules export valid Drizzle table definitions.
 */

import { describe, it, expect } from 'vitest';
import { getTableName, getTableColumns } from 'drizzle-orm';
import * as schema from '../schema/index.js';

describe('Schema Imports', () => {
  const expectedTables = [
    // Auth (9)
    ['users', schema.users],
    ['user_profiles', schema.userProfiles],
    ['auth_identities', schema.authIdentities],
    ['password_credentials', schema.passwordCredentials],
    ['email_verifications', schema.emailVerifications],
    ['password_resets', schema.passwordResets],
    ['sessions', schema.sessions],
    ['roles', schema.roles],
    ['user_roles', schema.userRoles],
    // Domains (5)
    ['domains', schema.domains],
    ['domain_contacts', schema.domainContacts],
    ['domain_nameservers', schema.domainNameservers],
    ['domain_dns_records', schema.domainDnsRecords],
    ['domain_events', schema.domainEvents],
    // Registrar (3)
    ['registrar_providers', schema.registrarProviders],
    ['registrar_operations', schema.registrarOperations],
    ['transfers', schema.transfers],
    // Pricing (2)
    ['tlds', schema.tlds],
    ['registrar_provider_prices', schema.registrarProviderPrices],
    // Commerce (3)
    ['quotes', schema.quotes],
    ['orders', schema.orders],
    ['order_items', schema.orderItems],
    // Payments (4)
    ['payments', schema.payments],
    ['payment_attempts', schema.paymentAttempts],
    ['refunds', schema.refunds],
    ['invoices', schema.invoices],
    // Compliance (10)
    ['audit_logs', schema.auditLogs],
    ['admin_actions', schema.adminActions],
    ['abuse_cases', schema.abuseCases],
    ['abuse_evidence', schema.abuseEvidence],
    ['compliance_cases', schema.complianceCases],
    ['legal_requests', schema.legalRequests],
    ['data_disclosures', schema.dataDisclosures],
    ['legal_documents', schema.legalDocuments],
    ['legal_document_versions', schema.legalDocumentVersions],
    ['user_legal_acceptances', schema.userLegalAcceptances],
    // Operations (5)
    ['email_logs', schema.emailLogs],
    ['webhook_events', schema.webhookEvents],
    ['job_records', schema.jobRecords],
    ['feature_flags', schema.featureFlags],
    ['system_settings', schema.systemSettings],
  ] as const;

  it('exports all 41 expected tables', () => {
    expect(expectedTables.length).toBe(41);
  });

  for (const [expectedName, table] of expectedTables) {
    it(`exports table "${expectedName}" with valid structure`, () => {
      expect(table).toBeDefined();
      expect(getTableName(table)).toBe(expectedName);
      const columns = getTableColumns(table);
      expect(Object.keys(columns).length).toBeGreaterThan(0);
      // Every table must have an 'id' column
      expect(columns).toHaveProperty('id');
    });
  }
});
