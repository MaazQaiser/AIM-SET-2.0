# Backend Guidelines
**Applies to:** All Python services in `services/*` and `python-packages/*`
**Audience:** Backend engineers and AI coding assistants
**Version:** 0.1 (Draft)

---

## 0. Reading order for AI assistants

1. This file
2. `05_Project_Conventions.md`
3. `03_Agent_Specs.md` — the agent contract is the law for agent code
4. `09_AI_Coding_Rules.md`

---

## 1. Core Principles

1. **Async-first.** All I/O is async. Sync I/O in an async path blocks the entire event loop.
2. **Schema is the contract.** Pydantic models define every input, output, and event. Code without schemas doesn't ship.
3. **Errors are typed.** Exceptions are part of the API. Catch the right ones, raise the right ones.
4. **Cost is observable.** Every LLM call emits cost, tokens, model, latency. Untracked spend doesn't ship.
5. **Evidence is mandatory.** Agent outputs without citations fail the validator. No code path bypasses this.

---

## 2. Service Anatomy

Every service in `services/*` follows the same layout:

```
services/<service-name>/
├── src/
│   └── <service_name>/
│       ├── __init__.py
│       ├── main.py              # FastAPI app entry point
│       ├── config.py            # Pydantic Settings (env vars)
│       ├── api/                 # Route handlers (thin)
│       │   ├── __init__.py
│       │   ├── health.py
│       │   └── <feature>.py
│       ├── domain/              # Business logic (the real code)
│       │   ├── __init__.py
│       │   └── <concept>.py
│       ├── agents/              # Agent orchestration logic
│       │   └── <agent>.py
│       ├── db/                  # DB models, queries
│       │   ├── models.py
│       │   └── queries.py
│       ├── schemas/             # Pydantic schemas (request/response/events)
│       │   └── <feature>.py
│       ├── deps.py              # FastAPI dependency providers
│       └── exceptions.py        # Custom exceptions
├── tests/
│   ├── unit/
│   ├── integration/
│   └── conftest.py
├── pyproject.toml
└── Dockerfile
```

### Layer rules
- **API layer:** thin. Parse, validate, delegate. No business logic.
- **Domain layer:** the actual work. Pure where possible, side effects at the edges.
- **DB layer:** queries only. No business logic.
- **Schemas:** request/response shapes, internal event shapes. The single source of truth for types.

Violations to refuse in review:
- Business logic in route handlers
- SQL in domain code
- Pydantic models doing too much (validators that fetch data, etc.)

---

## 3. API Design

### REST principles we follow
- Resources are nouns, plural: `/calls`, `/agents`, `/knowledge-assets`
- Standard HTTP verbs (GET, POST, PUT, PATCH, DELETE)
- Status codes used correctly (200, 201, 204, 400, 401, 403, 404, 409, 422, 429, 500, 502, 503)
- Versioned via URL prefix: `/v1/...` (don't use headers for versioning)
- Pagination via cursor (`?cursor=...&limit=...`), not page numbers
- Filtering via explicit query params, not query DSLs

### Standard endpoints per resource

```
GET    /v1/calls              # List, paginated
POST   /v1/calls              # Create
GET    /v1/calls/{id}         # Read
PATCH  /v1/calls/{id}         # Partial update
DELETE /v1/calls/{id}         # Delete (soft by default)

POST   /v1/calls/{id}/<action>  # Actions that don't fit CRUD
```

### Response envelope

All responses use this envelope:

```python
class Response(BaseModel, Generic[T]):
    data: T
    meta: ResponseMeta | None = None  # pagination, etc.
    errors: list[ErrorDetail] | None = None
```

Errors:

```python
class ErrorDetail(BaseModel):
    code: str           # machine-readable, stable
    message: str        # human-readable, may change
    field: str | None = None   # for validation errors
    trace_id: str       # for support
```

### OpenAPI
- FastAPI generates `/openapi.json` automatically
- Frontend types are generated from this on every backend change (CI step)
- Every endpoint has a `summary` and `description`
- Every endpoint has at least one example response

---

## 4. Pydantic and Type Safety

### Use Pydantic v2 everywhere

```python
from pydantic import BaseModel, Field

class CallSummary(BaseModel):
    model_config = {"frozen": True}  # immutable by default

    call_id: str
    summary: str = Field(..., min_length=10, max_length=2000)
    confidence: float = Field(..., ge=0.0, le=1.0)
    citations: list[Citation] = Field(default_factory=list)
```

### Rules
- `model_config = {"frozen": True}` for value objects (immutable, hashable)
- Use `Field(...)` with constraints, not bare types
- Lists default via `default_factory=list`, never `default=[]`
- Discriminated unions for polymorphism, not `isinstance` checks
- Custom validators only when constraints can't express the rule
- **No `Any` type without a comment explaining why**

### Type checking
- `pyright` in strict mode in CI
- `mypy` is fine too; pick one and stick
- Build fails on type errors

---

## 5. The Agent Code Pattern

Every agent is a class that follows the same shape. This consistency is enforced.

```python
from abc import ABC, abstractmethod
from typing import Generic, TypeVar

from dc_core.envelope import AgentOutput, Citation
from dc_core.errors import EvidenceRequiredError
from dc_llm.client import LLMClient
from dc_llm.policy import ModelPolicy

InputT = TypeVar("InputT", bound=BaseModel)
OutputT = TypeVar("OutputT", bound=BaseModel)


class Agent(ABC, Generic[InputT, OutputT]):
    """Base class. Do not override execute() — override _run()."""

    name: str
    model_policy: ModelPolicy

    def __init__(self, llm: LLMClient, tracer: Tracer):
        self.llm = llm
        self.tracer = tracer

    async def execute(self, input_: InputT) -> AgentOutput[OutputT]:
        """Public entry. Handles tracing, citation validation, cost tracking."""
        with self.tracer.span(f"agent.{self.name}.execute") as span:
            span.set_attribute("input.size", len(input_.model_dump_json()))
            result, citations, cost = await self._run(input_)
            if self._requires_citations(result) and not citations:
                raise EvidenceRequiredError(
                    f"{self.name} produced output without citations"
                )
            return AgentOutput(
                agent=self.name,
                result=result,
                citations=citations,
                cost=cost,
                trace_id=span.trace_id,
            )

    @abstractmethod
    async def _run(self, input_: InputT) -> tuple[OutputT, list[Citation], Cost]:
        """Implement the agent's work here."""
        ...

    def _requires_citations(self, result: OutputT) -> bool:
        """Override if the agent has outputs that legitimately need no citations."""
        return True
```

### Rules for agent implementations
- Override `_run`, never `execute`
- Tools are injected, not imported at the top of `_run`
- Use `model_policy` to select model; never hardcode model strings in agent code
- Every LLM call goes through `self.llm.complete(...)` — not the SDK directly
- Citations must be real references to KB documents, transcript segments, etc., not invented IDs

---

## 6. LLM Integration

### Wrapper, not direct SDK use

```python
# python-packages/dc_llm/client.py
class LLMClient:
    async def complete(
        self,
        *,
        agent_name: str,
        operation: str,
        prompt_version: str,
        model: ModelTier,
        messages: list[Message],
        max_tokens: int,
        temperature: float = 0.0,
        timeout_s: float = 30.0,
    ) -> LLMResponse:
        """All LLM calls go through here.

        Records cost, latency, tokens, model used, prompt version.
        Handles retries with exponential backoff.
        Routes through the configured provider with fallbacks.
        """
        ...
```

### Why a wrapper
- Single place to enforce cost guards
- Single place to enforce model policy
- Single place to add tracing
- Single place to switch providers in an outage
- Testability — mock one thing, not the SDK

### Prompts as code

```
prompts/
├── live_call_agent/
│   ├── proactive_nudge_v3.md
│   ├── proactive_nudge_v3.eval.yaml
│   └── bot_chat_response_v2.md
├── coaching_agent/
│   ├── per_call_scorecard_v5.md
│   └── win_loss_analysis_v2.md
└── ...
```

Each prompt file has frontmatter:

```markdown
---
agent: live_call_agent
operation: proactive_nudge
version: "3.0.0"
last_reviewed: 2026-05-15
reviewer: ahmad
model_tier: standard
---

# System prompt
...

# User prompt template
...
```

### Rules
- Prompt changes require a version bump and an eval run
- Old prompt versions stay in the repo (for replay and debugging)
- Reference prompts by `agent_name + operation + version` in code, never by file path

---

## 7. Database Patterns

### Models

```python
# db/models.py
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from sqlalchemy import String, DateTime, func
from datetime import datetime
import uuid

class Base(DeclarativeBase):
    pass

class Call(Base):
    __tablename__ = "calls"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    tenant_id: Mapped[str] = mapped_column(String, index=True)
    started_at: Mapped[datetime] = mapped_column(DateTime, index=True)
    ended_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    # ...
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())
```

### Rules
- **Every table has `tenant_id`** (multi-tenant from day 1, even if we deploy single-tenant)
- Every table has `created_at`, `updated_at` (`server_default=func.now()`)
- UUIDs as primary keys (not auto-increment ints) — easier for distributed systems
- Indexes on every foreign key and every queried column
- Use enums (Postgres native or SQLAlchemy Enum) for status fields
- **Soft delete** for user-facing data (`deleted_at` column); hard delete only for ephemeral/transient data

### Queries
- Use SQLAlchemy 2.0 select() syntax, not the legacy Query API
- Query functions live in `db/queries.py`, not scattered in domain code
- Async session for all DB access
- N+1 prevention via `selectinload()` or `joinedload()` — always explicit, never autoload

---

## 8. Error Handling

### Exception hierarchy

```python
# exceptions.py
class DCError(Exception):
    """Base for all our exceptions."""
    code: str = "internal_error"
    status_code: int = 500

class ValidationError(DCError):
    code = "validation_error"
    status_code = 422

class NotFoundError(DCError):
    code = "not_found"
    status_code = 404

class EvidenceRequiredError(DCError):
    code = "evidence_required"
    status_code = 500  # internal — should never reach the user

class CostCapExceededError(DCError):
    code = "cost_cap_exceeded"
    status_code = 429

class UpstreamError(DCError):
    code = "upstream_error"
    status_code = 502
```

### Global handler

```python
@app.exception_handler(DCError)
async def dc_error_handler(request: Request, exc: DCError):
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "errors": [{
                "code": exc.code,
                "message": str(exc),
                "trace_id": request.state.trace_id,
            }]
        }
    )
```

### Rules
- Never raise bare `Exception`. Raise something typed.
- Never catch bare `Exception` without re-raising. Catch what you handle.
- Don't use exceptions for control flow when a Result type would be clearer
- Log at the point of catching, not at every level

---

## 9. Background Jobs

### Celery patterns

```python
# tasks/post_call.py
from celery import shared_task
from dc_core.tracing import get_tracer

tracer = get_tracer(__name__)

@shared_task(
    bind=True,
    autoretry_for=(UpstreamError,),
    retry_backoff=True,
    retry_backoff_max=600,
    max_retries=5,
    acks_late=True,
)
def process_post_call(self, call_id: str) -> None:
    with tracer.span("task.process_post_call", call_id=call_id):
        # Work happens here
        ...
```

### Rules
- **`acks_late=True`** so failures retry instead of disappearing
- **Idempotent tasks.** Running twice must produce the same result
- **`autoretry_for`** explicit, not catch-all
- **Backoff** is exponential with a cap
- **Tasks own one thing.** Compose tasks, don't write a 500-line task

---

## 10. Caching

### Levels
- **In-process LRU cache** (`functools.lru_cache` or `cachetools`) for cheap repeated computations
- **Redis cache** for cross-instance shared data
- **Postgres** when the cache needs durability (semantic search results, computed scorecards)

### Rules
- **TTL on every cache entry.** No infinite caches.
- **Cache keys versioned.** Format: `{namespace}:{version}:{key}`. Bump version to invalidate.
- **Cache the result, not the input.** If inputs vary in irrelevant ways, normalize before caching.
- **Read-through, not write-through, by default.** Simpler.

### KB retrieval cache
- Cache embedding lookups by content hash (huge cost saving)
- Cache top-K retrieval results by query hash + KB version
- Invalidate on KB document update (event-driven)

---

## 11. Testing

### Test pyramid (mirrors frontend, different specifics)

- **Unit tests:** pure functions, schema validation, scoring logic, prompt template rendering
- **Integration tests:** service + DB + mocked LLM. Real database in a container.
- **Contract tests:** ensure schema changes don't break consumers
- **Eval tests:** prompt regression suite, runs in CI

### Patterns

```python
# tests/unit/test_bant_scorer.py
import pytest
from dc_tools.bant import score_bant_progression

def test_score_bant_progression_full_progression():
    before = {"budget": False, "authority": False, "need": True, "timeline": False}
    after = {"budget": True, "authority": True, "need": True, "timeline": True}
    result = score_bant_progression(before, after)
    assert result.delta == 3
    assert result.is_qualifying is True
```

### LLM testing

Don't mock the LLM at the unit level. Mock at the **`LLMClient` interface**.

```python
@pytest.fixture
def mock_llm(mocker):
    client = mocker.AsyncMock(spec=LLMClient)
    client.complete.return_value = LLMResponse(
        text='{"answer": "test", "citations": []}',
        cost=Cost(usd=0.001, tokens=100),
    )
    return client
```

For prompt evals, run the **real model** in a separate eval CI job, not on every PR.

---

## 12. Security

See `08_Production_Checklist.md` for the full security list. Backend-specific:

- **Every endpoint has an auth dependency.** No "I'll add it later."
- **Tenant isolation enforced at the query level.** Every query filters by `tenant_id` from the auth context.
- **No raw SQL with string concatenation.** Parameterize.
- **Secrets via env vars only.** Validated at boot.
- **Input validation via Pydantic.** Trust nothing from outside.
- **Rate limit every public endpoint.** Use SlowAPI or equivalent.
- **CSRF protection** for state-changing endpoints called from the browser.

---

## 13. Observability

### What every service emits

- **Structured logs** (JSON) via `structlog`
  - Required fields: timestamp, level, service, trace_id, tenant_id, message
- **Metrics** via OpenTelemetry SDK
  - Standard: request count, latency histogram, error rate
  - Custom: LLM cost per agent, retrieval latency, queue depth
- **Traces** via OpenTelemetry
  - Spans for every external call (DB, LLM, HTTP)
  - Trace context propagated across services via headers
- **LLM-specific** via Langfuse
  - Every LLM call logged with prompt version, model, cost, latency, output

### Rules
- **Trace IDs in every error response** so support can correlate
- **PII redaction in logs.** Never log a transcript line, an email, a name, a number that could be PII.
- **Log levels used correctly.** DEBUG for development. INFO for state changes. WARN for recoverable. ERROR for actually broken.

---

## 14. Configuration

### Pydantic Settings everywhere

```python
# config.py
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_prefix="ORCH_",
        extra="forbid",
    )

    database_url: str
    redis_url: str
    anthropic_api_key: str
    log_level: str = "INFO"
    cost_cap_per_call_usd: float = 5.0
    # ...

settings = Settings()  # validated at import time
```

### Rules
- All config via env vars (12-factor)
- Validated at boot — service refuses to start with invalid config
- Different env prefixes per service to prevent cross-pollution
- `extra="forbid"` so typos in env names fail loudly

---

## 15. Dependency Injection

FastAPI's `Depends` is the right tool. Don't bring in a separate DI framework.

```python
# deps.py
from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

async def get_db_session() -> AsyncSession:
    async with async_session_maker() as session:
        yield session

async def get_current_user(...) -> User:
    ...

async def get_tenant_context(user: User = Depends(get_current_user)) -> TenantContext:
    ...

# Use:
@router.get("/calls")
async def list_calls(
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_db_session),
):
    return await call_queries.list_for_tenant(db, tenant.tenant_id)
```

### Rules
- Dependencies are functions, not classes (unless you genuinely need state)
- Dependencies compose; build small ones that combine into larger ones
- Test dependencies independently with `app.dependency_overrides`

---

## 16. House Style

- **Type hints on every function signature.** No exceptions.
- **Docstrings on every public function.** Google or NumPy style; pick one and stick.
- **No print().** Use logger.
- **No commented-out code** in main. Use git history.
- **No magic numbers.** Constants at module top, named.
- **Imports sorted** by ruff (stdlib, third-party, local). Auto-fixable.
- **No `# noqa` without a reason in the comment.**
