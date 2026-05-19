# Actual repository structure

Maps **documented** layout ([05_Project_Conventions.md](../05_Project_Conventions.md)) to **what exists today**.

## Implemented

| Path | Status |
|------|--------|
| `apps/web` | Next.js 16 app (UI + BFF) |
| `packages/types` | Shared TypeScript domain types |
| `services/api` | FastAPI monolith (dc-notes, `/api/v1/*`, agents, orchestrator) |
| `python-packages/dc_core`, `dc_llm`, `dc_tools` | Shared Python libraries |
| `infra/supabase/migrations` | SQL schema + pgvector |
| `prompts/` | Versioned agent prompts |
| `packages/api-client` | Generated/typesafe API client |
| `.github/workflows/ci.yml` | Lint, type-check, tests |

## Planned / not yet split out

| Documented path | Notes |
|-----------------|-------|
| `services/orchestrator`, `content`, … | Logic lives under `services/api/app/domain/` until service extraction |
| `packages/ui` | UI still in `apps/web/src/components/ui` |
| `apps/docs` | Product docs at repo root (`01_PRD.md`, etc.) |

## Data flow (target)

CSV import → BFF `/api/dc-notes/ingest` → Supabase (tenant-scoped) → `/api/v1/calls` → Web TanStack Query.

Demo mocks: `USE_MOCK_DATA=true` or `?demo=1` in development only.
