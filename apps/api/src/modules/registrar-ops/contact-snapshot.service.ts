/**
 * PrisNames — Contact Snapshot Service
 *
 * Creates immutable, content-addressable contact profile snapshots.
 * Used to guarantee that registration retries send the exact original intent.
 *
 * Version = SHA-256 hash of canonical contact fields.
 * Identical contact data for the same user resolves to the same snapshot.
 *
 * Correction 5: real backing storage for registration snapshots.
 * No raw PII in operation_metadata — only snapshot ID + version reference.
 *
 * Reference: Phase 6 Implementation Plan §18
 */

import { Inject, Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { eq, and } from 'drizzle-orm';
import { DATABASE_TOKEN } from '../../database/database.module.js';
import type { Database } from '@prisnames/database/client';
import { contactProfileSnapshots, userProfiles } from '@prisnames/database';

export interface ContactSnapshotData {
  firstName: string | null;
  lastName: string | null;
  company: string | null;
  email: string | null;
  phone: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  country: string | null;
}

export interface ContactSnapshotRef {
  snapshotId: string;
  version: string;
}

@Injectable()
export class ContactSnapshotService {
  constructor(@Inject(DATABASE_TOKEN) private readonly db: Database) {}

  /**
   * Compute a content-addressable version hash for contact data.
   */
  computeVersion(data: ContactSnapshotData): string {
    const canonical = JSON.stringify([
      data.firstName ?? '',
      data.lastName ?? '',
      data.company ?? '',
      data.email ?? '',
      data.phone ?? '',
      data.addressLine1 ?? '',
      data.addressLine2 ?? '',
      data.city ?? '',
      data.state ?? '',
      data.postalCode ?? '',
      data.country ?? '',
    ]);
    return createHash('sha256').update(canonical).digest('hex');
  }

  /**
   * Create or retrieve an immutable contact snapshot.
   * Uses content-addressable versioning: identical data = same snapshot.
   *
   * @param userId - The user who owns this contact data
   * @param data - Contact fields to snapshot
   * @param tx - Optional transaction for atomicity with operation creation
   */
  async getOrCreateSnapshot(
    userId: string,
    data: ContactSnapshotData,
    tx?: Database,
  ): Promise<ContactSnapshotRef> {
    const executor = tx ?? this.db;
    const version = this.computeVersion(data);

    // Check if this exact version already exists for this user
    const [existing] = await executor
      .select({ id: contactProfileSnapshots.id, version: contactProfileSnapshots.version })
      .from(contactProfileSnapshots)
      .where(
        and(
          eq(contactProfileSnapshots.userId, userId),
          eq(contactProfileSnapshots.version, version),
        ),
      )
      .limit(1);

    if (existing) {
      return { snapshotId: existing.id, version: existing.version };
    }

    // Create new immutable snapshot
    const [created] = await executor
      .insert(contactProfileSnapshots)
      .values({
        userId,
        version,
        firstName: data.firstName,
        lastName: data.lastName,
        company: data.company,
        email: data.email,
        phone: data.phone,
        addressLine1: data.addressLine1,
        addressLine2: data.addressLine2,
        city: data.city,
        state: data.state,
        postalCode: data.postalCode,
        country: data.country,
      })
      .onConflictDoNothing()
      .returning({ id: contactProfileSnapshots.id, version: contactProfileSnapshots.version });

    // If conflict (race condition), fetch the existing one
    if (!created) {
      const [raced] = await executor
        .select({ id: contactProfileSnapshots.id, version: contactProfileSnapshots.version })
        .from(contactProfileSnapshots)
        .where(
          and(
            eq(contactProfileSnapshots.userId, userId),
            eq(contactProfileSnapshots.version, version),
          ),
        )
        .limit(1);
      return { snapshotId: raced!.id, version: raced!.version };
    }

    return { snapshotId: created.id, version: created.version };
  }

  /**
   * Resolve a snapshot by ID. Returns the immutable contact data.
   */
  async resolveSnapshot(snapshotId: string): Promise<ContactSnapshotData | null> {
    const [snapshot] = await this.db
      .select()
      .from(contactProfileSnapshots)
      .where(eq(contactProfileSnapshots.id, snapshotId))
      .limit(1);

    if (!snapshot) return null;

    return {
      firstName: snapshot.firstName,
      lastName: snapshot.lastName,
      company: snapshot.company,
      email: snapshot.email,
      phone: snapshot.phone,
      addressLine1: snapshot.addressLine1,
      addressLine2: snapshot.addressLine2,
      city: snapshot.city,
      state: snapshot.state,
      postalCode: snapshot.postalCode,
      country: snapshot.country,
    };
  }

  /**
   * Get current user profile data for snapshot creation.
   */
  async getCurrentProfileData(userId: string): Promise<ContactSnapshotData | null> {
    const [profile] = await this.db
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.userId, userId))
      .limit(1);

    if (!profile) return null;

    return {
      firstName: profile.firstName,
      lastName: profile.lastName,
      company: profile.company,
      email: null,  // Email comes from users table, not profile
      phone: profile.phone,
      addressLine1: null,  // Not in user_profiles yet
      addressLine2: null,
      city: null,
      state: null,
      postalCode: null,
      country: profile.country,
    };
  }
}
