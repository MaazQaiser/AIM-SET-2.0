from __future__ import annotations

import logging
import os
import tempfile
from pathlib import Path
from typing import Any, Dict, Optional

from dc_embeddings.client import EmbeddingClient
from dc_kb.extract import extract_document

from app.config import get_settings
from app.domain.kb_repository import KbRepository, get_kb_repository
from app.services.office_preview import rasterize_presentation_slides

logger = logging.getLogger(__name__)

PRESENTATION_EXTENSIONS = {".ppt", ".pptx"}


def generate_presentation_preview(
    repo: KbRepository,
    tenant_id: str,
    asset_id: str,
    *,
    clerk_key: Optional[str] = None,
    force: bool = False,
) -> bool:
    """Build or refresh slide PNG previews for a presentation asset."""
    row = repo.get_asset_row(tenant_id, asset_id, clerk_key or tenant_id)
    if not row or not row.get("storage_path"):
        return False

    suffix = Path(row.get("file_name") or "upload.bin").suffix.lower()
    if suffix not in PRESENTATION_EXTENSIONS:
        return False
    if int(row.get("preview_slide_count") or 0) > 0 and not force:
        return True

    file_bytes = _download(repo, tenant_id, str(row["storage_path"]), clerk_key)
    slide_pngs = rasterize_presentation_slides(file_bytes, suffix)
    if not slide_pngs:
        raise ValueError("No slides could be rendered from presentation")
    repo.save_preview_slides(tenant_id, asset_id, slide_pngs, clerk_key=clerk_key)
    return True


def backfill_presentation_previews(
    repo: Optional[KbRepository] = None,
    *,
    force: bool = False,
) -> Dict[str, Any]:
    """Generate slide PNG previews for all presentation assets missing visual previews."""
    repo = repo or get_kb_repository()
    from app.domain.kb_tenancy import kb_context_for_user

    ctx = kb_context_for_user("backfill-worker")
    tenant_uuid, clerk_key = repo._ctx_keys(ctx)
    rows = repo.list_presentation_assets(tenant_uuid, clerk_key, missing_preview_only=not force)

    ok: list[str] = []
    skipped: list[str] = []
    failed: Dict[str, str] = {}

    for row in rows:
        asset_id = row["id"]
        if int(row.get("preview_slide_count") or 0) > 0 and not force:
            skipped.append(asset_id)
            continue
        try:
            if generate_presentation_preview(
                repo,
                tenant_uuid,
                asset_id,
                clerk_key=clerk_key,
                force=force,
            ):
                ok.append(asset_id)
            else:
                skipped.append(asset_id)
        except Exception as exc:
            failed[asset_id] = str(exc)[:300]
            logger.warning("Preview backfill failed for %s: %s", asset_id, exc)

    return {
        "tenantId": tenant_uuid,
        "processed": len(ok),
        "skipped": len(skipped),
        "failed": failed,
        "assetIds": ok,
    }


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

        if suffix.lower() in PRESENTATION_EXTENSIONS:
            repo.update_job(
                job_id,
                tenant_id,
                stage="preview",
                progress_pct=25,
                clerk_key=clerk_key,
            )
            try:
                generate_presentation_preview(
                    repo,
                    tenant_id,
                    asset_id,
                    clerk_key=clerk_key,
                    force=True,
                )
            except Exception as exc:
                logger.warning("KB preview generation failed for %s: %s", asset_id, exc)

        with tempfile.NamedTemporaryFile(delete=True, suffix=suffix) as tmp:
            tmp.write(file_bytes)
            tmp.flush()
            doc = extract_document(tmp.name, mime_type=mime)

        if not doc.chunks:
            from dc_kb.models import TextChunk

            title = row.get("title") or row.get("file_name") or asset_id
            is_image = (mime or "").lower().startswith("image/") or suffix in (
                ".png",
                ".jpg",
                ".jpeg",
                ".gif",
                ".webp",
            )
            # Image-based PPTX from Content Studio has no extractable text — use
            # the source HTML text that was passed from the exporter when available.
            source_text = (job.get("_source_text") or "").strip()
            is_image_pptx = suffix.lower() in (".pptx", ".ppt") and not source_text
            if source_text:
                from dc_kb.chunking import split_text

                doc.chunks = split_text(
                    source_text,
                    metadata={"source": "studio_html_export", "format": suffix.lstrip(".")},
                )
                if not doc.chunks:
                    doc.chunks = [
                        TextChunk(
                            text=source_text[:2000],
                            metadata={"source": "studio_html_export", "format": suffix.lstrip(".")},
                        )
                    ]
            elif is_image:
                doc.chunks = [
                    TextChunk(
                        text=f"[Image asset: {title}] Visual content stored for preview; no OCR text detected.",
                        metadata={"source": "image_placeholder", "format": "image"},
                    )
                ]
            elif is_image_pptx:
                doc.chunks = [
                    TextChunk(
                        text=f"[Presentation: {title}] Slides stored as visual content; no text was extracted.",
                        metadata={"source": "pptx_placeholder", "format": "pptx"},
                    )
                ]
            else:
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
            dimensions=settings.kb_embedding_dimensions or None,
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


def _download(repo: KbRepository, tenant_id: str, storage_path: str, clerk_key: Optional[str]) -> bytes:
    from dc_core.tenancy import TenantContext

    ctx = TenantContext(tenant_id=clerk_key or tenant_id, user_id="worker")
    return repo.download_file(ctx, storage_path)
