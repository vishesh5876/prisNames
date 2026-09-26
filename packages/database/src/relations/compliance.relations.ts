import { relations } from 'drizzle-orm';
import {
  auditLogs,
  adminActions,
  abuseCases,
  abuseEvidence,
  complianceCases,
  legalRequests,
  dataDisclosures,
  legalDocuments,
  legalDocumentVersions,
  userLegalAcceptances,
} from '../schema/compliance.js';
import { users } from '../schema/auth.js';
import { domains } from '../schema/domains.js';

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  actor: one(users, {
    fields: [auditLogs.actorId],
    references: [users.id],
  }),
}));

export const adminActionsRelations = relations(adminActions, ({ one }) => ({
  admin: one(users, {
    fields: [adminActions.adminId],
    references: [users.id],
  }),
}));

export const abuseCasesRelations = relations(abuseCases, ({ one, many }) => ({
  domain: one(domains, {
    fields: [abuseCases.domainId],
    references: [domains.id],
  }),
  assignee: one(users, {
    fields: [abuseCases.assignedTo],
    references: [users.id],
  }),
  evidence: many(abuseEvidence),
}));

export const abuseEvidenceRelations = relations(abuseEvidence, ({ one }) => ({
  abuseCase: one(abuseCases, {
    fields: [abuseEvidence.abuseCaseId],
    references: [abuseCases.id],
  }),
  submitter: one(users, {
    fields: [abuseEvidence.submittedBy],
    references: [users.id],
  }),
}));

export const complianceCasesRelations = relations(complianceCases, ({ one, many }) => ({
  domain: one(domains, {
    fields: [complianceCases.domainId],
    references: [domains.id],
  }),
  user: one(users, {
    fields: [complianceCases.userId],
    references: [users.id],
    relationName: 'complianceUser',
  }),
  assignee: one(users, {
    fields: [complianceCases.assignedTo],
    references: [users.id],
    relationName: 'complianceAssignee',
  }),
  legalRequests: many(legalRequests),
}));

export const legalRequestsRelations = relations(legalRequests, ({ one }) => ({
  complianceCase: one(complianceCases, {
    fields: [legalRequests.complianceCaseId],
    references: [complianceCases.id],
  }),
}));

export const dataDisclosuresRelations = relations(dataDisclosures, ({ one }) => ({
  user: one(users, {
    fields: [dataDisclosures.userId],
    references: [users.id],
    relationName: 'disclosureSubject',
  }),
  domain: one(domains, {
    fields: [dataDisclosures.domainId],
    references: [domains.id],
  }),
  legalRequest: one(legalRequests, {
    fields: [dataDisclosures.legalRequestId],
    references: [legalRequests.id],
  }),
  discloser: one(users, {
    fields: [dataDisclosures.disclosedBy],
    references: [users.id],
    relationName: 'disclosureAdmin',
  }),
}));

export const legalDocumentsRelations = relations(legalDocuments, ({ many }) => ({
  versions: many(legalDocumentVersions),
}));

export const legalDocumentVersionsRelations = relations(legalDocumentVersions, ({ one, many }) => ({
  legalDocument: one(legalDocuments, {
    fields: [legalDocumentVersions.legalDocumentId],
    references: [legalDocuments.id],
  }),
  acceptances: many(userLegalAcceptances),
}));

export const userLegalAcceptancesRelations = relations(userLegalAcceptances, ({ one }) => ({
  user: one(users, {
    fields: [userLegalAcceptances.userId],
    references: [users.id],
  }),
  documentVersion: one(legalDocumentVersions, {
    fields: [userLegalAcceptances.legalDocumentVersionId],
    references: [legalDocumentVersions.id],
  }),
}));
