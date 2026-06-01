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
            "speaker_role": "customer",
            "text": "Our budget owner needs the Q3 proposal.",
            "offset_seconds": 31,
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
    assert transcript_write["payload"]["provider_event_id"] == "recall-event-1"
    assert suggestion_write["payload"]["operation"] == "proactive_nudge"
    assert suggestion_write["payload"]["target_role"] == "ae"
