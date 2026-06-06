# AIM SET 2.0 Project Risk and Best Practices Audit

Audit date: June 7, 2026
Scope: Next.js web application, FastAPI backend, Supabase persistence layer, public customer landing pages, live-call ingress, integrations, deployment configuration, tests, and production-readiness practices.

## Executive Summary

This system has a strong product shape, but several production-critical trust boundaries are currently weak or incomplete. The most important issues are not visual or stylistic; they are security and durability gaps around authentication, tenant isolation, public page access control, webhook validation, and live WebSocket ingress.

The highest-risk pattern is that the FastAPI backend generally trusts caller-supplied identity headers (`x-user-id`, `x-tenant-id`, `x-clerk-org-id`). If the backend is reachable outside the Next.js BFF, a caller can spoof another user or tenant. The live WebSocket path is even more exposed because it accepts the connection before any auth check and derives tenant/user context from client-sent JSON messages.

The second major pattern is "client-side or memory-only security." Public customer landing pages show a password gate in the browser, but the backend public payload endpoint returns published content directly to anyone with the share token. Password hashes are also checked only from the in-memory store, meaning they can disappear on process restart even when the page record exists in Supabase.

The third major pattern is production brittleness: Supabase errors are often swallowed and replaced with in-memory fallback, TypeScript and backend tests currently fail, Google Calendar integration is mostly stubbed, and RLS/database policies do not appear complete enough to compensate for application-side mistakes.

## Severity Overview

| Severity | Count | Theme |
|---|---:|---|
| Critical | 5 | Auth bypass, tenant spoofing, public payload exposure, unauthenticated live ingress, optional webhook signature |
| High | 8 | Shared tenant default, XSS risk, incomplete RLS, silent persistence fallback, incomplete OAuth, failing builds/tests |
| Medium | 8 | Upload validation, missing rate limits, weak deployment hardening, operational observability, CI gaps |
| Low | 5 | Documentation drift, duplicate Dockerfiles, inconsistent error handling, local artifacts, polish/maintainability |

## Methodology

The audit used static code review and local verification. I focused on where the system can fail rather than broad generic advice:

- Request entry points: Next.js BFF routes, FastAPI routers, public routes, webhooks, WebSockets.
- Identity and tenant propagation.
- Supabase access and fallback behavior.
- Public customer landing page access model.
- Stored/rendered HTML behavior.
- Upload and ingestion pipeline.
- OAuth and third-party integrations.
- CI, tests, type checks, deployment configuration.

Verification commands run:

```bash
pnpm --filter @dc-copilot/web exec tsc --noEmit --incremental false
python3 -m pytest -q
```

Results:

- TypeScript check failed with shared type and app type errors.
- Backend tests failed: 109 passed, 5 failed.

No source code fixes were applied during the audit.

## Trust Boundary Map

Current intended flow:

1. Browser authenticates through Clerk in the Next.js app.
2. Next.js BFF routes call FastAPI.
3. BFF forwards identity headers to FastAPI.
4. FastAPI resolves tenant from those headers.
5. FastAPI uses Supabase service-role access to read/write data.

Actual risk:

- FastAPI does not verify Clerk tokens for most `/api/v1/*` endpoints.
- Most private FastAPI routes do not require the shared internal secret.
- Supabase service-role access bypasses database-side user auth protections.
- Therefore, application-level auth must be correct everywhere. It is not currently centralized or strong enough.

## Critical Findings

### 1. FastAPI v1 Routes Trust Spoofable Identity Headers

Severity: Critical
Category: Authentication, authorization, tenant isolation
Affected files:

- `services/api/app/deps.py`
- `services/api/app/routers/v1_calls.py`
- Many other `services/api/app/routers/v1_*.py` routers using `get_tenant_context`

Evidence:

`get_tenant_context()` accepts user and tenant identity directly from headers:

```python
def get_tenant_context(
    x_user_id: Optional[str] = Header(default=None, alias="x-user-id"),
    x_tenant_id: Optional[str] = Header(default=None, alias="x-tenant-id"),
    x_clerk_org_id: Optional[str] = Header(default=None, alias="x-clerk-org-id"),
) -> TenantContext:
    if not x_user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing x-user-id")
    return TenantContext.from_headers(x_user_id, x_tenant_id, x_clerk_org_id)
```

Private route example:

```python
@router.get("")
def list_calls(ctx: TenantContext = Depends(get_tenant_context)) -> List[Dict[str, Any]]:
    return _calls.list_calls(ctx)
```

Failure scenario:

If the API is exposed publicly or reachable from an unintended network path, an attacker can call:

```http
GET /api/v1/calls
x-user-id: victim-user
x-tenant-id: victim-tenant
```

The backend will treat the caller as that tenant/user.

Why this matters:

The backend uses Supabase service-role credentials. Service-role calls bypass normal end-user RLS controls, so forged headers become a direct data-isolation risk.

Recommended remediation:

1. Add a central dependency for all private FastAPI routes that verifies either:
   - a Clerk JWT, or
   - a BFF-only signed internal request.
2. Derive `user_id`, `tenant_id`, and `clerk_org_id` from verified claims, not from caller-supplied headers.
3. Require `X-Internal-Secret` or mTLS/API gateway auth on all BFF-to-API routes if FastAPI is not independently validating Clerk.
4. Add route tests proving spoofed identity headers fail without valid auth.

Priority: Immediate.

### 2. Live WebSocket Has No Authentication and Trusts Client JSON

Severity: Critical
Category: Live ingress, data injection, tenant isolation
Affected file: `services/api/app/routers/websocket.py`

Evidence:

The WebSocket accepts immediately:

```python
@router.websocket("/ws/calls/{call_id}")
async def call_stream(websocket: WebSocket, call_id: str) -> None:
    await websocket.accept()
    channel = get_call_channel()
    await channel.subscribe(call_id, websocket)
```

For transcript messages, tenant/user context is built from message JSON:

```python
ctx = TenantContext.from_headers(
    msg.get("userId", "ws-user"),
    tenant_id=msg.get("tenantId"),
)
```

Failure scenario:

Any client that can reach `/ws/calls/{call_id}` can:

- subscribe to a call stream,
- send fake transcript events,
- inject arbitrary speaker text,
- impersonate a user or tenant,
- trigger live analysis and downstream post-call outputs.

Recommended remediation:

1. Require a short-lived signed WebSocket token issued by an authenticated BFF route.
2. Bind token claims to `call_id`, `tenant_id`, `user_id`, expiry, and allowed actions.
3. Reject connections before `accept()` if token validation fails.
4. Stop accepting tenant/user from message payloads.
5. Add tests for unauthorized connect, wrong tenant, expired token, and injected transcript.

Priority: Immediate.

### 3. Recall Webhook Signature Is Optional

Severity: Critical
Category: Webhook integrity, live-call injection
Affected files:

- `services/api/app/services/transcript_provider/recall_webhook.py`
- `services/api/app/routers/v1_webhooks.py`

Evidence:

If `recall_webhook_secret` is unset, signature verification succeeds:

```python
secret = get_settings().recall_webhook_secret
if not secret:
    return True
```

The webhook route also accepts `call_id`, `tenant_id`, and `user_id` query params:

```python
call_id: Optional[str] = Query(default=None),
tenant_id: Optional[str] = Query(default=None),
user_id: Optional[str] = Query(default=None),
```

Failure scenario:

In a production environment with missing `RECALL_WEBHOOK_SECRET`, anyone can post fake Recall transcript events. Because query parameters can influence tenant/user/call context, this can corrupt live sessions and downstream post-call artifacts.

Recommended remediation:

1. Make `RECALL_WEBHOOK_SECRET` mandatory in production.
2. Fail closed when the secret is missing unless an explicit local-dev flag is enabled.
3. Do not trust tenant/user query params from webhooks.
4. Resolve tenant and call through previously registered Recall bot/session metadata.
5. Store provider meeting IDs and expected tenant/call bindings when creating the bot.

Priority: Immediate.

### 4. Public Customer Landing Page Password Gate Is Bypassable

Severity: Critical
Category: Public access control, data exposure
Affected files:

- `apps/web/src/app/(public)/p/[token]/page.tsx`
- `apps/web/src/app/api/public/clp/[token]/route.ts`
- `services/api/app/routers/v1_public_clp.py`
- `services/api/app/domain/clp_service.py`

Evidence:

The public UI asks for a password:

```tsx
async function submitPassword() {
  await postPublic("auth", { password });
  setStep("identity");
}
```

But content loading later performs a plain GET:

```tsx
const res = await fetch(`/api/public/clp/${token}`);
```

The BFF forwards that GET directly:

```ts
const res = await fetch(`${apiBaseUrl()}/api/v1/public/clp/${encodeURIComponent(token)}`, {
  cache: "no-store",
});
```

The backend returns the payload for any published page by token:

```python
@router.get("/{share_token}")
def public_get(share_token: str) -> Dict[str, Any]:
    return _svc.public_payload(share_token)
```

Failure scenario:

Anyone with a valid `share_token` can bypass the browser password gate and fetch:

```http
GET /api/public/clp/{share_token}
```

This returns page content, selected assets metadata, proposal content, and comments.

Recommended remediation:

1. On successful password authentication, issue a signed public-page session token.
2. Require that token for:
   - payload GET,
   - proposal GET,
   - comments,
   - chat,
   - events,
   - document/proposal activity.
3. Bind token to `share_token`, visitor/session ID, expiry, and possibly email.
4. Store only password hash in database, never memory-only state.
5. Add direct API tests proving `GET /public/clp/{token}` fails before auth.

Priority: Immediate.

### 5. CLP Password Hash Check Uses Memory Store Instead of Supabase

Severity: Critical
Category: Persistence, access control correctness
Affected files:

- `services/api/app/domain/clp_service.py`
- `services/api/app/domain/clp_repository.py`

Evidence:

Password auth loads the hash from memory:

```python
stored_hash = self._password_hash_for_page(page["id"], share_token)
```

`_password_hash_for_page()` loops only over `get_memory_store().landing_pages`:

```python
for pages in get_memory_store().landing_pages.values():
    for row in pages.values():
        if str(row.get("id")) == page_id or row.get("share_token") == share_token:
            return row.get("password_hash")
return None
```

Failure scenario:

After API restart:

- Supabase still has the landing page and password hash.
- Memory store loses the password hash.
- Password auth can fail.
- Direct payload GET still succeeds because it queries Supabase by token.

Recommended remediation:

1. Return `password_hash` from a private repository method, not from the public API shape.
2. Verify password against durable database state.
3. Keep public response serialization separate from internal DB rows.

Priority: Immediate.

## High-Risk Findings

### 6. Shared Tenant Mode Defaults to Enabled

Severity: High
Category: Tenant isolation, multi-tenant architecture
Affected files:

- `services/api/app/config.py`
- `services/api/app/domain/kb_tenancy.py`

Evidence:

```python
kb_shared_mode: bool = True
kb_shared_tenant_key: str = "dc-copilot-shared"
```

When shared mode is enabled:

```python
if settings.kb_shared_mode:
    key = settings.kb_shared_tenant_key.strip() or "dc-copilot-shared"
    shared = TenantContext(tenant_id=key, user_id=ctx.user_id, clerk_org_id=key)
    return get_tenant_service().resolve(shared, allow_memory_fallback=allow_memory_fallback)
```

Failure scenario:

All users may resolve to the same team-scoped tenant for KB, calls, notes, and other shared repositories depending on the repository path. This may be acceptable for a demo, but not for true multi-tenant production.

Recommended remediation:

1. Default `kb_shared_mode` to `False`.
2. Permit shared mode only with explicit demo/local environment flags.
3. Add production startup assertion rejecting shared mode unless `ALLOW_SHARED_TENANT_IN_PROD=true`.
4. Add tests for tenant A/B isolation across calls, KB assets, content studio, CLP, and live sessions.

Priority: High.

### 7. Stored Proposal HTML Is Rendered Unsafely

Severity: High
Category: XSS, public content safety
Affected file: `apps/web/src/components/landing-page/clp-public-view.tsx`

Evidence:

```tsx
<div
  className="prose prose-sm max-w-none rounded-lg border bg-card p-6"
  dangerouslySetInnerHTML={{ __html: proposal.html }}
/>
```

Failure scenario:

If proposal HTML contains a script payload, event handler, malicious link, form, or iframe, it can execute or phish on the public customer page. This is especially important because proposal content may be generated or modified by an LLM/template workflow.

Recommended remediation:

1. Sanitize proposal HTML server-side before storage and client-side before render.
2. Use an allowlist sanitizer such as DOMPurify with strict HTML/CSS policy.
3. Strip scripts, event attributes, forms, external iframes, dangerous URLs, and inline JS.
4. Consider rendering generated artifacts in sandboxed iframes with no `allow-same-origin` unless required.
5. Add security tests with common XSS payloads.

Priority: High.

### 8. Supabase RLS Is Incomplete and Cannot Be Relied on With Service Role

Severity: High
Category: Data isolation
Affected files:

- `infra/supabase/migrations/001_init.sql`
- other Supabase migrations
- all service-role repository calls

Evidence:

RLS is enabled only for a few tables in the foundation migration:

```sql
ALTER TABLE pre_dc_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_dc_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE calls ENABLE ROW LEVEL SECURITY;
```

Visible main migrations do not define matching policies for all tenant-scoped tables. Many important tables include tenant data:

- `kb_assets`
- `kb_chunks`
- `call_briefs`
- `agent_runs`
- `audit_events`
- `customer_landing_pages`
- `clp_proposals`
- `content_studio_projects`
- `content_templates`
- `live_call_suggestions`
- `call_transcript_events`

Why this matters:

The API uses the Supabase service-role key. Service-role access bypasses RLS in typical Supabase setups. That makes application-side tenant checks mandatory and unforgiving.

Recommended remediation:

1. Add complete RLS policies for all tenant-scoped tables anyway.
2. Use anon/user-scoped Supabase clients where possible.
3. Keep service-role calls limited to backend-only administrative paths.
4. Add database tests or migration checks confirming every tenant table has RLS and policies.
5. Add application tests for cross-tenant access denial.

Priority: High.

### 9. Silent Supabase Failure Falls Back to Memory Store

Severity: High
Category: Durability, operational correctness
Affected files:

- `services/api/app/domain/clp_repository.py`
- `services/api/app/domain/kb_repository.py`
- `services/api/app/domain/content_studio_repository.py`
- `services/api/app/domain/calls_service.py`
- several other repositories

Evidence example:

```python
if settings.supabase_configured:
    try:
        get_supabase().table("customer_landing_pages").upsert(...).execute()
    except Exception:
        pass
mem = get_memory_store().landing_pages.setdefault(clerk_key, {})
mem[call_id] = row
return _lp_row_to_api(row, base_url=base_url)
```

Failure scenario:

Supabase write fails, but the API returns success because data was written to memory. After restart, the data is gone. In production this creates false success states, inconsistent UI, missing records, lost audit trail, and hard-to-debug customer behavior.

Recommended remediation:

1. In production, fail closed on Supabase persistence errors.
2. Keep memory fallback only for explicit local/demo mode.
3. Log structured errors with tenant, operation, table, and trace ID.
4. Return a 503/500 for failed durable writes.
5. Add tests that Supabase failure does not silently succeed in production config.

Priority: High.

### 10. Google Calendar Integration Is Mostly Stubbed

Severity: High
Category: Integration correctness, user trust
Affected files:

- `apps/web/src/app/api/integrations/google/auth/route.ts`
- `apps/web/src/app/api/integrations/google/callback/route.ts`
- `apps/web/src/app/api/integrations/google/events/route.ts`
- `apps/web/src/app/api/integrations/google/connection/route.ts`
- `apps/web/src/app/api/integrations/google/disconnect/route.ts`
- `apps/web/src/app/api/integrations/google/webhook/route.ts`

Evidence:

OAuth state nonce is generated but not stored:

```ts
const nonce = crypto.randomUUID();
const state = Buffer.from(JSON.stringify({ userId, nonce })).toString("base64url");

// In production: store `nonce` in a short-lived session/redis key keyed by userId
```

Callback exchanges tokens but token persistence is commented out:

```ts
const tokens = await exchangeCodeForTokens(code);

// await fetch(`${process.env.API_URL}/integrations/google`, { ... })
```

Events endpoint returns disconnected:

```ts
return NextResponse.json({
  calls: [],
  totalEvents: 0,
  syncedAt: new Date().toISOString(),
  source: "disconnected",
});
```

Failure scenario:

The user can complete a connection flow but no durable token or sync state exists. The UI can imply success while the integration cannot actually sync events.

Recommended remediation:

1. Persist OAuth nonce and verify it in callback.
2. Store encrypted refresh tokens in backend DB.
3. Implement connection state endpoint from durable storage.
4. Implement events sync from stored token.
5. Register and renew Google push channels.
6. Return honest "not implemented" state until production behavior exists.

Priority: High.

### 11. TypeScript Build Currently Fails

Severity: High
Category: Build safety, type contract drift
Affected files include:

- `packages/types/src/brief.ts`
- `apps/web/src/components/post-dc/post-dc-widget-cards.tsx`
- `apps/web/src/lib/dc-notes/build-from-import.ts`
- `apps/web/src/lib/dashboard/normalize-widget-props.ts`
- others from the local `tsc` output

Verification:

```bash
pnpm --filter @dc-copilot/web exec tsc --noEmit --incremental false
```

Observed failures include:

- Duplicate `dealSignals` in `PostCallReview`.
- Invalid field names such as `annualPotential`, `preDcIcpCorrect`, `nextStep`.
- Duplicate object literal keys.
- Missing required `KBAsset.version` in test fixtures.
- Unsafe `{}` fallback passed as `PostCallReview`.

Evidence example:

```ts
export interface PostCallReview {
  headline: string;
  summary: string[];
  nextStepProposal?: string;
  dealSignals?: PostDcDealSignals;
  ...
  bantScore?: Partial<Record<PostCallBantDimension, PostCallBantScoreItem>>;
  dealSignals?: PostCallDealSignals;
}
```

Recommended remediation:

1. Resolve the `PostDcDealSignals` vs `PostCallDealSignals` model split.
2. Normalize field names across import, UI, and shared types.
3. Add type-check to required pre-merge CI.
4. Avoid checked-in stale `tsconfig.tsbuildinfo` if not needed.

Priority: High.

### 12. Backend Tests Currently Fail

Severity: High
Category: Runtime reliability
Verification:

```bash
python3 -m pytest -q
```

Result:

- 109 passed
- 5 failed

Failed areas:

- Live segment sentiment surviving discovery failure.
- Memory fallback when Supabase tenant resolution fails.
- Live-call inputs flowing into post-DC review.
- End-live preserving live outputs for post-DC.
- Relevant content cache avoiding rebuild.

Why this matters:

The failures cluster around live-call handoff, tenant fallback, and cached content. Those are high-value workflows for the product.

Recommended remediation:

1. Fix or update failing regression tests before feature work.
2. Add these workflows to CI as blocking checks.
3. Add auth/tenant isolation tests alongside these functional tests.

Priority: High.

### 13. Public CLP Chat and Comments Are Not Session-Protected

Severity: High
Category: Public endpoint abuse, impersonation
Affected file: `services/api/app/routers/v1_public_clp.py`

Evidence:

Chat requires a `visitorId` string but does not verify ownership/session:

```python
visitor_id = str(body.get("visitorId") or "").strip()
text = str(body.get("body") or "").strip()
if not visitor_id or not text:
    raise HTTPException(status_code=400, detail="visitorId and body required")
```

Comments do not require a valid visitor session:

```python
comment = _repo.add_comment(
    page["id"],
    section_id=body.get("sectionId"),
    author_type="visitor",
    author_name=str(body.get("authorName") or "Visitor"),
    body=text,
    visitor_id=body.get("visitorId"),
)
```

Failure scenario:

Anyone with a share token can post comments or chat messages as arbitrary visitor names/IDs.

Recommended remediation:

1. Require signed visitor session tokens.
2. Validate visitor/session belongs to the landing page.
3. Rate-limit comments and chat.
4. Add spam/abuse controls.

Priority: High.

## Medium-Risk Findings

### 14. No Visible Rate Limiting on Public or Expensive Routes

Severity: Medium
Category: Abuse prevention, cost control
Affected areas:

- public CLP auth/identify/events/chat/comments
- copilot chat
- content generation
- KB upload
- Recall bot start
- live WebSocket transcript ingestion

Failure scenario:

Attackers or broken clients can brute-force CLP passwords, spam comments/events, trigger expensive LLM paths, or overload live analysis.

Recommended remediation:

1. Add per-IP and per-token rate limits for public endpoints.
2. Add per-user/tenant rate limits for LLM routes.
3. Add upload rate and size quotas per tenant.
4. Add live transcript event rate limits.
5. Log and alert on abuse patterns.

### 15. KB Upload Validation Is Extension-Based and Reads Whole File Into Memory

Severity: Medium
Category: Upload safety, resource exhaustion
Affected file: `services/api/app/routers/v1_kb.py`

Evidence:

```python
file_name = file.filename or "upload.bin"
ext = Path(file_name).suffix.lower()
if ext not in ALLOWED_EXTENSIONS:
    raise HTTPException(...)

content = await file.read()
if len(content) > settings.kb_max_upload_bytes:
    raise HTTPException(...)
```

Failure scenario:

Extension checks can be spoofed. Reading the whole file into memory can stress the process under concurrent uploads.

Recommended remediation:

1. Stream upload with size enforcement.
2. Sniff MIME/content signatures.
3. Quarantine before ingestion.
4. Virus/malware scan files.
5. Reject unsafe active content in Office/PDF flows where possible.

### 16. Production Auth Can Be Disabled by Missing Clerk Config

Severity: Medium
Category: Configuration safety
Affected files:

- `apps/web/src/proxy.ts`
- `apps/web/src/lib/api/auth.ts`

Evidence:

The proxy bypasses Clerk middleware when Clerk is not configured:

```ts
if (
  isLocalAuthBypassEnabled() ||
  !isClerkConfigured() ||
  !isClerkSecretConfigured()
) {
  return NextResponse.next();
}
```

BFF route handlers often return unauthorized when `auth()` yields no user, so this is not a full bypass by itself. But route protection depends on each route implementing checks correctly.

Recommended remediation:

1. In production, fail closed if Clerk is not configured.
2. Keep local bypass local-only.
3. Add deployment startup/build checks for required auth env vars.
4. Add an automated test for unauthenticated access to each protected BFF route.

### 17. Docker Images Run as Root

Severity: Medium
Category: Deployment hardening
Affected files:

- `Dockerfile.api`
- `Dockerfile`
- `services/api/Dockerfile`

Evidence:

The Dockerfiles use `python:3.11-slim` and never switch to a non-root `USER`.

Recommended remediation:

1. Create a non-root user.
2. Set file ownership appropriately.
3. Run `uvicorn` as non-root.
4. Add image scanning in CI.
5. Deduplicate Dockerfiles so security changes do not drift.

### 18. Health Endpoint Exposes Configuration State

Severity: Medium
Category: Information disclosure
Affected file: `services/api/app/main.py`

The health endpoint returns flags such as:

- `supabase_configured`
- `openai_configured`
- `anthropic_configured`
- `kb_shared_mode`

Recommended remediation:

1. Public health should return only status.
2. Detailed diagnostics should require admin/internal auth.
3. Avoid exposing model/provider configuration publicly.

### 19. Internal Secret Is Shared and Static

Severity: Medium
Category: Service-to-service auth
Affected files:

- `services/api/app/deps.py`
- `apps/web/src/lib/public-env.ts`
- BFF route files forwarding `X-Internal-Secret`

Risk:

A single static secret secures internal calls where used. If leaked, it grants broad access to internal routes. Many v1 routes do not require it anyway.

Recommended remediation:

1. Prefer signed request tokens with expiry and route scope.
2. Rotate secrets regularly.
3. Store only in server env, never expose to client.
4. Add audit logs for internal auth failures.

### 20. CI Exists but Current Local Checks Fail

Severity: Medium
Category: Engineering process
Affected file: `.github/workflows/ci.yml`

CI is configured to run lint, type-check, tests, and backend tests. However, local checks are currently failing. This means either CI is currently red, not running on active branches, or local uncommitted work has broken the project.

Recommended remediation:

1. Restore green CI before major feature work.
2. Add security-focused tests for auth and public routes.
3. Add migration/RLS checks.
4. Add dependency/security scanning.

### 21. Audit Logging Is Mostly In-Memory

Severity: Medium
Category: Forensics, compliance, observability
Affected file: `services/api/app/orchestrator/dispatcher.py`

Evidence:

```python
self.memory.add_audit(
    ctx.tenant_id,
    {
        "id": str(uuid.uuid4()),
        "agent": agent_id,
        "action": action,
        "trace_id": trace_id,
        ...
    },
)
```

Recommended remediation:

1. Persist audit logs durably.
2. Include actor, tenant, route, IP/request ID, and outcome.
3. Make auth failures and public-page events observable.
4. Use structured logs and dashboards.

## Low-Risk and Maintainability Findings

### 22. Documentation Drift

Severity: Low
Category: Product reliability
Examples:

- README says backend is optional/not included in one section, but the repo includes a full FastAPI backend.
- Architecture states evidence/citations are enforced by orchestration, while several flows use empty citations or creative modes.
- Google integration comments describe production behavior that is commented out.

Recommended remediation:

1. Split demo/local documentation from production documentation.
2. Mark stubbed features explicitly.
3. Keep architecture docs tied to testable guarantees.

### 23. Duplicate Dockerfiles

Severity: Low
Category: Maintainability
Affected files:

- `Dockerfile`
- `Dockerfile.api`
- `services/api/Dockerfile`

Risk:

Security or dependency changes can be applied to one Dockerfile and missed in the others.

Recommended remediation:

1. Keep one source of truth.
2. Remove or redirect duplicate Dockerfiles.
3. Document the supported deployment build path.

### 24. Checked-In/Local Generated Artifacts

Severity: Low
Category: Repository hygiene
Observed untracked/local items:

- `.cursor/`
- `apps/web/test-results/`
- `A1 by Human Input.pdf`
- additional local migration/test files

Recommended remediation:

1. Confirm whether these should be ignored or committed.
2. Avoid committing generated test artifacts.
3. Keep local PDFs/data separate from source unless they are official fixtures.

### 25. Error Handling Is Inconsistent

Severity: Low
Category: Developer experience, debuggability
Examples:

- Some routes convert backend failures to generic 401/500.
- Some repository failures are swallowed.
- Some public errors return raw `await res.text()` from backend through BFF.

Recommended remediation:

1. Standardize API error envelopes.
2. Separate user-facing messages from internal details.
3. Use request IDs and structured logs.

## Current Test and Build Failure Details

### TypeScript Failures

Command:

```bash
pnpm --filter @dc-copilot/web exec tsc --noEmit --incremental false
```

Key failures:

- `packages/types/src/brief.ts`: duplicate `dealSignals`.
- `apps/web/src/components/post-dc/post-dc-widget-cards.tsx`: references keys not present in `PostDcDealSignals`.
- `apps/web/src/lib/dc-notes/build-from-import.ts`: invalid/duplicate deal signal fields.
- `apps/web/src/lib/dashboard/normalize-widget-props.ts`: duplicate `dealSignals` object key.
- `apps/web/src/lib/landing-page/build-optimistic-draft.ts`: `ownerName` / `ownerEmail` not on `Call`.

Impact:

The frontend type contract is drifting. This can cause broken UI assumptions, incorrect deal signal rendering, and build failure in a strict CI/deploy environment.

### Backend Test Failures

Command:

```bash
python3 -m pytest -q
```

Result:

```text
109 passed, 5 failed
```

Failed tests:

- `test_live_segment_sentiment_survives_discovery_failure`
- `test_post_call_review_save_uses_memory_when_supabase_tenant_resolution_fails`
- `test_live_call_inputs_flow_into_post_dc_review`
- `test_end_live_call_preserves_live_outputs_for_post_dc`
- `test_get_relevant_content_returns_cached_brief_without_kb_search`

Impact:

The failures affect live-call to post-call continuity, tenant fallback behavior, and cached relevant-content behavior. Those are core product flows.

## Recommended Remediation Roadmap

### Phase 0: Stop the Bleeding

Goal: close exposed trust-boundary holes.

1. Require verified auth on all private FastAPI routes.
2. Require signed WebSocket tokens and reject unauthenticated connections.
3. Make Recall webhook signature mandatory in production.
4. Gate every CLP public payload endpoint behind password/session proof.
5. Disable shared tenant mode in production.

Suggested acceptance checks:

- Direct FastAPI calls without auth fail.
- Spoofed `x-tenant-id` does not grant access.
- WebSocket without token fails before subscription.
- Public CLP GET without session returns 401/403.
- Recall webhook without valid signature returns 401.

### Phase 1: Restore Build and Regression Safety

Goal: make failures visible before production.

1. Fix TypeScript errors.
2. Fix backend failing tests.
3. Add auth and tenant isolation test suite.
4. Add public CLP access-control tests.
5. Add WebSocket auth tests.
6. Add webhook signature tests.

Suggested acceptance checks:

```bash
pnpm --filter @dc-copilot/web exec tsc --noEmit --incremental false
python3 -m pytest -q
```

Both must pass.

### Phase 2: Make Persistence Honest

Goal: stop pretending production writes succeeded when Supabase failed.

1. Fail closed on Supabase write failures in production.
2. Restrict memory fallback to explicit local/demo mode.
3. Add structured logging for database failures.
4. Persist CLP comments/chat/events if they are product features.
5. Persist audit events durably.

Suggested acceptance checks:

- Simulated Supabase failure returns an error in production config.
- No successful mutation response relies only on memory unless demo mode is enabled.

### Phase 3: Harden Public and Generated Content

Goal: reduce public-surface abuse and XSS risk.

1. Sanitize proposal/template HTML.
2. Add CSP/security headers.
3. Add public route rate limiting.
4. Add spam controls for chat/comments.
5. Add upload content sniffing and malware scanning.

Suggested acceptance checks:

- Common XSS payloads render harmlessly.
- Brute-force password attempts are throttled.
- Uploaded files are validated beyond extension.

### Phase 4: Finish or Reframe Integrations

Goal: avoid false product states.

1. Complete Google OAuth token storage.
2. Verify OAuth nonce/state.
3. Implement connection status from durable backend.
4. Implement event sync.
5. Make disconnected/stubbed states explicit in UI if not implemented.

Suggested acceptance checks:

- OAuth callback rejects forged/unseen nonce.
- Calendar events sync after connect.
- Disconnect revokes/deletes durable tokens.

## Suggested Immediate Backlog

| Priority | Task | Owner Area |
|---:|---|---|
| P0 | Add auth dependency to all private FastAPI routers | Backend |
| P0 | Add signed WebSocket auth | Backend / Web |
| P0 | Make Recall webhook fail closed without valid signature | Backend |
| P0 | Require public-page session token for CLP payload/proposal/chat/comments | Backend / Web |
| P0 | Disable shared tenant mode in production | Backend / DevOps |
| P1 | Fix TypeScript failures | Web / Types |
| P1 | Fix 5 failing backend tests | Backend |
| P1 | Add cross-tenant access tests | Backend |
| P1 | Sanitize proposal HTML | Web / Backend |
| P1 | Remove silent Supabase fallback in production | Backend |
| P2 | Implement Google Calendar durable integration or mark as not implemented | Web / Backend |
| P2 | Add rate limiting | Platform |
| P2 | Harden Docker images | DevOps |
| P2 | Add security headers / CSP | Web |
| P3 | Clean docs and local artifacts | Project hygiene |

## Definition of Done for Production Readiness

This system should not be considered production-ready until:

- All private API routes verify identity server-side.
- All tenant IDs are derived from verified claims.
- WebSocket ingress is authenticated and call-bound.
- Webhooks fail closed unless signed.
- Public landing pages enforce password/session on the backend.
- Shared tenant mode is disabled for production tenants.
- HTML generated/stored by agents is sanitized before public render.
- Supabase failures do not silently fall back to memory in production.
- TypeScript and backend tests pass.
- CI blocks merges on lint, type-check, tests, and security checks.
- Public endpoints are rate-limited.
- Core audit logs are durable and searchable.

## Final Risk Assessment

Current production risk: High.

The core product can work in a controlled demo environment, but the current architecture has multiple places where identity, tenant context, and public-page access are trusted too early or verified only by client behavior. The highest priority is to move security enforcement into backend dependencies and durable server-side session checks, then restore CI confidence.

The good news: these are fixable boundaries. The codebase already has a clear BFF/API split, typed domain models, tests, and migration structure. The main task is to make the security model explicit and enforce it consistently instead of relying on route-by-route convention.
