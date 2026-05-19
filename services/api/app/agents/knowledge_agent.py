from __future__ import annotations

import uuid
from typing import Any, Dict

from dc_core.evidence import AgentEnvelope, Citation

from app.domain.memory_store import get_memory_store


def ingest_asset_metadata(tenant_id: str, asset: Dict[str, Any]) -> AgentEnvelope:
    store = get_memory_store()
    assets = store.kb_assets.setdefault(tenant_id, [])
    assets.append(asset)
    store.kb_chunks.setdefault(tenant_id, []).append(
        {
            "tenant_id": tenant_id,
            "asset_id": asset.get("id", "unknown"),
            "chunk_text": asset.get("title", ""),
            "metadata": asset,
        }
    )
    return AgentEnvelope(
        agent="knowledge",
        operation="asset_ingested",
        result={"asset_id": asset.get("id"), "chunks": 1},
        citations=[
            Citation(source_type="kb_document", source_id=str(asset.get("id")), snippet=asset.get("title", ""))
        ],
        confidence=1.0,
        trace_id=str(uuid.uuid4()),
    )
