from __future__ import annotations

from typing import Any, Dict, List

from dc_core.tenancy import TenantContext

from app.domain.live_call_repository import LiveCallRepository
from app.domain.memory_store import get_memory_store


class _FakeResult:
    def __init__(self, data: List[Dict[str, Any]] | None = None) -> None:
        self.data = data or []


class _FakeQuery:
    def __init__(self, supabase: "_FakeSupabase", table_name: str) -> None:
        self.supabase = supabase
        self.table_name = table_name
        self.operation = "select"
        self.payload: Any = None
        self.filters: List[tuple[str, Any]] = []

    def select(self, *_args: Any, **_kwargs: Any) -> "_FakeQuery":
        self.operation = "select"
        return self

    def upsert(self, payload: Any, **_kwargs: Any) -> "_FakeQuery":
        self.operation = "upsert"
        self.payload = payload
        return self

    def insert(self, payload: Any, **_kwargs: Any) -> "_FakeQuery":
        self.operation = "insert"
        self.payload = payload
        return self

    def update(self, payload: Any, **_kwargs: Any) -> "_FakeQuery":
        self.operation = "update"
        self.payload = payload
        return self

    def eq(self, column: str, value: Any) -> "_FakeQuery":
        self.filters.append((column, value))
        return self

    def limit(self, *_args: Any, **_kwargs: Any) -> "_FakeQuery":
        return self

    def order(self, *_args: Any, **_kwargs: Any) -> "_FakeQuery":
        return self

    def execute(self) -> _FakeResult:
        self.supabase.calls.append(
            {
                "table": self.table_name,
                "operation": self.operation,
                "payload": self.payload,
                "filters": self.filters,
            }
        )
        return _FakeResult(self.supabase.select_rows.get(self.table_name, []))


class _FakeSupabase:
    def __init__(self) -> None:
        self.calls: List[Dict[str, Any]] = []
        self.select_rows: Dict[str, List[Dict[str, Any]]] = {}

    def table(self, table_name: str) -> _FakeQuery:
        return _FakeQuery(self, table_name)


class _SupabaseEnabledSettings:
    supabase_configured = True


def test_live_call_repository_writes_supabase_rows_against_call(monkeypatch):
    from app.domain import live_call_repository as repo_module

    fake_supabase = _FakeSupabase()
    tenant_uuid = "00000000-0000-0000-0000-000000000123"
    clerk_key = "clerk-live-supabase-test"
    call_id = "call-live-supabase"
    ctx = TenantContext(tenant_id="org-live", user_id="u1", clerk_org_id="org-live")

    store = get_memory_store()
    store.live_sessions.pop(clerk_key, None)
    store.transcript_events.pop(clerk_key, None)
    store.live_suggestions.pop(clerk_key, None)

    monkeypatch.setattr(repo_module, "get_settings", lambda: _SupabaseEnabledSettings())
    monkeypatch.setattr(repo_module, "get_supabase", lambda: fake_supabase)
    monkeypatch.setattr(repo_module, "resolve_kb_tenant", lambda _ctx: (tenant_uuid, clerk_key))

    repo = LiveCallRepository()
    repo.get_or_create_session(ctx, call_id, provider="recall", provider_meeting_id="bot-1")
    repo.append_transcript_event(
        ctx,
        call_id,
        {
            "id": "segment-1",
            "speaker_id": "buyer-1",
            "speaker_name": "Sam Buyer",
            "speaker_role": "customer",
            "text": "Our budget owner needs the Q3 proposal.",
            "offset_seconds": 31,
            "sentiment": "neutral",
            "signal_type": "budget_signal",
            "provider": "recall",
            "provider_event_id": "recall-event-1",
        },
    )
    repo.append_suggestion(
        ctx,
        call_id,
        operation="proactive_nudge",
        payload={"nudge": {"role": "ae", "message": "Confirm budget owner."}},
        target_role="ae",
        transcript_offset_seconds=31,
        confidence=0.82,
        trace_id="trace-1",
        suggestion_id="suggestion-1",
    )

    session_write = next(
        call for call in fake_supabase.calls if call["table"] == "call_live_sessions" and call["operation"] == "upsert"
    )
    transcript_write = next(
        call
        for call in fake_supabase.calls
        if call["table"] == "call_transcript_events" and call["operation"] == "insert"
    )
    suggestion_write = next(
        call
        for call in fake_supabase.calls
        if call["table"] == "live_call_suggestions" and call["operation"] == "insert"
    )

    for write in (session_write, transcript_write, suggestion_write):
        assert write["payload"]["tenant_id"] == tenant_uuid
        assert write["payload"]["call_id"] == call_id

    assert session_write["payload"]["provider_meeting_id"] == "bot-1"
    assert transcript_write["payload"]["text"] == "Our budget owner needs the Q3 proposal."
    assert transcript_write["payload"]["speaker_name"] == "Sam Buyer"
    assert transcript_write["payload"]["sentiment"] == "neutral"
    assert transcript_write["payload"]["signal_type"] == "budget_signal"
    assert transcript_write["payload"]["provider_event_id"] == "recall-event-1"
    assert suggestion_write["payload"]["operation"] == "proactive_nudge"
    assert suggestion_write["payload"]["target_role"] == "ae"

    repo.update_transcript_event_analysis(
        ctx,
        call_id,
        "segment-1",
        keywords=["budget", "proposal"],
        sentiment="negative",
        signal_type="objection_raised",
    )
    transcript_update = next(
        call
        for call in fake_supabase.calls
        if call["table"] == "call_transcript_events" and call["operation"] == "update"
    )
    assert transcript_update["payload"]["sentiment"] == "negative"
    assert transcript_update["payload"]["signal_type"] == "objection_raised"


def test_list_transcript_events_merges_supabase_rows_with_memory(monkeypatch):
    from app.domain import live_call_repository as repo_module

    fake_supabase = _FakeSupabase()
    tenant_uuid = "00000000-0000-0000-0000-000000000789"
    clerk_key = "clerk-live-merge-test"
    call_id = "call-live-merge"
    ctx = TenantContext(tenant_id="org-live", user_id="u1", clerk_org_id="org-live")

    store = get_memory_store()
    store.transcript_events.pop(clerk_key, None)

    fake_supabase.select_rows["call_transcript_events"] = [
        {
            "id": "segment-need",
            "call_id": call_id,
            "speaker_id": "prospect",
            "speaker_name": "prospect",
            "speaker_role": "ae",
            "text": "we need a custom ERP for onboarding automation",
            "offset_seconds": 49,
            "provider": "demo",
            "provider_event_id": "event-need",
            "created_at": "2026-06-06T18:23:07+00:00",
        },
        {
            "id": "segment-authority",
            "call_id": call_id,
            "speaker_id": "prospect",
            "speaker_name": "prospect",
            "speaker_role": "ae",
            "text": "the CFO owns approval and can approve it",
            "offset_seconds": 66,
            "provider": "demo",
            "provider_event_id": "event-authority",
            "created_at": "2026-06-06T18:23:50+00:00",
        },
        {
            "id": "segment-next-step",
            "call_id": call_id,
            "speaker_id": "prospect",
            "speaker_name": "prospect",
            "speaker_role": "ae",
            "text": "please send the implementation proposal and schedule the review next week",
            "offset_seconds": 74,
            "provider": "demo",
            "provider_event_id": "event-next-step",
            "created_at": "2026-06-06T18:24:09+00:00",
        },
    ]
    store.transcript_events[clerk_key] = {
        call_id: [
            {
                "id": "segment-need-local",
                "call_id": call_id,
                "speaker_id": "prospect",
                "speaker_name": "prospect",
                "speaker_role": "ae",
                "text": "we need a custom ERP for onboarding automation",
                "offset_seconds": 49,
                "provider": "demo",
                "provider_event_id": "event-need",
                "created_at": "2026-06-06T18:23:07+00:00",
            },
            {
                "id": "segment-engagement",
                "call_id": call_id,
                "speaker_id": "prospect",
                "speaker_name": "prospect",
                "speaker_role": "ae",
                "text": "we want a fixed cost software engineering engagement",
                "offset_seconds": 70,
                "keywords": ["fixed", "software", "engineering"],
                "provider": "demo",
                "provider_event_id": "event-engagement",
                "created_at": "2026-06-06T18:24:00+00:00",
            },
        ],
    }

    monkeypatch.setattr(repo_module, "get_settings", lambda: _SupabaseEnabledSettings())
    monkeypatch.setattr(repo_module, "get_supabase", lambda: fake_supabase)
    monkeypatch.setattr(repo_module, "resolve_kb_tenant", lambda _ctx: (tenant_uuid, clerk_key))

    events = LiveCallRepository().list_transcript_events(ctx, call_id, limit=20)
    event_text = " ".join(event["text"] for event in events)

    assert len(events) == 4
    assert event_text.count("we need a custom ERP") == 1
    assert "fixed cost software engineering engagement" in event_text


def test_link_provider_meeting_updates_existing_session_without_recursion(monkeypatch):
    from app.domain import live_call_repository as repo_module

    fake_supabase = _FakeSupabase()
    tenant_uuid = "00000000-0000-0000-0000-000000000456"
    clerk_key = "clerk-live-link-test"
    call_id = "call-live-link"
    ctx = TenantContext(tenant_id="org-live", user_id="u1", clerk_org_id="org-live")

    store = get_memory_store()
    store.live_sessions[clerk_key] = {
        call_id: {
            "call_id": call_id,
            "status": "live",
            "provider": "recall",
            "provider_meeting_id": None,
            "summary": {},
        }
    }

    monkeypatch.setattr(repo_module, "get_settings", lambda: _SupabaseEnabledSettings())
    monkeypatch.setattr(repo_module, "get_supabase", lambda: fake_supabase)
    monkeypatch.setattr(repo_module, "resolve_kb_tenant", lambda _ctx: (tenant_uuid, clerk_key))

    linked = LiveCallRepository().link_provider_meeting(
        ctx, call_id, "bot-linked", provider="recall"
    )

    assert linked["provider_meeting_id"] == "bot-linked"
    assert store.live_sessions[clerk_key][call_id]["provider_meeting_id"] == "bot-linked"
    session_write = next(
        call for call in fake_supabase.calls if call["table"] == "call_live_sessions" and call["operation"] == "upsert"
    )
    assert session_write["payload"]["provider_meeting_id"] == "bot-linked"


def test_live_call_repository_falls_back_to_memory_when_tenant_resolution_fails(monkeypatch):
    from app.domain import live_call_repository as repo_module

    fake_supabase = _FakeSupabase()
    call_id = "call-live-fallback"
    ctx = TenantContext(tenant_id="local-dev-user", user_id="local-dev-user", clerk_org_id=None)
    fallback_key = "local-dev-user"

    store = get_memory_store()
    store.live_sessions.pop(fallback_key, None)
    store.transcript_events.pop(fallback_key, None)

    def _raise_resolution_error(_ctx: TenantContext):
        raise RuntimeError("tenant service unavailable")

    monkeypatch.setattr(repo_module, "get_settings", lambda: _SupabaseEnabledSettings())
    monkeypatch.setattr(repo_module, "get_supabase", lambda: fake_supabase)
    monkeypatch.setattr(repo_module, "resolve_kb_tenant", _raise_resolution_error)

    repo = LiveCallRepository()
    session = repo.get_or_create_session(ctx, call_id)
    assert session["status"] is None
    event = repo.append_transcript_event(
        ctx,
        call_id,
        {
            "id": "segment-fallback",
            "speaker_id": "buyer",
            "speaker_role": "customer",
            "text": "The CFO and board need to approve budget before Q3 pilot kickoff.",
            "offset_seconds": 45,
            "provider_event_id": "fallback-event-1",
        },
    )

    assert session["call_id"] == call_id
    assert event["id"] == "segment-fallback"
    assert store.live_sessions[fallback_key][call_id]["status"] == "live"
    assert store.transcript_events[fallback_key][call_id][0]["text"].startswith("The CFO")
    assert fake_supabase.calls == []


def test_live_call_session_defaults_to_null_until_provider_or_transcript(monkeypatch):
    from app.domain import live_call_repository as repo_module

    fake_supabase = _FakeSupabase()
    tenant_uuid = "00000000-0000-0000-0000-000000000654"
    clerk_key = "clerk-live-null-default-test"
    call_id = "call-live-null-default"
    ctx = TenantContext(tenant_id="org-live", user_id="u1", clerk_org_id="org-live")

    store = get_memory_store()
    store.live_sessions.pop(clerk_key, None)
    store.transcript_events.pop(clerk_key, None)

    monkeypatch.setattr(repo_module, "get_settings", lambda: _SupabaseEnabledSettings())
    monkeypatch.setattr(repo_module, "get_supabase", lambda: fake_supabase)
    monkeypatch.setattr(repo_module, "resolve_kb_tenant", lambda _ctx: (tenant_uuid, clerk_key))

    repo = LiveCallRepository()
    session = repo.get_or_create_session(ctx, call_id)

    assert session["status"] is None
    assert store.live_sessions[clerk_key][call_id]["status"] is None
    session_write = next(
        call for call in fake_supabase.calls if call["table"] == "call_live_sessions" and call["operation"] == "upsert"
    )
    assert session_write["payload"]["status"] is None

    linked = repo.link_provider_meeting(ctx, call_id, "bot-linked")

    assert linked["status"] == "live"
    assert store.live_sessions[clerk_key][call_id]["status"] == "live"
