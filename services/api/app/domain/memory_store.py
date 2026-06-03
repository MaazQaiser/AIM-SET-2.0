from __future__ import annotations

from typing import Any, Dict, List


class MemoryStore:
    """In-process fallback when Supabase is unavailable."""

    def __init__(self) -> None:
        self.kb_assets: Dict[str, List[Dict[str, Any]]] = {}
        self.kb_chunks: Dict[str, List[Dict[str, Any]]] = {}
        self.kb_ingest_jobs: Dict[str, List[Dict[str, Any]]] = {}
        self.kb_files: Dict[str, Dict[str, bytes]] = {}
        self.tenant_uuid_map: Dict[str, str] = {}
        self.agent_runs: Dict[str, List[Dict[str, Any]]] = {}
        self.agent_configs: Dict[str, Dict[str, Dict[str, Any]]] = {}
        self.audit: Dict[str, List[Dict[str, Any]]] = {}
        self.pre_dc_records: Dict[str, List[Dict[str, Any]]] = {}
        self.post_dc_records: Dict[str, List[Dict[str, Any]]] = {}
        self.calls: Dict[str, List[Dict[str, Any]]] = {}
        self.content_templates: Dict[str, List[Dict[str, Any]]] = {}
        self.content_template_html: Dict[str, str] = {}
        self.content_template_files: Dict[str, bytes] = {}
        self.content_projects: Dict[str, List[Dict[str, Any]]] = {}
        self.content_messages: Dict[str, List[Dict[str, Any]]] = {}
        self.content_revisions: Dict[str, List[Dict[str, Any]]] = {}
        self.content_exports: Dict[str, bytes] = {}
        self.call_briefs: Dict[str, Dict[str, Dict[str, Any]]] = {}
        self.call_post_reviews: Dict[str, Dict[str, Dict[str, Any]]] = {}
        self.call_live_signals: Dict[str, Dict[str, Dict[str, Any]]] = {}
        self.live_sessions: Dict[str, Dict[str, Dict[str, Any]]] = {}
        self.transcript_events: Dict[str, Dict[str, List[Dict[str, Any]]]] = {}
        self.live_suggestions: Dict[str, Dict[str, List[Dict[str, Any]]]] = {}
        self.discovery_checklists: Dict[str, Dict[str, Any]] = {}
        self.landing_pages: Dict[str, Dict[str, Dict[str, Any]]] = {}
        self.clp_proposals: Dict[str, Dict[str, Dict[str, Any]]] = {}
        self.clp_visitors: Dict[str, List[Dict[str, Any]]] = {}
        self.clp_sessions: Dict[str, List[Dict[str, Any]]] = {}
        self.clp_events: Dict[str, List[Dict[str, Any]]] = {}
        self.clp_notifications: Dict[str, List[Dict[str, Any]]] = {}
        self.clp_comments: Dict[str, List[Dict[str, Any]]] = {}
        self.clp_chat: Dict[str, List[Dict[str, Any]]] = {}
        self.clp_public_sessions: Dict[str, Dict[str, Any]] = {}

    def list_kb_assets(self, tenant_id: str) -> List[Dict[str, Any]]:
        return self.kb_assets.get(tenant_id, [])

    def list_pre_dc_records(self, tenant_key: str) -> List[Dict[str, Any]]:
        return list(self.pre_dc_records.get(tenant_key, []))

    def list_post_dc_records(self, tenant_key: str) -> List[Dict[str, Any]]:
        return list(self.post_dc_records.get(tenant_key, []))

    def upsert_pre_dc_records(self, tenant_key: str, rows: List[Dict[str, Any]]) -> None:
        existing = {r["id"]: r for r in self.pre_dc_records.get(tenant_key, [])}
        for row in rows:
            existing[row["id"]] = {
                "id": row["id"],
                "fields": row.get("fields") or {},
            }
        self.pre_dc_records[tenant_key] = list(existing.values())

    def upsert_post_dc_records(self, tenant_key: str, rows: List[Dict[str, Any]]) -> None:
        existing = {r["id"]: r for r in self.post_dc_records.get(tenant_key, [])}
        for row in rows:
            existing[row["id"]] = {
                "id": row["id"],
                "matched_call_id": row.get("matched_call_id"),
                "fields": row.get("fields") or {},
            }
        self.post_dc_records[tenant_key] = list(existing.values())

    def upsert_calls(self, tenant_key: str, calls: List[Dict[str, Any]]) -> None:
        existing = {c["id"]: c for c in self.calls.get(tenant_key, [])}
        for call in calls:
            existing[call["id"]] = call
        self.calls[tenant_key] = list(existing.values())

    def list_calls(self, tenant_key: str) -> List[Dict[str, Any]]:
        return list(self.calls.get(tenant_key, []))

    def add_agent_run(self, tenant_id: str, run: Dict[str, Any]) -> None:
        self.agent_runs.setdefault(tenant_id, []).append(run)

    def add_audit(self, tenant_id: str, event: Dict[str, Any]) -> None:
        self.audit.setdefault(tenant_id, []).append(event)

    def get_call_brief(self, tenant_key: str, call_id: str) -> Dict[str, Any] | None:
        return self.call_briefs.get(tenant_key, {}).get(call_id)

    def save_call_brief(self, tenant_key: str, call_id: str, payload: Dict[str, Any]) -> None:
        self.call_briefs.setdefault(tenant_key, {})[call_id] = payload

    def get_post_review(self, tenant_key: str, call_id: str) -> Dict[str, Any] | None:
        return self.call_post_reviews.get(tenant_key, {}).get(call_id)

    def save_post_review(self, tenant_key: str, call_id: str, payload: Dict[str, Any]) -> None:
        self.call_post_reviews.setdefault(tenant_key, {})[call_id] = payload

    def save_live_signals(self, tenant_key: str, call_id: str, snapshot: Dict[str, Any]) -> None:
        self.call_live_signals.setdefault(tenant_key, {})[call_id] = snapshot

    def get_live_signals(self, tenant_key: str, call_id: str) -> Dict[str, Any] | None:
        return self.call_live_signals.get(tenant_key, {}).get(call_id)

    def get_discovery_checklist(self, tenant_id: str, call_id: str) -> Dict[str, Any] | None:
        return self.discovery_checklists.get(f"{tenant_id}:{call_id}")

    def set_discovery_checklist(self, tenant_id: str, call_id: str, payload: Dict[str, Any]) -> None:
        self.discovery_checklists[f"{tenant_id}:{call_id}"] = payload

    def pop_discovery_checklist(self, tenant_id: str, call_id: str) -> Dict[str, Any] | None:
        return self.discovery_checklists.pop(f"{tenant_id}:{call_id}", None)


_memory = MemoryStore()


def get_memory_store() -> MemoryStore:
    return _memory
