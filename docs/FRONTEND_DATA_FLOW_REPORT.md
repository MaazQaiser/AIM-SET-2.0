# Frontend Data Flow and Mock Data Report

Date: 2026-05-24

Scope: `apps/web` frontend, its Next.js BFF routes under `apps/web/src/app/api`, and the FastAPI backend under `services/api`.

## Executive summary

The frontend is not purely mock-driven. The main calls, DC notes, KB, Content Studio, live-call, copilot chat, and agent configuration surfaces are wired through the Next.js BFF to FastAPI.

However, several user-facing product areas are still placeholders or local-only:

- Coaching candidates, coaching insights, quarterly patterns, content gaps, and KB watchlist return empty arrays from BFF routes.
- Google Calendar OAuth starts and can exchange a code, but token storage, connection status, calendar reads, selection persistence, sync, and disconnect are still stubs.
- Post-call pipeline output is returned by the backend, but the frontend only keeps a small discovery snapshot and does not consume or persist generated CRM tasks/coaching artifacts.
- A hardcoded Frontera demo call/brief/post-review/transcript is injected into normal call data paths.
- Some documentation/env flags describe mock/API switching that is no longer actually used by the app.

## Backend-backed frontend data

| Frontend surface | Frontend source | BFF route | Backend route/source | Notes |
|---|---|---|---|---|
| Calls list | `useCalls()` in `apps/web/src/lib/data/hooks.ts:33` | `/api/calls` | `GET /api/v1/calls` in `services/api/app/routers/v1_calls.py:24`; `CallsService.list_calls()` in `services/api/app/domain/calls_service.py:105` | Reads Supabase `calls`, falls back to in-memory store, and if empty syncs from DC notes. Frontend also injects Frontera demo call when API returns non-empty data. |
| Call detail | `useCall()` in `apps/web/src/lib/data/hooks.ts:49` | `/api/calls/[callId]` | `GET /api/v1/calls/{call_id}` in `services/api/app/routers/v1_calls.py:28` | If BFF fails, frontend falls back to local DC import store. |
| Pre-call brief | `useCallBrief()` in `apps/web/src/lib/data/hooks.ts:88` | `/api/calls/[callId]/brief` | `GET /api/v1/calls/{call_id}/brief` in `services/api/app/routers/v1_calls.py:36`; `call_briefs` via `CallsService.get_brief()` | Frontend merges local/imported/demo data with backend data, so missing backend arrays may be masked by local fallback. |
| DC notes import/hydration | `useDcImportsStore.loadFromDb()` in `apps/web/src/stores/use-dc-imports.ts:61`; Settings import components | `/api/dc-notes`, `/api/dc-notes/ingest` | `/dc-notes`, `/dc-notes/ingest` in `services/api/app/routers/dc_notes.py:61` and `:78` | Persists pre/post DC records to Supabase or backend memory store, syncs calls, and can run PRE-DC workflow on ingest. |
| KB assets/upload/preview | `useKbAssets()` in `apps/web/src/lib/data/hooks.ts:196`; KB upload components | `/api/kb/*` | `/api/v1/kb/*` in `services/api/app/routers/v1_kb.py` | Backed by `kb_assets`, `kb_chunks`, storage, ingest jobs, and memory fallback. |
| Content Studio projects/templates | `apps/web/src/lib/data/content-studio-hooks.ts` | `/api/content/studio/*`, `/api/content/templates/*` | `/api/v1/content/*` in `services/api/app/routers/v1_content_studio.py` | Backed by `content_templates`, `content_studio_projects`, messages, revisions, and exports. |
| Agent config | `apps/web/src/lib/data/agent-config-hooks.ts` | `/api/agents/[agentId]/config` | `/api/v1/agents/{agent_id}/config` in `services/api/app/routers/v1_agents.py:48` | Reads/saves Supabase `agent_configs` or memory store; defaults come from backend code. |
| Agent runs | `useAgentRuns()` in `apps/web/src/lib/data/hooks.ts:255` | `/api/agents/runs` | `/api/v1/agents/runs` in `services/api/app/routers/v1_agents.py:24` | Backend uses Supabase `agent_runs` plus memory store. BFF silently returns `[]` if upstream fails. |
| Agent audit | `useAgentAudit()` in `apps/web/src/lib/data/hooks.ts:267` | `/api/agents/audit` | `/api/v1/agents/audit` in `services/api/app/routers/v1_agents.py:29` | Current backend reads `memory_store.audit`; it does not query Supabase `audit_events`. |
| Copilot chat/upload | `apps/web/src/components/bot-chat-panel.tsx` | `/api/copilot/chat`, `/api/copilot/upload` | `/api/v1/copilot/chat`, `/api/v1/kb/assets/upload` | Chat is routed to the backend orchestrator; upload is stored as KB asset. |
| Live call | `useCallStream()` and `useLiveCallInit()` | WebSocket `/ws/calls/{callId}` plus `/api/calls/[callId]/live-session` | `services/api/app/routers/websocket.py`; live repository via `GET /api/v1/calls/{call_id}/transcript-events` and `/suggestions` | Real Recall path exists. Demo replay also sends segments through backend when enabled. |

## Frontend mock/static/demo data usage

| Area | File/reference | What is mocked or static | User-visible effect |
|---|---|---|---|
| Frontera demo scenario | `apps/web/src/lib/demo/franchise-ai-platform-demo.ts:6`, `:8`, `:38`, `:143`, `:217` | Hardcoded demo call, brief, post-call review, and transcript. | Demo account can appear alongside real backend calls. |
| Demo call injection | `apps/web/src/lib/data/hooks.ts:33-36`; `apps/web/src/lib/demo/franchise-ai-platform-demo.ts:316-322` | `useCalls()` merges Frontera demo call into API result if no same ID/account exists. | Real call list can contain hardcoded demo data. |
| Demo brief/post-review fallback | `apps/web/src/lib/dc-data/resolvers.ts:71-87` | Frontera demo brief/review returned locally when no imported/backend data exists. | Demo detail pages can look fully populated without backend brief/review. |
| Demo transcript playback | `apps/web/src/components/live/demo-transcript-player.tsx:21-44`; `apps/web/src/lib/demo-live-transcript.ts:20-23` | Scripted transcript lines. | Live cockpit can run without Recall. Hidden in production unless `NEXT_PUBLIC_ENABLE_DEMO_TRANSCRIPT=true`. |
| Legacy transcript | `apps/web/src/lib/demo-live-transcript.ts:23` | Deprecated Meridian transcript remains in code. | Not the default path, but still static data. |
| Add Pre-DC lead form | `apps/web/src/components/settings/add-pre-dc-lead-dialog.tsx:33`, `:144`, `:184`; `apps/web/src/lib/dc-notes/create-pre-dc-record.ts:50` | Form opens with editable sample Frontera research. | A new user can save sample data as if it were a real lead. |
| Settings team members | `apps/web/src/app/(dashboard)/settings/page.tsx:22` | Hardcoded Sarah/Tariq/Priya team table. | Team management is not backend-backed; Invite button has no persistence path. |
| Governance rollout | `apps/web/src/app/(dashboard)/governance/page.tsx:11` | Hardcoded rollout stages; cost/compliance/observability mostly empty/static cards. | Governance status is not driven by backend policy state except audit tab. |
| Content gap detail | `apps/web/src/app/(dashboard)/content/[gapId]/page.tsx:14` and `:24` | Static evidence chain and local draft text. | If content gaps exist later, detail evidence/editor text is still not backend-backed. |
| AE coaching banner | `apps/web/src/components/dashboard/leadership-dashboard.tsx:65` | Hardcoded "Marcus tomorrow" coaching copy. | Dashboard copy may not match real data. |
| UI catalogs/options | `apps/web/src/lib/agents/catalog.ts`, `apps/web/src/lib/kb/asset-types.ts`, widget registries | Static labels, defaults, widget metadata. | These are configuration/static UI metadata, not business data mocks. |

## BFF routes that return placeholders

These routes do not call FastAPI today:

| BFF route | File | Current behavior | Backend route present? |
|---|---|---|---|
| `/api/coaching/candidates` | `apps/web/src/app/api/coaching/candidates/route.ts:7` | Returns `[]`. | No matching FastAPI route found. |
| `/api/coaching/insights` | `apps/web/src/app/api/coaching/insights/route.ts:8` | Returns `[]`; comment says until backend exists. | No matching FastAPI route found. |
| `/api/coaching/quarterly-patterns` | `apps/web/src/app/api/coaching/quarterly-patterns/route.ts:7` | Returns `[]`. | No matching FastAPI route found. |
| `/api/content/gaps` | `apps/web/src/app/api/content/gaps/route.ts:7` | Returns `[]`. | No matching FastAPI route found. |
| `/api/kb/watchlist` | `apps/web/src/app/api/kb/watchlist/route.ts:7` | Returns `[]`. | No matching FastAPI route found. |

Frontend hooks using these placeholder routes:

- `useCoachingCandidates()` in `apps/web/src/lib/data/hooks.ts:172`
- `useCoachingInsights()` in `apps/web/src/lib/data/hooks.ts:183`
- `useQuarterlyPatterns()` in `apps/web/src/lib/data/hooks.ts:233`
- `useContentGaps()` in `apps/web/src/lib/data/hooks.ts:244`
- `useKbWatchlist()` in `apps/web/src/lib/data/hooks.ts:222`

## Data generated but not going anywhere useful yet

| Flow | Where data is produced | Where it stops | Impact |
|---|---|---|---|
| Post-call CRM tasks | Backend `dispatch_post_call()` returns a `task` envelope from `draft_post_call_artifacts()` (`services/api/app/orchestrator/dispatcher.py:119-136`; `services/api/app/agents/task_agent.py:9`) | `useRunPostCallPipeline()` only stores discovery gaps/coverage in Zustand (`apps/web/src/lib/data/hooks.ts:142-160`); `usePostCallCrmTasks()` always returns `[]` (`apps/web/src/lib/data/hooks.ts:164-168`) | Dashboard AI todos and CRM task list never show backend-generated tasks. |
| Post-call coaching output | Backend returns `coaching` envelope in the same post-call response (`services/api/app/orchestrator/dispatcher.py:129-136`) | Frontend does not map it into `CoachingInsight` or a review artifact. | Coaching pages stay empty unless future API exists. |
| Post-call review artifact | Backend post-call route returns transient data but does not save a full `PostCallReview` entity; frontend builds review from imported post-DC rows, demo review, or a minimal discovery snapshot. | No durable `/post-call-review` fetch path. | After a real live call, Post-DC can be thin even though backend generated task/coaching envelopes. |
| Google OAuth tokens | Callback exchanges `code` for tokens in `apps/web/src/app/api/integrations/google/callback/route.ts:42-46` | Backend token persistence is commented out at `:48-63`; connection route always returns `isConnected: false` at `apps/web/src/app/api/integrations/google/connection/route.ts:14`. | User can complete OAuth redirect, but app still behaves disconnected. |
| Google calendar events | Helpers exist in `apps/web/src/lib/google-calendar.ts`, but `/api/integrations/google/events` returns `calls: []` at `apps/web/src/app/api/integrations/google/events/route.ts:22`. | No stored token retrieval or Google API call. | Unified agenda never receives Google events. |
| Google calendar selection | PATCH `/api/integrations/google/calendars` echoes selected IDs (`apps/web/src/app/api/integrations/google/calendars/route.ts:31`). | Nothing is persisted. | Selection is lost immediately after request/cache refresh. |
| CRM task approval | `CrmTaskList` waits locally and calls optional callbacks (`apps/web/src/components/post-dc/crm-task-list.tsx:44-90`). | No backend mutation exists. | "Create CRM task" is UI-only unless parent supplies a real callback later. |
| Content gap draft edits | Content gap detail keeps notes in React state (`apps/web/src/app/(dashboard)/content/[gapId]/page.tsx:24`). | No save/submit route. | Editor changes disappear on navigation/refresh. |

## Backend storage and fallback behavior

The backend prefers Supabase when configured and otherwise uses an in-process `MemoryStore`.

Important tables/storage paths:

- Calls: `calls` and `call_briefs` via `CallsService`.
- DC notes: `pre_dc_records`, `post_dc_records`; notes are also embedded into `kb_chunks` with `metadata.source = "dc_note"`.
- KB: `kb_assets`, `kb_chunks`, `kb_ingest_jobs`, Supabase storage bucket.
- Content Studio: `content_templates`, `content_studio_projects`, `content_studio_messages`, `content_studio_revisions`, `content_exports`.
- Agents: `agent_configs`, `agent_runs`; audit currently reads backend memory store.
- Live call: `call_live_sessions`, `call_transcript_events`, `live_call_suggestions`.

Memory fallback is backend-local, not frontend mock data, but it is volatile: data is lost when the API process restarts.

## Silent fallback risks

- `bffFetch()` returns `null` for any non-OK response (`apps/web/src/lib/api/bff-fetch.ts:2-4`). Many hooks then return local data or `[]`, which can hide backend outages.
- `useCalls()` falls back to local DC-import-derived calls when `/api/calls` fails or returns empty (`apps/web/src/lib/data/hooks.ts:33-36`).
- Agent run/audit BFF routes return `[]` on upstream errors (`apps/web/src/app/api/agents/runs/route.ts:18`; `apps/web/src/app/api/agents/audit/route.ts:18`).
- `README.md:215-216` documents `USE_MOCK_DATA=true` and `NEXT_PUBLIC_USE_API_DATA=true`, but the only code reference is an unused helper in `apps/web/src/lib/use-api-data.ts:2-3`; no active switch controls the current data path.
- `apps/web/src/lib/api-client.ts` claims all server-side backend fetches go through it, but no imports of this module were found in `apps/web/src`.

## Recommended cleanup/order of work

1. Put Frontera demo injection behind an explicit demo flag, or keep it only on a dedicated demo route.
2. Replace placeholder BFF routes with real FastAPI endpoints, or show explicit "not connected" states instead of silent empty data.
3. Add a persisted post-call artifact model/endpoint and map backend `task` and `coaching` envelopes into Post-DC review, CRM tasks, and coaching insights.
4. Complete Google Calendar backend integration: nonce storage, encrypted token storage, connection status, calendar list, event mapping, selected calendar persistence, sync, and disconnect.
5. Remove or revive stale data flags (`USE_MOCK_DATA`, `NEXT_PUBLIC_USE_API_DATA`) and the unused `api-client.ts` path so docs match runtime behavior.
6. In production-facing hooks, distinguish "empty data" from "backend failed" so real integration failures are visible during QA.
