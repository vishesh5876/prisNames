# @prisnames/database

PostgreSQL + Drizzle ORM persistence layer for PrisNames.

## Quick Reference

| Command | Description |
|---|---|
| `pnpm db:generate` | Generate migration SQL from schema changes |
| `pnpm db:migrate` | Apply pending migrations to the database |
| `pnpm db:seed` | Seed reference data (roles, providers, flags) |
| `pnpm db:studio` | Open Drizzle Studio (visual DB browser) |
| `pnpm typecheck` | TypeScript type validation |
| `pnpm lint` | ESLint |
| `pnpm test` | Run Vitest tests |

---

## Migration Workflow

### Authoritative Process

Generated migration SQL files are the **single source of truth** for schema changes. Every change follows this pipeline:

```
Schema code change
  → pnpm db:generate     (generate migration SQL)
  → Review generated SQL  (human-inspected before merge)
  → pnpm db:migrate       (apply to target database)
```

**Never use `drizzle-kit push` for staging or production deployments.** Push is acceptable only during early local development when rapid iteration is needed and data loss is tolerable.

### Database Roles

Two conceptual database roles govern access:

#### Runtime / Application Role

Used by the API and worker processes during normal operation.

Privileges (least-privilege):
- `SELECT`, `INSERT`, `UPDATE`, `DELETE` on all application tables
- `USAGE` on the `public` schema
- No `CREATE`, `ALTER`, `DROP`, `TRUNCATE`
- No `CREATE SCHEMA`

This role **cannot** run migrations, alter table structures, or create new tables.

#### Migration / Deployment Role

Used exclusively by the CI/CD migration step or by authorized operators.

Privileges:
- All runtime role privileges
- `CREATE TABLE`, `ALTER TABLE`, `DROP TABLE`
- `CREATE INDEX`, `DROP INDEX`
- `CREATE SCHEMA` (for Drizzle migration journal)
- `REFERENCES` on all tables

This role is used only during `pnpm db:migrate` in the deployment pipeline. It is never used by application code at runtime.

### Development Note

The current development database user (`prisnames`) lacks `CREATE SCHEMA` privileges, so `db:migrate` cannot be used yet. Development schema was applied via `drizzle-kit push` as a temporary workaround. Production deployments **must** use the migration role with full migration privileges.

---

## Domain Registration-Instance Model

A `domains` row represents **one registration instance** (ownership period), not a permanent FQDN identity.

Two independent temporal markers:

| Column | Meaning |
|---|---|
| `registration_ended_at` | This ownership/registration instance has ended (transfer-out, expiry, registrar deletion). The record remains fully queryable as historical data. |
| `deleted_at` | Administrative soft-delete. Distinct from registration ending. A transferred-away domain is historical, not deleted. |

### Ownership Lifecycle Example

1. Customer A registers `example.com` → row created (`registration_ended_at = NULL`)
2. Customer A transfers away → `registration_ended_at = now()`, `registration_ended_reason = 'TRANSFERRED_OUT'`
   - Record remains with full history (contacts, nameservers, events)
3. Years later, Customer B registers `example.com` → **new row** created (`registration_ended_at = NULL`)
   - Customer A's historical record is unchanged and queryable

### Uniqueness

```sql
UNIQUE(fqdn) WHERE registration_ended_at IS NULL AND deleted_at IS NULL
```

Only one **current** registration instance per FQDN.

---

## Encryption Envelope

See `docs/ENCRYPTION_ENVELOPE.md` for the canonical encrypted field format used across all encrypted database columns.

---

## Schema Modules

| Module | Tables | File |
|---|---|---|
| Auth | 9 | `src/schema/auth.ts` |
| Domains | 5 | `src/schema/domains.ts` |
| Registrar | 3 | `src/schema/registrar.ts` |
| Pricing | 2 | `src/schema/pricing.ts` |
| Commerce | 3 | `src/schema/commerce.ts` |
| Payments | 4 | `src/schema/payments.ts` |
| Compliance | 10 | `src/schema/compliance.ts` |
| Operations | 5 | `src/schema/operations.ts` |
| **Total** | **41** | |
