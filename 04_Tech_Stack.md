# Tech Stack
**Companion to:** `01_PRD.md`, `02_Architecture.md`, `03_Agent_Specs.md`
**Version:** 0.1 (Draft)
**Status:** Recommendations; final lock requires team review
**Last updated:** May 2026

---

## Reading guide

Every choice in this document is **opinionated, justified, and reversible only at a cost**. If you disagree with one, replace it before code starts — replacing after is expensive. Pinned versions are the floor: pin the exact patch version in lockfiles, upgrade deliberately, never on autopilot.

---

## 1. Languages and Runtimes

| Layer | Choice | Version | Why |
|---|---|---|---|
| Frontend | **TypeScript** | 5.6+ | Type safety is non-negotiable for a multi-developer codebase. No JS files except config |
| Web framework | **Next.js (App Router)** | 16.2 LTS | Current LTS; supported until at least Oct 2026. Server Components are essential for streaming live-call data. Adapter API is now stable |
| Agent services | **Python** | 3.12 | LLM ecosystem (Anthropic SDK, embeddings, observability, evals) lives in Python. Fighting this costs more than running two runtimes |
| Agent framework | **FastAPI** | 0.136+ | Async-first, OpenAPI auto-generation, Pydantic v2 for the schema-strict outputs every agent must produce |
| Package managers | **pnpm** (Node) / **uv** (Python) | latest | pnpm: faster, disk-efficient, strict by default. uv: 10–100x faster than pip, lockfile-native |
| Node runtime | **Node.js** | 22 LTS | Required for Next 16 |

**Decision: mixed runtime is correct, not a compromise.** Python owns the agent layer; Node owns the web layer. A thin REST/WebSocket interface separates them. Trying to do agents in Node means reinventing tools that already exist in Python; trying to do the web app in Python (Streamlit, Gradio) means giving up the UX bar this product requires.

---

## 2. Frontend Stack

| Concern | Choice | Why |
|---|---|---|
| Framework | Next.js 16 App Router | See above |
| Styling | **Tailwind CSS v4** | The agreed house standard; v4 has improved DX and Lightning CSS |
| Component library | **shadcn/ui** | Source-in-your-repo components, not a dependency. Customizable. Pairs with Tailwind. Aligns with the Carbon-inspired direction without locking us in |
| Icons | **Lucide React** | Open source, tree-shakable, pairs with shadcn |
| Client state | **Zustand** | Minimal, no boilerplate. Don't use Redux unless we have a reason we can defend |
| Server state | **TanStack Query v5** | Industry standard for async data. Handles caching, retries, optimistic updates |
| Forms | **React Hook Form + Zod** | Performance-friendly form state + schema validation that mirrors backend Pydantic |
| Tables | **TanStack Table v8** | Headless. We control the rendering, which matters for the leadership dashboard |
| Charts | **Recharts** for dashboards; **Visx** for custom viz | Recharts handles 90% of cases; Visx for anything bespoke |
| Real-time | **Native WebSocket** wrapped in a custom hook | Don't pull in socket.io if we don't need fallbacks |
| Date handling | **date-fns v3** | Tree-shakable. Don't use moment.js (deprecated) |
| Markdown rendering | **react-markdown + remark-gfm** | For rendering AI-generated content with citations |

---

## 3. Backend Stack

| Concern | Choice | Why |
|---|---|---|
| API framework | FastAPI | See above |
| Data validation | **Pydantic v2** | First-class FastAPI integration. Same shapes feed type generation to frontend |
| ORM | **SQLAlchemy 2.0** (async) | Mature, async-native in v2. Don't use sync drivers |
| Migrations | **Alembic** | Standard SQLAlchemy migration tool |
| Background jobs | **Celery + Redis** for v1; consider **Temporal** at scale | Celery is well-understood. Temporal becomes worth it when workflows get genuinely complex (multi-day, multi-stage with retries) |
| Live streams | **FastAPI WebSockets** + Redis pub/sub | Sufficient for v1's scale target (200 concurrent calls) |
| HTTP client | **httpx** | Async-first, modern, replaces requests for new code |
| Testing | **pytest + pytest-asyncio** | Standard |
| Type checking | **mypy** in strict mode | Or **Pyright** if we want speed; pick one and stick |

---

## 4. Data Layer

| Concern | Choice | Why |
|---|---|---|
| Primary database | **PostgreSQL 16** | Mature, JSON support, pgvector for embeddings |
| Vector store | **pgvector** in same Postgres | One database = one operational surface for v1. Migrate to Pinecone only if we hit pgvector's ceiling (~10M chunks at acceptable latency) |
| Hosting | **Neon** (preferred) or **Supabase** | Neon: serverless Postgres, branch databases for previews. Supabase: more bundled (auth, storage). Pick Neon if we use Clerk for auth; Supabase if we use Supabase auth |
| Cache | **Redis (Upstash)** | Serverless Redis for the cache + queue + pub-sub trifecta |
| Object storage | **Cloudflare R2** | S3-compatible, no egress fees, cheaper than S3 |
| Time-series (metrics, traces) | **ClickHouse** (self-hosted or **ClickHouse Cloud**) | Best-in-class for event-heavy workloads (call events, token usage) |
| Search (full-text) | **Postgres FTS** for v1 | Don't add Elasticsearch unless we need it |

---

## 5. AI / LLM Stack

| Concern | Choice | Why |
|---|---|---|
| Primary LLM provider | **Anthropic (Claude)** | Best for citation-faithful, grounded outputs |
| Model tiers | See below | Different agents need different price/quality points |
| LLM SDK | **anthropic** (Python), **@anthropic-ai/sdk** (Node) | Official SDKs |
| Embeddings | **Voyage AI** (voyage-3-large) | Anthropic-recommended; better retrieval quality than ada-002 |
| Observability | **Langfuse** (self-hosted or cloud) | LLM-specific tracing: prompt versions, cost, latency, eval scores |
| Evals | **Promptfoo** for CI | Run regression evals on every prompt change |
| Prompt management | Version-controlled in repo (`/prompts` dir, semver) | Don't use a SaaS prompt manager. Prompts are code |
| Fallback provider | **OpenAI** (gpt-4-class) | Only for outage fallback, not active routing |
| Meeting bot infra | **Recall.ai** | Multi-platform consented bot, transcription, diarization |

### Model assignment per agent

| Agent / operation | Model | Why |
|---|---|---|
| Live Call Agent — cheap pass (keyword, sentiment) | `claude-haiku-4-5-20251001` | Fast, cheap, runs frequently |
| Live Call Agent — proactive nudge (LLM call) | `claude-sonnet-4-6` | Balance of quality and latency |
| Bot-chat response | `claude-sonnet-4-6` | 5s budget; needs quality |
| Pre-DC brief generation | `claude-sonnet-4-6` | Async, batch-friendly |
| Coaching Agent — win-loss analysis | `claude-opus-4-7` | Highest reasoning quality; runs weekly |
| Coaching Agent — per-call scorecard | `claude-sonnet-4-6` | Sufficient quality, runs after every call |
| Content Agent — draft asset | `claude-opus-4-7` | Quality matters; content owner reviews anyway |
| Task Agent — email draft | `claude-sonnet-4-6` | Quality matters; AE reviews |
| KB Agent — tag inference | `claude-haiku-4-5-20251001` | Mechanical, cheap |

Document this matrix in code as a `MODEL_POLICY` constant. Engineers don't pick the model per call; the policy does.

---

## 6. Infrastructure

| Concern | Choice (v1) | Choice (scale) | Why |
|---|---|---|---|
| Frontend hosting | **Vercel** | Same | Best Next.js integration; ship to Cloudflare if egress costs blow up |
| Backend hosting | **Railway** or **Fly.io** | **AWS ECS** or **GCP Cloud Run** | Railway/Fly: fastest path to production for v1. Migrate when we need data residency or VPC isolation |
| Container registry | **GitHub Container Registry** | Same | Free with org account |
| CI/CD | **GitHub Actions** | Same | Standard; matrix workflows for monorepo |
| Secrets management | **Doppler** or **AWS Secrets Manager** | AWS Secrets Manager | Doppler for v1 (free tier generous); migrate when ops grows |
| DNS | **Cloudflare** | Same | DNS, CDN, WAF in one |

---

## 7. Authentication and Authorization

| Concern | Choice | Why |
|---|---|---|
| Auth provider | **Clerk** | SSO (Google/Microsoft) day one, MFA, organization model. Don't roll your own |
| Authorization | **Casbin** (Python) or in-app RBAC | Casbin if we go policy-heavy; in-app if RBAC suffices for v1 |
| Session model | JWT for backend, Clerk-managed sessions for frontend | Standard |

**Don't roll your own auth.** Selling to enterprise sales orgs means SSO is table stakes. Clerk gets us there in a day.

---

## 8. Observability

| Concern | Choice | Why |
|---|---|---|
| Application logs | **Better Stack** or **Axiom** | Cheap, queryable, no Datadog tax |
| Metrics | **Grafana Cloud** | Free tier; standard Prom-style metrics |
| Traces (general) | **OpenTelemetry** → Grafana Tempo | Standard |
| LLM traces | **Langfuse** | LLM-specific, see above |
| Error tracking | **Sentry** | Standard |
| Uptime / synthetic | **Better Stack** | Bundles with logs |

---

## 9. Integrations

| System | Integration approach | Library / SDK |
|---|---|---|
| Zoom | Recall.ai bot | Recall SDK |
| Google Meet | Recall.ai bot | Recall SDK |
| Microsoft Teams | Recall.ai bot | Recall SDK |
| HubSpot | OAuth + REST API | Official HubSpot Node/Python SDK |
| Salesforce | OAuth + REST API (Bulk for batches) | simple-salesforce (Python) |
| Slack | OAuth + Bolt SDK | @slack/bolt |
| Email send | **Resend** | Modern API, good deliverability, audit trail |
| Calendar | Google + Microsoft Graph | Official SDKs |

---

## 10. Developer Tooling

| Tool | Choice | Why |
|---|---|---|
| Monorepo | **Turborepo** | Caching is the win; pnpm workspaces alone are enough at small scale |
| Linting (JS/TS) | **Biome** | Faster than ESLint + Prettier; one config |
| Linting (Python) | **Ruff** | 100x faster than flake8 + black combined |
| Type checking (Python) | **Pyright** | Fast, used by VS Code Python |
| Pre-commit | **lefthook** | Faster than husky; cross-language |
| Commit conventions | **Conventional Commits** | Enables automated changelogs and semver bumps |
| Editor config | `.editorconfig` + workspace settings | Consistency across team |

---

## 11. What we deliberately rejected

| Rejected | Reason |
|---|---|
| **tRPC** | We need to call Python services; tRPC is JS-only. Use OpenAPI-generated clients |
| **GraphQL** | Overkill for our shape; REST + OpenAPI is enough |
| **LangChain / LangGraph** | Unstable abstractions, leaky, hard to debug. Thin custom orchestrator + direct SDK calls win in production |
| **Pinecone (v1)** | pgvector is enough until we prove otherwise. One less vendor |
| **Datadog** | Tax. Equivalent observability is achievable for 1/10 the cost |
| **AWS (v1)** | Too much ops overhead for v1. Migrate when we need it |
| **MongoDB** | We have relational data with vector extension needs. Postgres wins on both axes |
| **Kubernetes (v1)** | Operational overhead exceeds value at our scale. Railway/Fly handle this for us |
| **Microservices (v1)** | Modular monolith for Python services. Split only when team or scale demands it |

---

## 12. Version pinning policy

- **All dependencies pinned to exact patch versions in lockfiles** (`pnpm-lock.yaml`, `uv.lock`)
- **Renovate Bot** opens weekly upgrade PRs; humans review and merge
- **Major version upgrades** require an ADR (Architecture Decision Record) in `/docs/adrs`
- **Security patches** auto-merge after CI passes (Dependabot for security-only)

---

## 13. License and OSS compliance

- All production dependencies must be MIT, Apache 2.0, BSD, or ISC licensed
- GPL / AGPL dependencies require explicit legal review (block by default)
- Run **license-checker** in CI; build fails on unapproved license
