import { relations } from 'drizzle-orm';
import {
  users,
  userProfiles,
  authIdentities,
  passwordCredentials,
  emailVerifications,
  passwordResets,
  sessions,
  roles,
  userRoles,
} from '../schema/auth.js';

export const usersRelations = relations(users, ({ one, many }) => ({
  profile: one(userProfiles, {
    fields: [users.id],
    references: [userProfiles.userId],
  }),
  authIdentities: many(authIdentities),
  passwordCredential: one(passwordCredentials, {
    fields: [users.id],
    references: [passwordCredentials.userId],
  }),
  emailVerifications: many(emailVerifications),
  passwordResets: many(passwordResets),
  sessions: many(sessions),
  userRoles: many(userRoles),
}));

export const userProfilesRelations = relations(userProfiles, ({ one }) => ({
  user: one(users, {
    fields: [userProfiles.userId],
    references: [users.id],
  }),
}));

export const authIdentitiesRelations = relations(authIdentities, ({ one }) => ({
  user: one(users, {
    fields: [authIdentities.userId],
    references: [users.id],
  }),
}));

export const passwordCredentialsRelations = relations(passwordCredentials, ({ one }) => ({
  user: one(users, {
    fields: [passwordCredentials.userId],
    references: [users.id],
  }),
}));

export const emailVerificationsRelations = relations(emailVerifications, ({ one }) => ({
  user: one(users, {
    fields: [emailVerifications.userId],
    references: [users.id],
  }),
}));

export const passwordResetsRelations = relations(passwordResets, ({ one }) => ({
  user: one(users, {
    fields: [passwordResets.userId],
    references: [users.id],
  }),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));

export const rolesRelations = relations(roles, ({ many }) => ({
  userRoles: many(userRoles),
}));

export const userRolesRelations = relations(userRoles, ({ one }) => ({
  user: one(users, {
    fields: [userRoles.userId],
    references: [users.id],
  }),
  role: one(roles, {
    fields: [userRoles.roleId],
    references: [roles.id],
  }),
}));
