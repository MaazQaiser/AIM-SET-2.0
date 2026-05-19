from __future__ import annotations

from typing import Any, Dict, List


class MemoryStore:
    """In-process fallback for KB uploads and agent audit when Supabase is unavailable."""

    def __init__(self) -> None:
        self.kb_assets: Dict[str, List[Dict[str, Any]]] = {}
        self.kb_chunks: Dict[str, List[Dict[str, Any]]] = {}
        self.kb_ingest_jobs: Dict[str, List[Dict[str, Any]]] = {}
        self.kb_files: Dict[str, Dict[str, bytes]] = {}
        self.tenant_uuid_map: Dict[str, str] = {}
        self.agent_runs: Dict[str, List[Dict[str, Any]]] = {}
        self.audit: Dict[str, List[Dict[str, Any]]] = {}

    def list_kb_assets(self, tenant_id: str) -> List[Dict[str, Any]]:
        return self.kb_assets.get(tenant_id, [])

    def add_agent_run(self, tenant_id: str, run: Dict[str, Any]) -> None:
        self.agent_runs.setdefault(tenant_id, []).append(run)

    def add_audit(self, tenant_id: str, event: Dict[str, Any]) -> None:
        self.audit.setdefault(tenant_id, []).append(event)


_memory = MemoryStore()


def get_memory_store() -> MemoryStore:
    return _memory

