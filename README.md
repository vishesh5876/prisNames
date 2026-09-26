# PrisNames

Privacy-focused domain registration platform. Authorized reseller under Dynadot / Global Domain Group LLC.

## Prerequisites

- **Node.js** >= 20 (tested with 25.x)
- **pnpm** >= 11
- **Docker** (for development infrastructure)

## Repository Structure

```
prisnames/
├── apps/
│   ├── web/                  # Next.js frontend (App Router, Tailwind CSS)
│   ├── api/                  # NestJS + Fastify REST API
│   └── worker/               # BullMQ background worker
│
├── packages/
│   ├── config/               # Environment validation (Zod)
│   ├── contracts/            # Shared TypeScript types and DTOs
│   ├── database/             # PostgreSQL + Drizzle ORM (Phase 2)
│   ├── ui/                   # Shared UI components (Phase 4)
│   ├── logger/               # Structured logging (pino)
│   ├── security/             # Encryption and hashing utilities (Phase 3+)
│   ├── registrar-core/       # RegistrarProvider interface (Phase 5)
│   ├── registrar-dynadot/    # Dynadot adapter (Phase 5)
│   ├── payment-core/         # PaymentProvider interface (Phase 12)
│   └── email-core/           # EmailProvider interface (Phase 11+)
│
├── docs/                     # Architecture documentation (12 documents)
├── infra/                    # Infrastructure configuration
├── docker-compose.yml        # PostgreSQL, Redis, Mailpit
├── pnpm-workspace.yaml       # Monorepo workspace config
└── turbo.json                # Turborepo task pipeline
```

## Local Setup

### 1. Clone and Install

```bash
git clone <repository-url>
cd prisnames
pnpm install
```

### 2. Environment Configuration

```bash
cp .env.example .env
```

Edit `.env` with your local values. The defaults work with the Docker Compose setup.

### 3. Start Development Infrastructure

```bash
# Start PostgreSQL, Redis, and Mailpit
pnpm docker:up

# Verify services are healthy
docker compose ps
```

| Service | Port | Purpose |
|---------|------|---------|
| PostgreSQL | 5432 | Primary database |
| Redis | 6379 | Cache, queues, sessions |
| Mailpit SMTP | 1025 | Email capture (dev) |
| Mailpit UI | 8025 | Email viewer (http://localhost:8025) |

### 4. Start Applications

```bash
# Start all applications in development mode
pnpm dev

# Or start individually:
pnpm --filter @prisnames/web dev     # http://localhost:3000
pnpm --filter @prisnames/api dev     # http://localhost:4000
pnpm --filter @prisnames/worker dev  # Background worker
```

### 5. Verify

```bash
# API health check
curl http://localhost:4000/api/v1/health
# → {"status":"ok","service":"api"}
```

## Commands

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start all apps in development mode |
| `pnpm build` | Build all packages and apps |
| `pnpm lint` | Run ESLint across all packages |
| `pnpm typecheck` | Run TypeScript type checking |
| `pnpm test` | Run all tests |
| `pnpm format` | Format all files with Prettier |
| `pnpm format:check` | Check formatting without modifying |
| `pnpm clean` | Remove all build artifacts and node_modules |
| `pnpm docker:up` | Start Docker infrastructure |
| `pnpm docker:down` | Stop Docker infrastructure |
| `pnpm docker:logs` | Follow Docker container logs |

## Architecture

See [docs/](./docs/) for the complete architectural documentation suite (12 documents).

Key architectural decisions:

- **Modular monorepo** — pnpm workspaces + Turborepo
- **Separated state machines** — Order, Payment, Refund, RegistrarOperation, DomainLifecycle, and Transfer each have independent status enums
- **Provider abstraction** — RegistrarProvider and PaymentProvider interfaces isolate business logic from vendor APIs
- **Module ownership** — Event handlers invoke owning services, never write to another module's tables directly

## License

Private — All rights reserved.
