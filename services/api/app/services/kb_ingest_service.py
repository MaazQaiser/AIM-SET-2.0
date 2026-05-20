from __future__ import annotations

import os
import tempfile
from pathlib import Path
from typing import Any, Dict, Optional

from dc_embeddings.client import EmbeddingClient
from dc_kb.extract import extract_document

from app.config import get_settings
from app.domain.kb_repository import KbRepository, get_kb_repository


def process_ingest_job(job: Dict[str, Any], repo: Optional[KbRepository] = None) -> None:
    """Parse, chunk, embed, and persist a claimed ingest job."""
    repo = repo or get_kb_repository()
    settings = get_settings()
    job_id = job["id"]
    tenant_id = job["tenant_id"]
    asset_id = job["asset_id"]
    clerk_key = job.get("_clerk_key")

    try:
        row = repo.get_asset_row(tenant_id, asset_id, clerk_key or tenant_id)
        if not row:
            raise ValueError(f"Asset not found: {asset_id}")

        storage_path = row.get("storage_path")
        if not storage_path:
            raise ValueError("Missing storage_path on asset")

        repo.update_job(
            job_id,
            tenant_id,
            stage="parsing",
            progress_pct=15,
            clerk_key=clerk_key,
        )
        repo.update_asset_status(tenant_id, asset_id, status="processing", clerk_key=clerk_key)

        file_bytes = _download(repo, tenant_id, storage_path, clerk_key)
        suffix = Path(row.get("file_name") or "upload.bin").suffix
        mime = row.get("mime_type")

        with tempfile.NamedTemporaryFile(delete=True, suffix=suffix) as tmp:
            tmp.write(file_bytes)
            tmp.flush()
            doc = extract_document(tmp.name, mime_type=mime)

        if not doc.chunks:
            raise ValueError("No text could be extracted from the document")

        asset_meta = {
            "asset_id": asset_id,
            "asset_type": row.get("asset_type") or "deck",
            "tags": row.get("tags") or [],
            "title": row.get("title") or "",
        }
        if job.get("_uploaded_by"):
            asset_meta["uploaded_by"] = job["_uploaded_by"]

        repo.update_job(job_id, tenant_id, stage="chunking", progress_pct=40, clerk_key=clerk_key)
        repo.delete_chunks_for_asset(tenant_id, asset_id, clerk_key)

        texts = [c.text for c in doc.chunks]
        repo.update_job(job_id, tenant_id, stage="embedding", progress_pct=60, clerk_key=clerk_key)

        client = EmbeddingClient(
            api_key=settings.openai_api_key or os.environ.get("OPENAI_API_KEY"),
            model=settings.kb_embedding_model,
        )
        result = client.embed(texts)

        chunk_rows = []
        for i, ch in enumerate(doc.chunks):
            chunk_rows.append(
                {
                    "chunk_text": ch.text,
                    "metadata": {**ch.metadata, **asset_meta},
                    "embedding": result.embeddings[i],
                }
            )

        repo.update_job(job_id, tenant_id, progress_pct=85, clerk_key=clerk_key)
        repo.insert_chunks(tenant_id, asset_id, chunk_rows, clerk_key)

        repo.update_asset_status(
            tenant_id,
            asset_id,
            status="ready",
            chunk_count=len(chunk_rows),
            clerk_key=clerk_key,
        )
        repo.update_job(
            job_id,
            tenant_id,
            status="done",
            stage="done",
            progress_pct=100,
            clerk_key=clerk_key,
        )
    except Exception as exc:
        repo.update_asset_status(
            tenant_id,
            asset_id,
            status="failed",
            ingest_error=str(exc)[:500],
            clerk_key=clerk_key,
        )
        repo.update_job(
            job_id,
            tenant_id,
            status="failed",
            stage="failed",
            progress_pct=100,
            error_message=str(exc)[:500],
            clerk_key=clerk_key,
        )
        raise


def _download(repo: KbRepository, tenant_id: str, storage_path: str, clerk_key: Optional[str]) -> bytes:
    from dc_core.tenancy import TenantContext

    ctx = TenantContext(tenant_id=clerk_key or tenant_id, user_id="worker")
    return repo.download_file(ctx, storage_path)
