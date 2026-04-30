# Loraloop

Autonomous AI Social Media Management Platform powered by three specialized agents:
- **Clara** — Content Creation
- **Sarah** — Distribution & Engagement
- **Mark** — Market Intelligence

## Status

This repo is being built phase-by-phase per the technical briefing. Currently delivered:
- ✅ Phase 1 — Foundation (monorepo, Docker, Prisma, NestJS scaffold, encryption)
- ✅ Phase 2 — Plugin system (interface, registry, 8 platform plugins)
- ✅ Phase 3 — Event bus (Kafka producer/consumer/handlers)
- ⏳ Phase 4 — AI Agents (Clara, Sarah, Mark)
- ⏳ Phase 5 — Queue system & Publisher
- ⏳ Phase 6 — Core API modules (Auth, Content, Scheduler, etc.)
- ⏳ Phase 7+ — Storage, Frontend, Tests, CI/CD

## Quick Start

Prereqs: Node 20+, pnpm 9+, Docker.

```bash
# 1. Install deps
pnpm install

# 2. Boot infrastructure (postgres, redis, kafka, qdrant + UIs)
pnpm infra:up

# 3. Run database migrations
pnpm db:migrate

# 4. Seed platform plugin metadata
pnpm db:seed

# 5. Start API in dev mode
pnpm --filter @loraloop/api dev
```

## Useful URLs (after `infra:up`)

| Service       | URL                              |
|---------------|----------------------------------|
| API           | http://localhost:3000            |
| API Docs      | http://localhost:3000/api/docs   |
| Kafka UI      | http://localhost:8090            |
| Redis UI      | http://localhost:8001            |
| Qdrant        | http://localhost:6333/dashboard  |
| Prisma Studio | `pnpm db:studio`                 |

## Repo Layout

```
apps/
  api/          NestJS backend
  web/          Next.js frontend (Phase 8)
packages/
  shared-types/ TS types shared by api + web
  shared-utils/ Pure utility functions
infra/
  docker/       docker-compose for local dev
  k8s/          Kubernetes manifests (Phase 10)
  terraform/    IaC (Phase 10)
```

## Architecture Highlights

- **Plugin-first**: every social platform is a plugin in `apps/api/src/plugins/platforms/`. Adding platform #N is one new folder.
- **Event-driven**: services communicate via Kafka topics — no direct service-to-service calls.
- **Stateless services**: every component scales horizontally.
- **Zero-trust security**: all tokens encrypted at rest via AES-256-GCM.

## License

UNLICENSED — proprietary.
