from __future__ import annotations

from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from dc_core.tenancy import TenantContext

from app.config import get_settings
from app.domain.kb_repository import get_kb_repository
from app.domain.kb_tenancy import resolve_kb_tenant
from app.domain.memory_store import get_memory_store
from dc_tools.retrieve_kb import default_embed_fn, retrieve_kb

DOCUMENT_EXTENSIONS = {".pdf", ".ppt", ".pptx"}


def _normalize_score(raw: Any) -> float:
    try:
        score = float(raw)
    except (TypeError, ValueError):
        return 0.0
    if score > 1.0:
        return min(1.0, score / max(score, 1.0))
    return max(0.0, min(1.0, score))


def _kb_search(
    ctx: TenantContext,
    query: str,
    limit: int = 15,
) -> List[Dict[str, Any]]:
    settings = get_settings()
    repo = get_kb_repository()
    tenant_uuid, clerk_key = resolve_kb_tenant(ctx)
    memory_key = clerk_key

    def vector_search(tid: str, embedding: List[float], lim: int) -> List[Dict[str, Any]]:
        return repo.match_chunks(tenant_uuid, embedding, limit=lim, clerk_key=memory_key)

    embed_fn = default_embed_fn if settings.openai_configured or settings.openai_api_key else None
    return retrieve_kb(
        tenant_uuid,
        query,
        limit=limit,
        chunks=get_memory_store().kb_chunks.get(memory_key, []),
        embed_fn=embed_fn,
        vector_search_fn=vector_search if embed_fn else None,
    )


def _source_label(metadata: Dict[str, Any], asset_id: str) -> str:
    if asset_id.startswith("dc:"):
        return "dc_notes"
    kind = (metadata.get("kind") or metadata.get("source") or "").lower()
    if kind in ("dc_note", "pre-dc", "post-dc"):
        return "dc_notes"
    if metadata.get("source") == "project" or metadata.get("project_id"):
        return "project_database"
    return "knowledge_base"


def _title_for_hit(
    asset_row: Optional[Dict[str, Any]],
    asset_id: str,
    metadata: Dict[str, Any],
    chunk_text: str,
) -> str:
    if asset_row and asset_row.get("title"):
        return str(asset_row["title"])
    if metadata.get("company"):
        return str(metadata["company"])
    if metadata.get("title"):
        return str(metadata["title"])
    first_line = (chunk_text or "").strip().split("\n", 1)[0]
    if first_line.startswith("["):
        return first_line.strip("[]")
    return asset_id.replace("dc:", "").replace(":", " ").strip() or "Relevant content"


def build_relevant_content(
    ctx: TenantContext,
    account_name: str,
    research: Dict[str, str],
    *,
    limit: int = 15,
) -> Dict[str, List[Dict[str, Any]]]:
    """Group KB hits into file documents (PDF/PPT) and textual relevant projects."""
    query = " ".join(
        filter(
            None,
            [
                account_name,
                research.get("needs", ""),
                research.get("industry", ""),
                research.get("intersection", ""),
                research.get("campaign_service", ""),
                research.get("company_description", "")[:200],
            ],
        )
    ).strip()
    if not query:
        return {"relevantDocuments": [], "relevantProjects": []}

    hits = _kb_search(ctx, query, limit=limit)
    if not hits:
        return {"relevantDocuments": [], "relevantProjects": []}

    repo = get_kb_repository()
    tenant_uuid, clerk_key = resolve_kb_tenant(ctx)

    by_asset: Dict[str, Dict[str, Any]] = {}
    for hit in hits:
        asset_id = str(hit.get("asset_id") or "")
        if not asset_id:
            continue
        score = _normalize_score(hit.get("score", 0))
        existing = by_asset.get(asset_id)
        if existing is None or score > existing["best_score"]:
            existing = {
                "asset_id": asset_id,
                "best_score": score,
                "snippets": [],
                "metadata": hit.get("metadata") or {},
            }
            by_asset[asset_id] = existing
        snippet = (hit.get("chunk_text") or "").strip()
        if snippet and snippet not in existing["snippets"]:
            existing["snippets"].append(snippet[:600])

    documents: List[Dict[str, Any]] = []
    projects: List[Dict[str, Any]] = []

    for asset_id, bucket in by_asset.items():
        asset_row = repo.get_asset_row(tenant_uuid, asset_id, clerk_key)
        file_name = (asset_row or {}).get("file_name") or ""
        ext = Path(file_name).suffix.lower() if file_name else ""
        mime = (asset_row or {}).get("mime_type") or ""
        meta = bucket["metadata"]
        snippets = bucket["snippets"]
        combined = "\n\n".join(snippets)
        score = bucket["best_score"]
        title = _title_for_hit(asset_row, asset_id, meta, combined)

        is_document = ext in DOCUMENT_EXTENSIONS or "pdf" in mime or "presentation" in mime

        if is_document and asset_row and asset_row.get("storage_path"):
            fmt = ext.lstrip(".") or ("pdf" if "pdf" in mime else "pptx")
            documents.append(
                {
                    "assetId": asset_id,
                    "title": title,
                    "fileName": file_name or None,
                    "mimeType": mime or None,
                    "format": fmt if fmt in ("pdf", "ppt", "pptx") else "pdf",
                    "relevanceScore": score,
                    "snippet": snippets[0][:280] if snippets else None,
                    "previewText": combined[:6000] if combined else None,
                }
            )
            continue

        source = _source_label(meta, asset_id)
        projects.append(
            {
                "id": f"proj-{asset_id}",
                "title": title,
                "source": source,
                "relevanceScore": score,
                "summary": snippets[0][:220] if snippets else "",
                "details": combined[:4000] if combined else title,
                "assetId": asset_id if not asset_id.startswith("dc:") else None,
            }
        )

    max_score = max((b["best_score"] for b in by_asset.values()), default=1.0) or 1.0
    for item in documents:
        item["relevanceScore"] = round(item["relevanceScore"] / max_score, 3)
    for item in projects:
        item["relevanceScore"] = round(item["relevanceScore"] / max_score, 3)

    documents.sort(key=lambda d: d["relevanceScore"], reverse=True)
    projects.sort(key=lambda p: p["relevanceScore"], reverse=True)
    return {"relevantDocuments": documents[:8], "relevantProjects": projects[:12]}
