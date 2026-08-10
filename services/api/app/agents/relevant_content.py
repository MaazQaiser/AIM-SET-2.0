from __future__ import annotations

import re
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from dc_core.tenancy import TenantContext

from app.config import get_settings
from app.domain.kb_project_repository import list_kb_projects
from app.domain.kb_repository import get_kb_repository
from app.domain.kb_tenancy import resolve_kb_tenant
from app.domain.memory_store import get_memory_store
from dc_tools.retrieve_kb import default_embed_fn, retrieve_kb

DOCUMENT_EXTENSIONS = {".pdf", ".ppt", ".pptx"}
PRESENTATION_EXTENSIONS = {".pdf", ".ppt", ".pptx"}
PROJECT_ASSET_HINTS = ("project", "sale enablement")
# Generic business words that cause false "relevant" hits across the whole library.
STOP_WORDS = {
    "about",
    "after",
    "also",
    "and",
    "are",
    "based",
    "build",
    "business",
    "call",
    "company",
    "custom",
    "for",
    "from",
    "group",
    "have",
    "help",
    "into",
    "looking",
    "management",
    "need",
    "needs",
    "next",
    "our",
    "plus",
    "process",
    "processes",
    "service",
    "services",
    "solution",
    "solutions",
    "system",
    "systems",
    "team",
    "teams",
    "that",
    "the",
    "their",
    "they",
    "this",
    "using",
    "want",
    "with",
    "workflow",
    "workflows",
}

# Absolute raw lexical score required (one short token ≈ 1.0; one long ≈ 2.5).
MIN_RAW_SCORE = 3.0
# After relative normalization, drop weak tails so one best hit doesn't keep junk at 0.1.
MIN_NORMALIZED_SCORE = 0.35


def _normalize_score(raw: Any) -> float:
    try:
        score = float(raw)
    except (TypeError, ValueError):
        return 0.0
    if score > 1.0:
        # Embedding distances / oversized lexical totals — clamp, don't divide by self.
        return 1.0
    return max(0.0, min(1.0, score))


def is_library_kb_hit(hit: Dict[str, Any]) -> bool:
    """True for uploaded KB/library chunks; false for synthetic DC note embeddings."""
    asset_id = str(hit.get("asset_id") or "")
    if asset_id.startswith("dc:"):
        return False
    metadata = hit.get("metadata") or {}
    source = str(metadata.get("source") or "").lower()
    kind = str(metadata.get("kind") or "").lower()
    return source != "dc_note" and kind not in {"dc_note", "pre-dc", "post-dc"}


def filter_library_kb_hits(hits: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    return [hit for hit in hits if is_library_kb_hit(hit)]


def _library_memory_chunks(clerk_key: str) -> List[Dict[str, Any]]:
    return filter_library_kb_hits(get_memory_store().kb_chunks.get(clerk_key, []))


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
        raw = repo.match_chunks(
            tenant_uuid,
            embedding,
            limit=max(lim * 6, lim + 30),
            clerk_key=memory_key,
        )
        return filter_library_kb_hits(raw)[:lim]

    embed_fn = default_embed_fn if settings.openai_configured or settings.openai_api_key else None
    hits = retrieve_kb(
        tenant_uuid,
        query,
        limit=limit,
        chunks=_library_memory_chunks(memory_key),
        embed_fn=embed_fn,
        vector_search_fn=vector_search if embed_fn else None,
    )
    return filter_library_kb_hits(hits)


def _source_label(metadata: Dict[str, Any], asset_id: str) -> str:
    if asset_id.startswith("dc:"):
        return "dc_notes"
    kind = (metadata.get("kind") or metadata.get("source") or "").lower()
    if kind in ("dc_note", "pre-dc", "post-dc"):
        return "dc_notes"
    if metadata.get("source") == "project" or metadata.get("project_id"):
        return "project_database"
    return "knowledge_base"


def _search_text(value: Any) -> str:
    return re.sub(r"[^a-z0-9]+", " ", str(value or "").lower()).strip()


def _tokens(value: str) -> List[str]:
    return [
        token
        for token in _search_text(value).split()
        if len(token) > 2 and token not in STOP_WORDS
    ]


def _score_text(text: str, query: str) -> float:
    haystack = _search_text(text)
    if not haystack:
        return 0.0
    query_tokens = _tokens(query)
    score = 0.0
    matched = 0
    seen: set[str] = set()
    for token in query_tokens:
        if token in seen:
            continue
        seen.add(token)
        if token in haystack:
            matched += 1
            score += 2.5 if len(token) >= 7 else 1.0

    # Normalize common vertical aliases that otherwise miss exact filename/title hits.
    if {"health", "care"} <= set(query_tokens) and ("healthcare" in haystack or "health care" in haystack):
        score += 10.0
        matched += 1
    if "healthcare" in query_tokens and ("health care" in haystack or "hospital" in haystack):
        score += 8.0
        matched += 1
    if "pediatric" in query_tokens and any(term in haystack for term in ("pediatric", "patient", "clinical", "health")):
        score += 5.0
        matched += 1
    if "education" in query_tokens and any(term in haystack for term in ("edtech", "school", "learning", "education")):
        score += 8.0
        matched += 1
    if "security" in query_tokens and any(term in haystack for term in ("security", "guard", "soc")):
        score += 6.0
        matched += 1
    if "fintech" in query_tokens and any(term in haystack for term in ("fintech", "payment", "banking", "finance")):
        score += 6.0
        matched += 1

    # Require either multi-token overlap or a strong single vertical hit.
    if matched < 2 and score < 5.0:
        return 0.0
    return score


def _industry_tokens(industry: str) -> List[str]:
    return [token for token in _tokens(industry) if len(token) >= 4]


def _industry_matches(text: str, industry: str) -> bool:
    industry = (industry or "").strip()
    if not industry:
        return True
    haystack = _search_text(text)
    if not haystack:
        return False
    tokens = _industry_tokens(industry)
    if any(token in haystack for token in tokens):
        return True
    lower = industry.lower()
    alias_groups = (
        (("health", "hospital", "pediatric", "clinical", "care"), ("health", "hospital", "pediatric", "clinical", "care", "patient")),
        (("financ", "fintech", "bank", "payment"), ("financ", "fintech", "bank", "payment", "lending")),
        (("secur", "guard", "cyber"), ("secur", "guard", "cyber", "soc")),
        (("educat", "school", "edtech", "learning"), ("educat", "school", "edtech", "learning")),
        (("retail", "commerce", "ecommerce"), ("retail", "commerce", "ecommerce", "shop")),
    )
    for industry_keys, haystack_keys in alias_groups:
        if any(key in lower for key in industry_keys) and any(key in haystack for key in haystack_keys):
            return True
    return False


def _passes_relevance(
    *,
    text: str,
    raw_score: float,
    industry: str,
    min_raw: float = MIN_RAW_SCORE,
) -> bool:
    if raw_score < min_raw:
        return False
    if not industry.strip():
        return True
    # Known industry: require industry/vertical overlap OR a strong need match.
    if _industry_matches(text, industry):
        return True
    return raw_score >= 8.0


def _filter_by_normalized_score(items: List[Dict[str, Any]], *, min_score: float = MIN_NORMALIZED_SCORE) -> List[Dict[str, Any]]:
    return [item for item in items if float(item.get("relevanceScore") or 0) >= min_score]


def _asset_tags(asset: Dict[str, Any]) -> List[str]:
    tags = asset.get("tags") or []
    return [str(tag) for tag in tags if str(tag or "").strip()]


def _asset_search_blob(asset: Dict[str, Any]) -> str:
    return " ".join(
        str(part or "")
        for part in (
            asset.get("title"),
            asset.get("fileName") or asset.get("file_name"),
            asset.get("type") or asset.get("asset_type"),
            asset.get("mimeType") or asset.get("mime_type"),
            " ".join(_asset_tags(asset)),
            asset.get("metadata") or "",
        )
    )


def _is_presentation_asset(asset: Dict[str, Any]) -> bool:
    file_name = str(asset.get("fileName") or asset.get("file_name") or "")
    ext = Path(file_name).suffix.lower()
    mime = str(asset.get("mimeType") or asset.get("mime_type") or "").lower()
    asset_type = str(asset.get("type") or asset.get("asset_type") or "").lower()
    return (
        ext in PRESENTATION_EXTENSIONS
        or "presentation" in mime
        or "powerpoint" in mime
        or "pdf" in mime
        or asset_type in {"deck", "presentation", "pdf"}
    )


def _is_project_asset(asset: Dict[str, Any]) -> bool:
    file_name = str(asset.get("fileName") or asset.get("file_name") or "")
    if Path(file_name).suffix.lower() != ".csv":
        return False
    haystack = _asset_search_blob(asset).lower()
    return any(hint in haystack for hint in PROJECT_ASSET_HINTS)


def _document_from_asset(
    asset: Dict[str, Any],
    *,
    score: float,
    snippet: Optional[str] = None,
    preview_text: Optional[str] = None,
) -> Optional[Dict[str, Any]]:
    asset_id = str(asset.get("id") or "")
    if not asset_id:
        return None
    file_name = str(asset.get("fileName") or asset.get("file_name") or "")
    mime = str(asset.get("mimeType") or asset.get("mime_type") or "")
    ext = Path(file_name).suffix.lower()
    if ext not in DOCUMENT_EXTENSIONS and "pdf" not in mime.lower() and not _is_presentation_asset(asset):
        return None
    fmt = ext.lstrip(".") or ("pdf" if "pdf" in mime.lower() else "pptx")
    if fmt not in ("pdf", "ppt", "pptx"):
        fmt = "pptx" if _is_presentation_asset(asset) else "pdf"
    return {
        "assetId": asset_id,
        "title": str(asset.get("title") or file_name or "Knowledge asset"),
        "fileName": file_name or None,
        "mimeType": mime or None,
        "format": fmt,
        "relevanceScore": score,
        "snippet": (snippet or "").strip()[:280] or None,
        "previewText": (preview_text or snippet or "").strip()[:6000] or None,
    }


def _project_search_blob(project: Dict[str, Any]) -> str:
    fields = project.get("fields") or {}
    return " ".join(
        str(part or "")
        for part in (
            project.get("title"),
            project.get("projectName"),
            project.get("companyName"),
            project.get("summary"),
            project.get("industry"),
            project.get("sector"),
            project.get("domain"),
            project.get("subDomain"),
            project.get("problemStatement"),
            project.get("businessOutcome"),
            project.get("functionalSolution"),
            project.get("technicalSolution"),
            project.get("sourceAssetTitle"),
            project.get("sourceFileName"),
            " ".join(str(tag) for tag in project.get("tags") or []),
            " ".join(str(value) for value in fields.values()),
        )
    )


def _project_details(project: Dict[str, Any]) -> str:
    details = [
        project.get("problemStatement"),
        project.get("businessOutcome"),
        project.get("functionalSolution"),
        project.get("technicalSolution"),
        project.get("summary"),
    ]
    text = "\n\n".join(str(item).strip() for item in details if str(item or "").strip())
    return text or str(project.get("title") or "Project reference")


def _project_to_relevant(project: Dict[str, Any], score: float) -> Dict[str, Any]:
    title = str(project.get("projectName") or project.get("title") or "Project reference")
    return {
        "id": str(project.get("id") or f"project-{title.lower().replace(' ', '-')}"),
        "title": title,
        "source": "project_database",
        "relevanceScore": score,
        "summary": str(project.get("summary") or "")[:300],
        "details": _project_details(project)[:4000],
        "assetId": project.get("sourceAssetId"),
    }


def _merge_by_id(items: List[Dict[str, Any]], id_key: str) -> List[Dict[str, Any]]:
    merged: Dict[str, Dict[str, Any]] = {}
    for item in items:
        key = str(item.get(id_key) or item.get("id") or "")
        if not key:
            continue
        existing = merged.get(key)
        if existing is None or float(item.get("relevanceScore") or 0) > float(existing.get("relevanceScore") or 0):
            merged[key] = item
    return list(merged.values())


def _normalize_rank_scores(items: List[Dict[str, Any]]) -> None:
    max_score = max((float(item.get("relevanceScore") or 0) for item in items), default=0.0)
    if max_score <= 0:
        return
    for item in items:
        item["relevanceScore"] = round(max(0.0, float(item.get("relevanceScore") or 0)) / max_score, 3)


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
) -> Dict[str, Any]:
    """Group KB hits into file documents (PDF/PPT) and textual relevant projects."""
    industry = str(research.get("industry") or "").strip()
    query = " ".join(
        filter(
            None,
            [
                account_name,
                research.get("needs", ""),
                industry,
                research.get("intersection", ""),
                research.get("campaign_service", ""),
                research.get("company_description", "")[:200],
            ],
        )
    ).strip()
    if not query:
        return {"relevantDocuments": [], "relevantProjects": [], "recommendedDeck": None}

    hits = _kb_search(ctx, query, limit=limit)

    repo = get_kb_repository()
    tenant_uuid, clerk_key = resolve_kb_tenant(ctx)

    by_asset: Dict[str, Dict[str, Any]] = {}
    for hit in hits:
        if not is_library_kb_hit(hit):
            continue
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
        if not asset_row:
            continue
        if _is_project_asset(asset_row):
            continue
        file_name = (asset_row or {}).get("file_name") or ""
        ext = Path(file_name).suffix.lower() if file_name else ""
        mime = (asset_row or {}).get("mime_type") or ""
        meta = bucket["metadata"]
        snippets = bucket["snippets"]
        combined = "\n\n".join(snippets)
        score = bucket["best_score"]
        title = _title_for_hit(asset_row, asset_id, meta, combined)
        search_blob = " ".join(
            filter(
                None,
                [
                    title,
                    file_name,
                    mime,
                    combined,
                    " ".join(str(v) for v in meta.values()),
                ],
            )
        )
        # Vector hits still need call-context relevance (industry / needs).
        lexical = _score_text(search_blob, query)
        # Put embedding hits on a comparable scale to lexical raw scores.
        effective = max(score * 10.0, lexical)
        if not _passes_relevance(text=search_blob, raw_score=effective, industry=industry, min_raw=2.5):
            continue

        is_document = ext in DOCUMENT_EXTENSIONS or "pdf" in mime or "presentation" in mime

        if is_document and asset_row.get("storage_path"):
            document = _document_from_asset(
                {
                    **asset_row,
                    "title": title,
                    "fileName": file_name,
                    "mimeType": mime,
                },
                score=effective,
                snippet=snippets[0] if snippets else None,
                preview_text=combined,
            )
            if document:
                documents.append(document)
            continue

        source = _source_label(meta, asset_id)
        if source != "project_database":
            continue
        projects.append(
            {
                "id": f"proj-{asset_id}",
                "title": title,
                "source": source,
                "relevanceScore": effective,
                "summary": snippets[0][:220] if snippets else "",
                "details": combined[:4000] if combined else title,
                "assetId": asset_id if not asset_id.startswith("dc:") else None,
            }
        )

    for asset in repo.list_assets(ctx):
        if not _is_presentation_asset(asset):
            continue
        blob = _asset_search_blob(asset)
        score = _score_text(blob, query)
        if not _passes_relevance(text=blob, raw_score=score, industry=industry):
            continue
        asset_id = str(asset.get("id") or "")
        preview_text = "\n\n".join(repo.list_asset_chunk_texts(ctx, asset_id, limit=3))
        document = _document_from_asset(asset, score=score, preview_text=preview_text)
        if document:
            documents.append(document)

    existing_project_ids = {str(project.get("id") or "") for project in projects}
    for project in list_kb_projects(ctx):
        project_id = str(project.get("id") or "")
        if project_id in existing_project_ids:
            continue
        blob = _project_search_blob(project)
        score = _score_text(blob, query)
        if not _passes_relevance(text=blob, raw_score=score, industry=industry):
            continue
        projects.append(_project_to_relevant(project, score))

    documents = _merge_by_id(documents, "assetId")
    projects = _merge_by_id(projects, "id")
    _normalize_rank_scores(documents)
    _normalize_rank_scores(projects)
    documents = _filter_by_normalized_score(documents)
    projects = _filter_by_normalized_score(projects)

    documents.sort(key=lambda d: d["relevanceScore"], reverse=True)
    projects.sort(key=lambda p: p["relevanceScore"], reverse=True)
    top_documents = documents[:8]
    recommended_deck = next(
        (
            doc
            for doc in top_documents
            if str(doc.get("format") or "").lower() in {"ppt", "pptx", "pdf"}
        ),
        None,
    )
    return {
        "relevantDocuments": top_documents,
        "relevantProjects": projects[:8],
        "recommendedDeck": recommended_deck,
    }
