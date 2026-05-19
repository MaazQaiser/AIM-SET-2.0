# Project Conventions
**Applies to:** All packages in the DC Copilot monorepo
**Audience:** Engineers and AI coding assistants (Cursor, Claude Code)
**Version:** 0.1 (Draft)

---

## How to use this file

This file is **rules, not suggestions**. AI assistants and human contributors must follow these conventions. Violations should fail review.

If a rule blocks you, raise it in PR review and propose an amendment. Don't silently break it.

---

## 1. Repository Structure

We use a **Turborepo monorepo** with clear package boundaries.

```
dc-copilot/
├── apps/
│   ├── web/                    # Next.js 16 app (frontend + BFF)
│   └── docs/                   # Internal documentation site (optional)
├── services/
│   ├── orchestrator/           # Python FastAPI - Lead Orchestrator
│   ├── live-call/              # Python FastAPI - Live Call Agent service
│   ├── content/                # Python FastAPI - Content Agent service
│   ├── knowledge/              # Python FastAPI - Knowledge Agent service
│   ├── coaching/               # Python FastAPI - Coaching Agent service
│   └── task/                   # Python FastAPI - Task Agent service
├── packages/
│   ├── ui/                     # Shared shadcn components
│   ├── types/                  # Shared TS types (generated from OpenAPI)
│   ├── eslint-config/          # Shared lint config (or biome config)
│   ├── tsconfig/               # Shared TS configs
│   └── api-client/             # Generated typed client for backend
├── python-packages/
│   ├── dc_core/                # Shared Python: types, errors, logging
│   ├── dc_llm/                 # LLM wrappers, prompt management, model policy
│   ├── dc_tools/               # The 12 tools (transcribe, retrieve_kb, etc)
│   └── dc_eval/                # Eval harness, prompt regression tests
├── prompts/                    # Versioned prompt files (markdown + frontmatter)
├── docs/
│   ├── prd/                    # PRD, architecture, agent specs
│   ├── adrs/                   # Architecture Decision Records
│   └── runbooks/               # Operational runbooks (oncall, incidents)
├── infra/
│   ├── docker/                 # Dockerfiles
│   ├── github/                 # GitHub Actions workflows (or .github/workflows)
│   └── migrations/             # Alembic migrations
├── scripts/                    # One-off and ops scripts (typed; not bash where possible)
├── .cursorrules                # Cursor AI rules
├── .editorconfig
├── turbo.json
├── pnpm-workspace.yaml
├── pyproject.toml              # Root Python project (uv workspace)
└── README.md
```

### Package boundary rules

- **`packages/`** depend only on other `packages/`, never on `apps/` or `services/`
- **`apps/web`** can depend on `packages/*` and call `services/*` over HTTP, never import them
- **`services/*`** can depend on `python-packages/*`, never on each other directly
- **Cross-service communication** goes through the orchestrator. No agent-to-agent direct imports.

---

## 2. File and Folder Naming

### TypeScript / Next.js
- **Folders:** `kebab-case` (`live-call-panel`, `pre-dc-brief`)
- **Component files:** `PascalCase` (`CallTimeline.tsx`, `BotChatPanel.tsx`)
- **Non-component files:** `kebab-case` (`use-call-stream.ts`, `format-duration.ts`)
- **Test files:** colocated, `.test.ts` or `.test.tsx` suffix
- **Type files:** `.types.ts` if pure types; otherwise types live in the same file
- **One component per file** unless components are tightly coupled and never used separately

### Python
- **Modules:** `snake_case` (`live_call_agent.py`, `bant_scorer.py`)
- **Classes:** `PascalCase`
- **Functions:** `snake_case`
- **Constants:** `UPPER_SNAKE_CASE`
- **Test files:** `test_*.py` in a `tests/` folder mirroring the source structure

### Don't
- ❌ `Component.jsx` — use `.tsx`, always
- ❌ `myComponent.tsx` — components are PascalCase
- ❌ `index.ts` re-exports for every folder — only for true package entry points
- ❌ Mixing kebab-case and snake_case in the same language

---

## 3. Git Workflow

### Branching model
- `main` — protected, production-deployable at all times
- `develop` — protected, integration branch (only used if we adopt GitFlow; otherwise drop it)
- `feature/<ticket-id>-<slug>` — short-lived feature branches
- `fix/<ticket-id>-<slug>` — bug fixes
- `chore/<slug>` — non-functional changes (deps, configs)
- `hotfix/<slug>` — direct-to-main emergency fixes (rare)

**v1 recommendation: trunk-based with short-lived feature branches**, not GitFlow. Faster, fewer merge conflicts.

### Commit messages

**Conventional Commits.** Format:

```
<type>(<scope>): <description>

<body>

<footer>
```

Types: `feat`, `fix`, `chore`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`

Scopes (suggested): `web`, `orchestrator`, `live-call`, `content`, `knowledge`, `coaching`, `task`, `tools`, `db`, `infra`, `prompts`

Examples:
- ✅ `feat(live-call): add proactive nudge throttling`
- ✅ `fix(task): correct CRM task due-date timezone handling`
- ✅ `chore(deps): upgrade Next.js to 16.2.6`
- ❌ `update stuff`
- ❌ `WIP`
- ❌ `Fixed bug`

**No dashes in commit message bodies as connectors** — restructure the sentence instead. (House style.)

### Pull Requests

**Required PR template** (`.github/pull_request_template.md`):

```markdown
## What
One-sentence summary of the change.

## Why
Link to issue or one-paragraph rationale.

## How
Brief description of the approach. Call out anything non-obvious.

## Test plan
- [ ] Unit tests added/updated
- [ ] Integration test (if applicable)
- [ ] Manual verification steps

## Risk
Low / Medium / High. If Medium+, describe rollback plan.

## Checklist
- [ ] Self-reviewed
- [ ] Updated relevant docs (PRD, ADR, runbook)
- [ ] No secrets committed
- [ ] Migrations are backward-compatible (if applicable)
```

### PR rules
- **Max diff size:** 400 lines of substantive change. Larger PRs get rejected and split.
- **Two approvers** for `main` merges; one for non-prod branches
- **CI must be green** to merge; no exceptions
- **Squash and merge** is the default; merge commits only for release branches
- **Rebase before merge** to keep history linear

---

## 4. Code Review Standards

### What reviewers must check
1. **Correctness** — does it do what the PR claims?
2. **Tests** — are they real tests, not just coverage theater?
3. **Naming** — does every name read clearly without context?
4. **Boundaries** — does this violate package or layer boundaries?
5. **Performance** — N+1 queries, missing indexes, large blocking calls
6. **Security** — secrets, input validation, authz checks
7. **Cost** (for LLM code) — model tier appropriate? Caching considered?
8. **Citations** (for agent outputs) — does every factual claim path have grounding?

### What reviewers should not waste time on
- Style/formatting (the linter handles it; if it slipped through, fix the linter)
- Personal preference rewrites
- Bikeshedding on names that are clear enough

### Tone
Direct, specific, kind. Reviews are about the code, not the author. If a comment can be a suggestion, make it a suggestion (GitHub `suggestion` block).

---

## 5. Issue Tracking

- One issue per discrete piece of work
- Link the PR to the issue (closes #123)
- Label every issue: `area/*`, `type/*`, `priority/*`, `size/*`
- Triage runs weekly; untriaged > 7 days is a process failure

---

## 6. Documentation Rules

### What must be documented

- **Every public API** — OpenAPI specs auto-generated from FastAPI; reviewed in PR
- **Every agent prompt** — frontmatter with version, last reviewed date, purpose
- **Every non-obvious architectural choice** — ADR in `/docs/adrs`
- **Every operational procedure** — runbook in `/docs/runbooks`
- **Every public component** — JSDoc comment or props comment

### What does not need documentation

- Self-evident code (clear names + types make most comments unnecessary)
- Internal helpers used in one place
- Things that will change next week

### ADR format

```markdown
# ADR-NNN: <Short title>

**Status:** Proposed | Accepted | Superseded by ADR-NNN
**Date:** YYYY-MM-DD
**Deciders:** @ahmad @others

## Context
Why this decision is being made.

## Options considered
- Option A
- Option B
- Option C

## Decision
What we chose and why.

## Consequences
What this enables, what this costs, what it forecloses.
```

---

## 7. Environment Variables

- All env vars defined in **`.env.example`** at repo root; checked in
- **Never commit actual `.env` files** — `.gitignore` enforces
- **Validation at boot** — every service validates required env vars on startup and fails fast
- **Use Zod (TS) or Pydantic Settings (Python)** for env validation, not raw `process.env.X`
- **Secrets** never go in `.env.example`; only key names with placeholder values

---

## 8. Dependencies

### Adding a dependency
1. Check if existing dependencies cover the need
2. Verify license (must be MIT / Apache 2.0 / BSD / ISC)
3. Check maintenance status (last commit, open issues, security advisories)
4. Check bundle size impact (frontend) or install size (backend)
5. Document in PR description why it was needed

### Removing a dependency
Anyone, anytime. Less is more.

---

## 9. Database Migrations

- **Migrations are forward-only.** No "down" migrations in production. Reverse by writing a new forward migration.
- **Backward-compatible by default.** Migrations must not break the previously-deployed app version.
- **Two-phase migrations** for breaking changes: (1) add new column nullable, deploy code that writes both, (2) backfill, (3) drop old column.
- **Never edit a merged migration.** Add a new one.
- **Migration PRs are separate** from feature PRs when possible.

---

## 10. Testing Conventions

### Test pyramid
- **70% unit tests** — fast, isolated, no I/O
- **20% integration tests** — service + DB + (mocked) external APIs
- **10% E2E tests** — full stack, smoke tests, critical paths only

### What we test
- ✅ Business logic, especially scoring, BANT progression, evidence validation
- ✅ Agent output shape and citation requirements
- ✅ Tool boundaries (input validation, output guarantees)
- ✅ Critical user flows E2E

### What we don't waste time on
- ❌ Coverage theater (tests that exercise code without asserting meaningful things)
- ❌ UI snapshot tests for layouts that change frequently
- ❌ Testing third-party libraries

### LLM-specific testing
- **Prompt regression evals** in `python-packages/dc_eval/`
- Run on every PR that touches a prompt
- Use Promptfoo with a representative test set
- Track score deltas; block merges on regressions beyond threshold

---

## 11. Commenting Conventions

- **Code should be self-explanatory** through naming and structure
- **Comments explain "why"**, never "what"
- **TODO comments** must include an owner and ticket: `// TODO(ahmad, DC-123): handle edge case for...`
- **No commented-out code in main.** Use git history.

---

## 12. AI Coding Assistant Rules

See `09_AI_Coding_Rules.md` for the detailed Cursor/Claude Code rules. Summary:

- AI-generated code follows all conventions in this document, no exceptions
- AI must not invent dependencies; only use what's already in the lockfile or propose additions in the PR description
- AI must not generate code that violates package boundaries
- AI must include tests with non-trivial logic changes

---

## 13. Onboarding Checklist (for humans)

A new engineer should be able to run the full stack locally within 30 minutes. If they can't:

- [ ] README has wrong/missing steps
- [ ] Docker compose isn't working
- [ ] `.env.example` is incomplete
- [ ] Onboarding doc is stale

Treat onboarding friction as a P1 bug.
