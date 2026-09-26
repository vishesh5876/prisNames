/**
 * PrisNames — Domain Service
 *
 * Owns domains.lifecycle_status. Called from TX3 when a registrar operation
 * terminates (SUCCEEDED → ACTIVE, FAILED → REGISTRATION_FAILED).
 *
 * All lifecycle transitions happen WITHIN the same PostgreSQL transaction
 * as the registrar operation status update (TX3 atomicity guarantee).
 *
 * Reference: Phase 6 Implementation Plan §7 (TX3)
 */

import { Inject, Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { eq, and, isNull, sql } from 'drizzle-orm';
import { DATABASE_TOKEN } from '../../database/database.module.js';
import type { Database } from '@prisnames/database/client';
import { domains, DOMAIN_LIFECYCLE } from '@prisnames/database';
import { createLogger } from '@prisnames/logger';
import { REGISTRAR_ERROR_CODES } from '@prisnames/contracts';

const logger = createLogger({ service: 'domain-service' });

export type DomainRow = typeof domains.$inferSelect;

@Injectable()
export class DomainService {
  constructor(@Inject(DATABASE_TOKEN) private readonly db: Database) {}

  /**
   * Activate a domain after successful registration.
   * MUST be called within the TX3 transaction.
   */
  async activateDomain(
    domainId: string,
    data: {
      registeredAt?: Date;
      expiresAt?: Date;
      providerDomainId?: string;
    },
    tx: Database,
  ): Promise<DomainRow> {
    const [updated] = await tx
      .update(domains)
      .set({
        lifecycleStatus: DOMAIN_LIFECYCLE.ACTIVE,
        registeredAt: data.registeredAt ?? new Date(),
        expiresAt: data.expiresAt,
        providerDomainId: data.providerDomainId,
      })
      .where(
        and(
          eq(domains.id, domainId),
          eq(domains.lifecycleStatus, DOMAIN_LIFECYCLE.PENDING_REGISTRATION),
        ),
      )
      .returning();

    if (!updated) {
      logger.warn({ domainId }, 'Domain activation failed — not in PENDING_REGISTRATION');
      throw new HttpException(
        { code: REGISTRAR_ERROR_CODES.DOMAIN_NOT_FOUND, message: 'Domain not in PENDING_REGISTRATION state' },
        HttpStatus.CONFLICT,
      );
    }

    logger.info({ domainId, fqdn: updated.fqdn }, 'Domain activated');
    return updated;
  }

  /**
   * Mark a domain registration as failed.
   * Correction 3: MUST be called within the TX3 transaction for crash consistency.
   */
  async markRegistrationFailed(
    domainId: string,
    tx: Database,
  ): Promise<DomainRow> {
    const [updated] = await tx
      .update(domains)
      .set({
        lifecycleStatus: DOMAIN_LIFECYCLE.REGISTRATION_FAILED,
      })
      .where(
        and(
          eq(domains.id, domainId),
          eq(domains.lifecycleStatus, DOMAIN_LIFECYCLE.PENDING_REGISTRATION),
        ),
      )
      .returning();

    if (!updated) {
      logger.warn({ domainId }, 'Domain registration failed marking — not in PENDING_REGISTRATION');
      // Not a hard error — domain may have already been updated by another writer
      return null as unknown as DomainRow;
    }

    logger.info({ domainId, fqdn: updated.fqdn }, 'Domain registration marked as failed');
    return updated;
  }

  /**
   * Create a domain record in PENDING_REGISTRATION state.
   * Called during TX1 (operation creation).
   */
  async createPendingDomain(
    data: {
      userId: string;
      fqdn: string;
      sld: string;
      tld: string;
      registrarProviderId: string;
    },
    tx?: Database,
  ): Promise<DomainRow> {
    const executor = tx ?? this.db;

    const [created] = await executor
      .insert(domains)
      .values({
        userId: data.userId,
        fqdn: data.fqdn,
        sld: data.sld,
        tld: data.tld,
        registrarProviderId: data.registrarProviderId,
        lifecycleStatus: DOMAIN_LIFECYCLE.PENDING_REGISTRATION,
      })
      .onConflictDoNothing()
      .returning();

    if (!created) {
      // Domain already exists (active conflict) — find existing
      const [existing] = await executor
        .select()
        .from(domains)
        .where(
          and(
            eq(domains.fqdn, data.fqdn),
            isNull(domains.registrationEndedAt),
            isNull(domains.deletedAt),
          ),
        )
        .limit(1);

      if (existing) return existing;

      throw new HttpException(
        { code: REGISTRAR_ERROR_CODES.DOMAIN_NOT_FOUND, message: 'Failed to create or find domain' },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    return created;
  }

  /**
   * Find domain by ID.
   */
  async findById(domainId: string): Promise<DomainRow | null> {
    const [domain] = await this.db
      .select()
      .from(domains)
      .where(eq(domains.id, domainId))
      .limit(1);
    return domain ?? null;
  }

  /**
   * Find active domain by FQDN.
   */
  async findActiveByFqdn(fqdn: string): Promise<DomainRow | null> {
    const [domain] = await this.db
      .select()
      .from(domains)
      .where(
        and(
          eq(domains.fqdn, fqdn),
          isNull(domains.registrationEndedAt),
          isNull(domains.deletedAt),
        ),
      )
      .limit(1);
    return domain ?? null;
  }

  /**
   * List domains for a user.
   */
  async listUserDomains(
    userId: string,
    page = 1,
    pageSize = 20,
  ): Promise<{ domains: DomainRow[]; total: number }> {
    const result = await this.db
      .select()
      .from(domains)
      .where(
        and(
          eq(domains.userId, userId),
          isNull(domains.deletedAt),
        ),
      )
      .orderBy(sql`created_at DESC`)
      .limit(pageSize)
      .offset((page - 1) * pageSize);

    const [countResult] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(domains)
      .where(
        and(
          eq(domains.userId, userId),
          isNull(domains.deletedAt),
        ),
      );

    return { domains: result, total: countResult?.count ?? 0 };
  }

  /**
   * List all domains (admin).
   */
  async listAllDomains(
    page = 1,
    pageSize = 20,
  ): Promise<{ domains: DomainRow[]; total: number }> {
    const result = await this.db
      .select()
      .from(domains)
      .where(isNull(domains.deletedAt))
      .orderBy(sql`created_at DESC`)
      .limit(pageSize)
      .offset((page - 1) * pageSize);

    const [countResult] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(domains)
      .where(isNull(domains.deletedAt));

    return { domains: result, total: countResult?.count ?? 0 };
  }
}
