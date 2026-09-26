import { relations } from 'drizzle-orm';
import { emailLogs, featureFlags, systemSettings } from '../schema/operations.js';
import { users } from '../schema/auth.js';

export const emailLogsRelations = relations(emailLogs, ({ one }) => ({
  user: one(users, {
    fields: [emailLogs.userId],
    references: [users.id],
  }),
}));

// webhookEvents, jobRecords, featureFlags, systemSettings have minimal relations
// and primarily serve as operational tables

export const featureFlagsRelations = relations(featureFlags, ({ one }) => ({
  updater: one(users, {
    fields: [featureFlags.updatedBy],
    references: [users.id],
  }),
}));

export const systemSettingsRelations = relations(systemSettings, ({ one }) => ({
  updater: one(users, {
    fields: [systemSettings.updatedBy],
    references: [users.id],
  }),
}));
