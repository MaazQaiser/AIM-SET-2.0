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


_memory = MemoryStore()


def get_memory_store() -> MemoryStore:
    return _memory
