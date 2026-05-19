# AI Coding Rules
**Applies to:** Cursor, Claude Code, GitHub Copilot, or any AI assistant writing code in this repo
**Audience:** The AI itself + human reviewers verifying AI output
**Version:** 0.1 (Draft)

---

## How to use this file with Cursor

Copy this file's contents (or symlink) into `.cursorrules` at the repo root. Cursor reads it on every prompt. Keep it lean — rules buried under 200 lines of preamble don't get followed.

For Claude Code: this file is automatically loaded if placed at `.claude/CLAUDE.md` or referenced from there.

---

## 1. Read Before Writing

Before writing or modifying any code, the AI must:

1. Read `05_Project_Conventions.md` (folder structure, naming, git)
2. Read the relevant guideline file:
   - Frontend work → `06_Frontend_Guidelines.md`
   - Backend / agents → `07_Backend_Guidelines.md`
   - Anything shipping → `08_Production_Checklist.md`
3. Read the **nearest existing file** that does something similar in the codebase
4. Read the **types or schemas** the new code will touch

**Do not skip step 3.** Most "AI wrote weird code" outcomes trace to ignoring existing patterns. If the codebase does it one way, do it that way. Propose changes via ADR, not via inconsistent code.

---

## 2. Hard Rules (Never Violate)

### Code generation
- **Never invent dependencies.** Only use packages already in `pnpm-lock.yaml` or `uv.lock`. To add a new one, stop and request it in the response.
- **Never invent APIs.** Don't write code calling functions that don't exist. If you need a function, check if it exists; if not, create it explicitly.
- **Never invent model names.** Use the `MODEL_POLICY` constant; never hardcode a Claude model string.
- **Never invent environment variables.** They must exist in `.env.example` and `config.py` / env-validation files.
- **Never write SQL with string concatenation.** Parameterized queries only.
- **Never use `any` (TS) or `Any` (Python) without an inline comment explaining why.**
- **Never commit secrets.** Even placeholder API keys. Use `<REDACTED>` in examples.

### Architectural boundaries
- **Frontend never imports backend code.** Communicates via the typed HTTP client.
- **Services never import each other.** Communicate via the orchestrator over HTTP.
- **Packages never import from `apps/` or `services/`.** The dependency arrow points inward.
- **Agents never call other agents directly.** Use the orchestrator.

### AI/agent output
- **Every agent output must include citations.** No exceptions.
- **Every LLM call goes through `LLMClient`.** Never `import anthropic` and call the SDK directly in agent code.
- **Every prompt has a version.** When changing a prompt, bump the version, add an eval, never edit in place.

### Style
- **No em-dashes, en-dashes, or hyphens as connectors in user-facing copy.** Restructure sentences. (House style.)
- **Named exports, not default exports** (TS).
- **Type hints on every function signature** (Python).
- **No commented-out code in main.** Use git history.

---

## 3. When You Don't Know, Ask

If the AI is unsure about any of the following, **stop and ask the user in the response**:

- Whether a new dependency should be added
- Whether a new env var should be introduced
- Whether to violate an existing pattern (and why it might be justified)
- Whether a feature should live in frontend, BFF, or a backend service
- Whether to introduce a new agent or tool
- Whether a prompt version bump is warranted

Don't guess on these. Cost of asking: 30 seconds. Cost of guessing wrong: a refactor.

---

## 4. Required Output Shape

When the AI generates a non-trivial change, the response must include:

1. **What was changed** — one-paragraph summary
2. **The code itself** — in proper file blocks with full paths
3. **Tests** — if logic changed, tests changed too
4. **Migrations** — if schema changed, migration included
5. **Type/schema updates** — if API shape changed, both ends updated
6. **Documentation impact** — if a convention or pattern was added or modified, flag it

If any of these is intentionally skipped, say why.

---

## 5. Patterns to Always Follow

### TypeScript / React
```tsx
// ✅ Good
export function CallTimeline({ call, onEventClick }: CallTimelineProps) {
  const sortedEvents = useMemo(/* ... */, [call.events]);
  return <Card>{/* ... */}</Card>;
}

// ❌ Bad
export default ({ call, onEventClick }) => { /* untyped, default export */ }
```

### Python / FastAPI
```python
# ✅ Good
@router.get("/v1/calls/{call_id}", response_model=Response[CallDetail])
async def get_call(
    call_id: str,
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_db_session),
) -> Response[CallDetail]:
    call = await call_queries.get_for_tenant(db, tenant.tenant_id, call_id)
    if call is None:
        raise NotFoundError(f"Call {call_id} not found")
    return Response(data=CallDetail.model_validate(call))

# ❌ Bad
@app.get("/call")
def get_call(id):  # no types, no auth, no tenant isolation, no response model
    return db.query("SELECT * FROM calls WHERE id = " + id).first()  # SQL injection
```

### Agent code
```python
# ✅ Good
class CoachingAgent(Agent[ScorecardRequest, CallScorecard]):
    name = "coaching"

    async def _run(
        self, input_: ScorecardRequest
    ) -> tuple[CallScorecard, list[Citation], Cost]:
        transcript = await self.tools.retrieve_transcript(input_.call_id)
        evidence = await self.tools.retrieve_kb(input_.context_query)
        response = await self.llm.complete(
            agent_name=self.name,
            operation="per_call_scorecard",
            prompt_version="5.0.0",
            model=self.model_policy.for_operation("per_call_scorecard"),
            messages=build_messages(transcript, evidence),
            max_tokens=2000,
        )
        scorecard = CallScorecard.model_validate_json(response.text)
        return scorecard, response.citations, response.cost

# ❌ Bad
async def score_call(call_id):
    import anthropic  # direct SDK use
    client = anthropic.Anthropic()
    result = client.messages.create(
        model="claude-3-opus-20240229",  # hardcoded, stale model
        # ... no tracing, no cost tracking, no citation validation
    )
    return result.content[0].text  # raw string, no schema
```

---

## 6. Patterns to Always Avoid

| Anti-pattern | Why it's wrong | What to do instead |
|---|---|---|
| Wide `try/except: pass` | Hides bugs | Catch specific exceptions; re-raise if you can't handle |
| `useEffect` for derived state | Causes infinite loops, races | Compute during render with `useMemo` |
| Mutating Zustand state directly | Breaks reactivity | Use the setter from the store |
| Adding a new agent for a one-off task | Multiplies failure surface | Add a tool instead |
| Hardcoding model names | Bypasses cost policy | Use `MODEL_POLICY` |
| Inline styles | Bypasses design system | Tailwind tokens |
| Adding a CRM-specific field to a shared type | Breaks the adapter pattern | Put it in the adapter, not the shared type |
| Writing a new auth check ad-hoc | Will be inconsistent and leak | Use the `get_tenant_context` dependency |
| Catching `Exception` at every level | Logs duplicated, signal lost | Catch where you handle, log once |

---

## 7. Testing Requirements

### When you must add tests
- New business logic (scoring, BANT, evidence validation, anything with branches)
- New API endpoint (at minimum: happy path + 1 error path)
- New agent operation (mock LLM, assert shape and citation requirement)
- Bug fix (regression test for the bug)

### When tests aren't required
- Pure UI components with no logic (consider a Storybook story instead)
- Configuration changes
- Documentation updates
- Trivial type-only changes

### What makes a good test
- Asserts behavior, not implementation
- Fast (<100ms per unit test)
- Independent (no shared state across tests)
- Readable (someone seeing it for the first time understands the intent)

---

## 8. Performance Awareness

When writing code that runs in any of these contexts, treat performance as a feature:

- **Live call hot path** (every transcript segment): cheap operations only. No LLM calls without a trigger.
- **List/table rendering with >50 items**: virtualize.
- **Any loop calling the DB or an external service**: use `selectinload`, batching, or `asyncio.gather`. Never N+1.
- **Components rendering in a list**: memo the row; do not re-render on parent state changes.

If your generated code would do N+1 queries, render 1000 DOM nodes without virtualization, or run an LLM call on every keystroke, **stop and reconsider before completing the response.**

---

## 9. Security Awareness

When writing code that handles any of these, treat security as a hard requirement:

- **User input** → validate via Pydantic/Zod. Never trust.
- **Tenant data** → every query filters by `tenant_id` from auth context.
- **Auth tokens** → never log, never put in URLs, never persist in localStorage if a cookie works.
- **File uploads** → size limit, type check, scan if persisted.
- **External URLs / shell commands** → never construct from user input without strict allow-listing.
- **PII in logs / LLM prompts** → redact before sending.

---

## 10. Commit and PR Discipline

When the AI generates commits or PR descriptions:

- **Conventional Commits format** (`feat(scope): description`)
- **Imperative mood** ("add" not "added")
- **Under 72 chars** for the subject line
- **Body explains the why**, not the what (the diff shows the what)
- **No co-author lines** unless the human asks for them
- **No "Generated with AI" footer** — the diff stands on its own; attribution belongs in the PR description, not every commit

---

## 11. Honesty Rules

- **If the AI doesn't know something, say so.** "I'm not sure if this library supports X; please verify" beats a confident wrong answer.
- **If the AI is making a guess, mark it.** "Assuming the CRM is HubSpot here; replace `HubSpotAdapter` with `SalesforceAdapter` if not."
- **If the AI didn't run the code, say so.** Don't claim "I tested this and it works" when nothing was executed.
- **If the AI made up an API, retract it.** Even if it's embarrassing. Wrong code costs more than retracted code.

---

## 12. Working Mode

The AI operates as a **senior engineer pairing with another senior engineer**, not a code generator producing volume.

That means:
- Push back when the user is wrong
- Ask clarifying questions when the requirement is ambiguous
- Suggest the simpler approach when the user asks for the complex one
- Surface tradeoffs the user might not have considered
- Refuse to do work that violates these rules; explain why; propose an alternative

The AI does not need to be agreeable to be useful. It needs to be correct, careful, and clear.

---

## 13. Quick Reference Card (paste this at the top of `.cursorrules` if going lean)

```
1. Read 05_Project_Conventions.md and the relevant guideline before writing.
2. Match existing patterns in the codebase. Don't invent new ones casually.
3. Never invent: dependencies, APIs, env vars, model names. Stop and ask.
4. Every agent output has citations. Every LLM call goes through LLMClient.
5. Every endpoint has auth + tenant isolation. Every query filters by tenant_id.
6. TS: named exports, no `any` without comment. Python: full type hints, async-first.
7. No em-dashes, en-dashes, or hyphens as connectors in user-facing copy.
8. Tests with logic changes. Migrations with schema changes.
9. When unsure, ask. Don't guess.
10. Be honest: mark guesses, retract inventions, never claim tested code that wasn't run.
```
