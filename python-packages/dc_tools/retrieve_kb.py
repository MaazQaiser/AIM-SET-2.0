from __future__ import annotations

import os
from typing import Any, Callable, Dict, List, Optional


def retrieve_kb(
    tenant_id: str,
    query: str,
    limit: int = 5,
    chunks: Optional[List[Dict[str, Any]]] = None,
    *,
    embed_fn: Optional[Callable[[str], List[float]]] = None,
    vector_search_fn: Optional[Callable[[str, List[float], int], List[Dict[str, Any]]]] = None,
) -> List[Dict[str, Any]]:
    """Semantic KB retrieval via pgvector when configured; keyword fallback otherwise."""
    if not query.strip():
        return []

    if embed_fn and vector_search_fn:
        try:
            embedding = embed_fn(query)
            hits = vector_search_fn(tenant_id, embedding, limit)
            if hits:
                return hits
        except Exception:
            pass

    if not chunks:
        return []

    q = query.lower()
    scored = []
    for ch in chunks:
        if ch.get("tenant_id") != tenant_id:
            continue
        text = (ch.get("chunk_text") or "").lower()
        score = sum(1 for word in q.split() if len(word) > 2 and word in text)
        if score > 0:
            scored.append({**ch, "score": score})
    scored.sort(key=lambda x: x.get("score", 0), reverse=True)
    return scored[:limit]


def default_embed_fn(query: str) -> List[float]:
    from dc_embeddings.client import EmbeddingClient

    _dim = os.environ.get("KB_EMBEDDING_DIMENSIONS")
    dimensions = int(_dim) if _dim else None
    return EmbeddingClient(
        api_key=os.environ.get("OPENAI_API_KEY"),
        dimensions=dimensions,
    ).embed([query]).embeddings[0]
