from __future__ import annotations

import hashlib
import re
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path
from functools import lru_cache
from typing import Any, Dict, List, Optional, Tuple

from dc_core.tenancy import TenantContext

from app.config import get_settings
from app.deps import get_supabase
from app.domain.kb_constants import ALLOWED_ASSET_TYPES, EXTENSION_ASSET_TYPE, EXTENSION_MIME
from app.domain.memory_store import get_memory_store
from app.domain.kb_tenancy import resolve_kb_tenant
from app.domain.tenant_service import get_tenant_service
from app.services.office_preview import slide_storage_path

_ASSET_LIST_CACHE_TTL_SECONDS = 30


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _safe_storage_file_name(file_name: str) -> str:
    """Supabase object keys: avoid spaces/special chars while keeping extension."""
    path = Path(file_name)
    ext = path.suffix.lower()
    stem = re.sub(r"[^\w.\-]+", "_", path.stem).strip("._") or "upload"
    return f"{stem[:96]}{ext}" if ext else f"{stem[:96]}.bin"


def _row_to_asset(row: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "id": row["id"],
        "title": row["title"],
        "type": row.get("asset_type") or row.get("type", "deck"),
        "tags": row.get("tags") or [],
        "uploadedAt": (row.get("uploaded_at") or row.get("uploadedAt") or _now_iso())[:10],
        "version": row.get("version", 1),
        "effectivenessScore": float(row["effectiveness_score"]) if row.get("effectiveness_score") is not None else None,
        "status": row.get("status", "ready"),
        "fileName": row.get("file_name"),
        "mimeType": row.get("mime_type"),
        "chunkCount": row.get("chunk_count", 0),
        "ingestError": row.get("ingest_error"),
        "hasPreview": bool(row.get("preview_slide_count") or row.get("preview_storage_path")),
        "previewSlideCount": int(row.get("preview_slide_count") or 0),
    }


class KbRepository:
    def __init__(self) -> None:
        self._tenants = get_tenant_service()
        self._asset_list_cache: Dict[Tuple[str, str], Tuple[float, List[Dict[str, Any]]]] = {}

    def _ctx_keys(self, ctx: TenantContext) -> Tuple[str, str]:
        return resolve_kb_tenant(ctx)

    def _asset_cache_key(self, tenant_uuid: str, clerk_key: str) -> Tuple[str, str]:
        return (tenant_uuid, clerk_key)

    def _clear_asset_list_cache(
        self,
        tenant_uuid: Optional[str] = None,
        clerk_key: Optional[str] = None,
    ) -> None:
        if tenant_uuid and clerk_key:
            self._asset_list_cache.pop(self._asset_cache_key(tenant_uuid, clerk_key), None)
            return
        self._asset_list_cache.clear()

    def list_assets(self, ctx: TenantContext) -> List[Dict[str, Any]]:
        tenant_uuid, clerk_key = self._ctx_keys(ctx)
        settings = get_settings()
        cache_key = self._asset_cache_key(tenant_uuid, clerk_key)
        cached = self._asset_list_cache.get(cache_key)
        if cached and time.monotonic() - cached[0] < _ASSET_LIST_CACHE_TTL_SECONDS:
            return [dict(asset) for asset in cached[1]]

        if settings.supabase_configured:
            try:
                supabase = get_supabase()
                result = (
                    supabase.table("kb_assets")
                    .select(
                        "id,title,asset_type,tags,uploaded_at,version,effectiveness_score,"
                        "status,file_name,mime_type,chunk_count,ingest_error,"
                        "preview_slide_count,preview_storage_path"
                    )
                    .eq("tenant_id", tenant_uuid)
                    .order("uploaded_at", desc=True)
                    .execute()
                )
                rows = result.data or []
                if rows:
                    assets = [_row_to_asset(r) for r in rows]
                    self._asset_list_cache[cache_key] = (time.monotonic(), assets)
                    return [dict(asset) for asset in assets]
            except Exception:
                pass

        assets = get_memory_store().list_kb_assets(clerk_key)
        self._asset_list_cache[cache_key] = (time.monotonic(), [dict(asset) for asset in assets])
        return assets

    def get_asset(self, ctx: TenantContext, asset_id: str) -> Optional[Dict[str, Any]]:
        assets = self.list_assets(ctx)
        return next((a for a in assets if a["id"] == asset_id), None)

    def list_asset_chunk_texts(self, ctx: TenantContext, asset_id: str, limit: int = 20) -> List[str]:
        tenant_uuid, clerk_key = self._ctx_keys(ctx)
        settings = get_settings()
        texts: List[str] = []

        if settings.supabase_configured:
            try:
                supabase = get_supabase()
                result = (
                    supabase.table("kb_chunks")
                    .select("chunk_text, chunk_index")
                    .eq("tenant_id", tenant_uuid)
                    .eq("asset_id", asset_id)
                    .order("chunk_index")
                    .limit(limit)
                    .execute()
                )
                for row in result.data or []:
                    text = (row.get("chunk_text") or "").strip()
                    if text:
                        texts.append(text)
                if texts:
                    return texts
            except Exception:
                pass

        for ch in get_memory_store().kb_chunks.get(clerk_key, []):
            if ch.get("asset_id") == asset_id and ch.get("tenant_id") == tenant_uuid:
                text = (ch.get("chunk_text") or "").strip()
                if text:
                    texts.append(text)
        return texts[:limit]

    def list_asset_chunks(self, ctx: TenantContext, asset_id: str, limit: int = 1000) -> List[Dict[str, Any]]:
        tenant_uuid, clerk_key = self._ctx_keys(ctx)
        settings = get_settings()

        if settings.supabase_configured:
            try:
                supabase = get_supabase()
                result = (
                    supabase.table("kb_chunks")
                    .select("asset_id, chunk_text, chunk_index, metadata")
                    .eq("tenant_id", tenant_uuid)
                    .eq("asset_id", asset_id)
                    .order("chunk_index")
                    .limit(limit)
                    .execute()
                )
                return [
                    {
                        "asset_id": row.get("asset_id") or asset_id,
                        "chunk_text": row.get("chunk_text") or "",
                        "chunk_index": row.get("chunk_index") or 0,
                        "metadata": row.get("metadata") or {},
                    }
                    for row in result.data or []
                ]
            except Exception:
                pass

        rows = []
        for ch in get_memory_store().kb_chunks.get(clerk_key, []):
            if ch.get("asset_id") != asset_id or ch.get("tenant_id") != tenant_uuid:
                continue
            rows.append(
                {
                    "asset_id": asset_id,
                    "chunk_text": ch.get("chunk_text") or "",
                    "chunk_index": ch.get("chunk_index") or 0,
                    "metadata": ch.get("metadata") or {},
                }
            )
        rows.sort(key=lambda row: int(row.get("chunk_index") or 0))
        return rows[:limit]

    def create_upload(
        self,
        ctx: TenantContext,
        *,
        file_name: str,
        file_bytes: bytes,
        ext: str,
        title: Optional[str] = None,
        tags: Optional[List[str]] = None,
        asset_type: Optional[str] = None,
    ) -> Dict[str, Any]:
        tenant_uuid, clerk_key = self._ctx_keys(ctx)
        settings = get_settings()
        asset_id = f"kb-{uuid.uuid4().hex[:12]}"
        mime = EXTENSION_MIME.get(ext, "application/octet-stream")
        resolved_type = (
            asset_type
            if asset_type and asset_type in ALLOWED_ASSET_TYPES
            else EXTENSION_ASSET_TYPE.get(ext, "deck")
        )
        checksum = hashlib.sha256(file_bytes).hexdigest()
        storage_file_name = _safe_storage_file_name(file_name)
        storage_path = f"{tenant_uuid}/{asset_id}/{storage_file_name}"
        display_title = title or file_name.rsplit(".", 1)[0]

        asset_row = {
            "id": asset_id,
            "tenant_id": tenant_uuid,
            "title": display_title,
            "asset_type": resolved_type,
            "tags": tags or [],
            "storage_path": storage_path,
            "status": "pending",
            "mime_type": mime,
            "file_name": file_name,
            "byte_size": len(file_bytes),
            "checksum_sha256": checksum,
            "uploaded_at": _now_iso(),
            "version": 1,
            "chunk_count": 0,
        }

        job_row = {
            "id": str(uuid.uuid4()),
            "tenant_id": tenant_uuid,
            "asset_id": asset_id,
            "status": "queued",
            "stage": "uploaded",
            "progress_pct": 0,
            "created_at": _now_iso(),
        }

        if settings.supabase_configured:
            try:
                supabase = get_supabase()
                supabase.storage.from_(settings.kb_storage_bucket).upload(
                    storage_path,
                    file_bytes,
                    {"content-type": mime, "upsert": "true"},
                )
                supabase.table("kb_assets").insert(asset_row).execute()
                inserted = supabase.table("kb_ingest_jobs").insert(job_row).execute()
                job = (inserted.data or [job_row])[0]
                self._clear_asset_list_cache(tenant_uuid, clerk_key)
                return {"asset": _row_to_asset(asset_row), "job": self._job_to_api(job)}
            except Exception as exc:
                raise RuntimeError(f"Failed to persist upload: {exc}") from exc

        store = get_memory_store()
        store.kb_files[storage_path] = file_bytes
        api_asset = _row_to_asset(asset_row)
        store.kb_assets.setdefault(clerk_key, []).append(api_asset)
        store.kb_ingest_jobs.setdefault(clerk_key, []).append(job_row)
        self._clear_asset_list_cache(tenant_uuid, clerk_key)
        return {"asset": api_asset, "job": self._job_to_api(job_row)}

    def download_file(self, ctx: TenantContext, storage_path: str) -> bytes:
        settings = get_settings()
        if settings.supabase_configured:
            supabase = get_supabase()
            data = supabase.storage.from_(settings.kb_storage_bucket).download(storage_path)
            return bytes(data)

        blob = get_memory_store().kb_files.get(storage_path)
        if blob is None:
            raise FileNotFoundError(storage_path)
        return blob

    def upload_file(
        self,
        storage_path: str,
        file_bytes: bytes,
        *,
        content_type: str = "application/octet-stream",
    ) -> None:
        settings = get_settings()
        if settings.supabase_configured:
            supabase = get_supabase()
            supabase.storage.from_(settings.kb_storage_bucket).upload(
                storage_path,
                file_bytes,
                {"content-type": content_type, "upsert": "true"},
            )
            return

        get_memory_store().kb_files[storage_path] = file_bytes

    def save_preview_slides(
        self,
        tenant_id: str,
        asset_id: str,
        slide_pngs: List[bytes],
        *,
        clerk_key: Optional[str] = None,
    ) -> int:
        self.delete_preview_slides(tenant_id, asset_id, clerk_key=clerk_key)
        for index, png in enumerate(slide_pngs, start=1):
            path = slide_storage_path(tenant_id, asset_id, index)
            self.upload_file(path, png, content_type="image/png")

        patch = {
            "preview_slide_count": len(slide_pngs),
        }
        settings = get_settings()
        if settings.supabase_configured:
            try:
                supabase = get_supabase()
                supabase.table("kb_assets").update(patch).eq("tenant_id", tenant_id).eq("id", asset_id).execute()
                try:
                    supabase.table("kb_assets").update({"preview_updated_at": _now_iso()}).eq(
                        "tenant_id", tenant_id
                    ).eq("id", asset_id).execute()
                except Exception:
                    pass
                self._clear_asset_list_cache()
            except Exception:
                pass

        if clerk_key:
            for asset in get_memory_store().kb_assets.get(clerk_key, []):
                if asset["id"] == asset_id:
                    asset["hasPreview"] = len(slide_pngs) > 0
                    asset["previewSlideCount"] = len(slide_pngs)
                    asset["previewStoragePath"] = None
            self._clear_asset_list_cache(tenant_id, clerk_key)
        return len(slide_pngs)

    def delete_preview_slides(
        self,
        tenant_id: str,
        asset_id: str,
        *,
        clerk_key: Optional[str] = None,
        slide_count: Optional[int] = None,
    ) -> None:
        count = slide_count
        if count is None:
            row = self.get_asset_row(tenant_id, asset_id, clerk_key or tenant_id)
            count = int((row or {}).get("preview_slide_count") or 0)

        paths = [slide_storage_path(tenant_id, asset_id, i) for i in range(1, (count or 0) + 1)]
        preview_pdf = f"{tenant_id}/{asset_id}/preview.pdf"
        paths.append(preview_pdf)

        settings = get_settings()
        if settings.supabase_configured and paths:
            try:
                supabase = get_supabase()
                supabase.storage.from_(settings.kb_storage_bucket).remove(paths)
            except Exception:
                pass

        store = get_memory_store()
        for path in paths:
            if path in store.kb_files:
                del store.kb_files[path]

    def save_preview_pdf(
        self,
        tenant_id: str,
        asset_id: str,
        pdf_bytes: bytes,
        *,
        clerk_key: Optional[str] = None,
    ) -> str:
        preview_path = f"{tenant_id}/{asset_id}/preview.pdf"
        self.upload_file(preview_path, pdf_bytes, content_type="application/pdf")

        settings = get_settings()
        if settings.supabase_configured:
            try:
                supabase = get_supabase()
                supabase.table("kb_assets").update({"preview_storage_path": preview_path}).eq(
                    "tenant_id", tenant_id
                ).eq("id", asset_id).execute()
                self._clear_asset_list_cache()
                return preview_path
            except Exception:
                pass

        if clerk_key:
            for asset in get_memory_store().kb_assets.get(clerk_key, []):
                if asset["id"] == asset_id:
                    asset["hasPreview"] = True
                    asset["previewStoragePath"] = preview_path
            self._clear_asset_list_cache(tenant_id, clerk_key)
        return preview_path

    def get_job(self, ctx: TenantContext, job_id: str) -> Optional[Dict[str, Any]]:
        tenant_uuid, clerk_key = self._ctx_keys(ctx)
        settings = get_settings()

        if settings.supabase_configured:
            try:
                supabase = get_supabase()
                result = (
                    supabase.table("kb_ingest_jobs")
                    .select("*")
                    .eq("id", job_id)
                    .eq("tenant_id", tenant_uuid)
                    .limit(1)
                    .execute()
                )
                rows = result.data or []
                if rows:
                    return self._job_to_api(rows[0])
            except Exception:
                pass

        for job in get_memory_store().kb_ingest_jobs.get(clerk_key, []):
            if job["id"] == job_id:
                return self._job_to_api(job)
        return None

    def claim_job(self, worker_id: str = "worker-1") -> Optional[Dict[str, Any]]:
        settings = get_settings()
        if settings.supabase_configured:
            try:
                supabase = get_supabase()
                result = supabase.rpc("claim_kb_ingest_job", {"p_worker_id": worker_id}).execute()
                rows = result.data or []
                if rows:
                    return rows[0]
            except Exception:
                pass

        store = get_memory_store()
        for clerk_key, jobs in store.kb_ingest_jobs.items():
            for job in sorted(jobs, key=lambda j: j.get("created_at", "")):
                if job.get("status") == "queued":
                    job["status"] = "processing"
                    job["stage"] = "parsing"
                    job["progress_pct"] = 5
                    job["worker_id"] = worker_id
                    job["started_at"] = _now_iso()
                    job["_clerk_key"] = clerk_key
                    return job
        return None

    def update_job(
        self,
        job_id: str,
        tenant_id: str,
        *,
        status: Optional[str] = None,
        stage: Optional[str] = None,
        progress_pct: Optional[int] = None,
        error_message: Optional[str] = None,
        clerk_key: Optional[str] = None,
    ) -> None:
        patch: Dict[str, Any] = {}
        if status is not None:
            patch["status"] = status
        if stage is not None:
            patch["stage"] = stage
        if progress_pct is not None:
            patch["progress_pct"] = progress_pct
        if error_message is not None:
            patch["error_message"] = error_message
        if status in ("done", "failed"):
            patch["finished_at"] = _now_iso()

        settings = get_settings()
        if settings.supabase_configured:
            try:
                supabase = get_supabase()
                supabase.table("kb_ingest_jobs").update(patch).eq("id", job_id).eq("tenant_id", tenant_id).execute()
                return
            except Exception:
                pass

        if clerk_key:
            for job in get_memory_store().kb_ingest_jobs.get(clerk_key, []):
                if job["id"] == job_id:
                    job.update(patch)
                    return

    def update_asset_status(
        self,
        tenant_id: str,
        asset_id: str,
        *,
        status: str,
        ingest_error: Optional[str] = None,
        chunk_count: Optional[int] = None,
        clerk_key: Optional[str] = None,
    ) -> None:
        patch: Dict[str, Any] = {"status": status}
        if ingest_error is not None:
            patch["ingest_error"] = ingest_error
        if chunk_count is not None:
            patch["chunk_count"] = chunk_count
        if status == "ready":
            patch["embedded_at"] = _now_iso()

        settings = get_settings()
        if settings.supabase_configured:
            try:
                supabase = get_supabase()
                supabase.table("kb_assets").update(patch).eq("tenant_id", tenant_id).eq("id", asset_id).execute()
                self._clear_asset_list_cache()
                return
            except Exception:
                pass

        if clerk_key:
            for asset in get_memory_store().kb_assets.get(clerk_key, []):
                if asset["id"] == asset_id:
                    asset["status"] = status
                    if ingest_error:
                        asset["ingestError"] = ingest_error
                    if chunk_count is not None:
                        asset["chunkCount"] = chunk_count
                    self._clear_asset_list_cache(tenant_id, clerk_key)

    def update_asset_metadata(
        self,
        tenant_id: str,
        asset_id: str,
        metadata: Dict[str, Any],
        *,
        clerk_key: Optional[str] = None,
    ) -> None:
        settings = get_settings()
        if settings.supabase_configured:
            try:
                supabase = get_supabase()
                supabase.table("kb_assets").update({"metadata": metadata}).eq("tenant_id", tenant_id).eq("id", asset_id).execute()
                self._clear_asset_list_cache()
                return
            except Exception:
                pass

        if clerk_key:
            for asset in get_memory_store().kb_assets.get(clerk_key, []):
                if asset["id"] == asset_id:
                    asset["metadata"] = metadata
                    self._clear_asset_list_cache(tenant_id, clerk_key)
                    return

    def delete_chunks_for_asset(self, tenant_id: str, asset_id: str, clerk_key: Optional[str] = None) -> None:
        settings = get_settings()
        if settings.supabase_configured:
            try:
                supabase = get_supabase()
                supabase.table("kb_chunks").delete().eq("tenant_id", tenant_id).eq("asset_id", asset_id).execute()
                return
            except Exception:
                pass

        if clerk_key:
            store = get_memory_store()
            store.kb_chunks[clerk_key] = [
                c for c in store.kb_chunks.get(clerk_key, []) if c.get("asset_id") != asset_id
            ]

    def insert_chunks(
        self,
        tenant_id: str,
        asset_id: str,
        chunks: List[Dict[str, Any]],
        clerk_key: Optional[str] = None,
    ) -> None:
        settings = get_settings()
        rows = []
        for i, ch in enumerate(chunks):
            emb = ch.get("embedding")
            row = {
                "tenant_id": tenant_id,
                "asset_id": asset_id,
                "chunk_text": ch["chunk_text"],
                "chunk_index": i,
                "metadata": ch.get("metadata") or {},
            }
            if emb is not None:
                row["embedding"] = emb
            rows.append(row)

        if settings.supabase_configured:
            try:
                supabase = get_supabase()
                for row in rows:
                    supabase.table("kb_chunks").insert(row).execute()
                return
            except Exception:
                pass

        if clerk_key:
            store = get_memory_store()
            for i, ch in enumerate(chunks):
                store.kb_chunks.setdefault(clerk_key, []).append(
                    {
                        "tenant_id": tenant_id,
                        "asset_id": asset_id,
                        "chunk_text": ch["chunk_text"],
                        "chunk_index": i,
                        "metadata": ch.get("metadata") or {},
                        "embedding": ch.get("embedding"),
                    }
                )

    def match_chunks(
        self,
        tenant_id: str,
        query_embedding: List[float],
        limit: int = 5,
        clerk_key: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        settings = get_settings()
        if settings.supabase_configured:
            try:
                supabase = get_supabase()
                result = supabase.rpc(
                    "match_kb_chunks",
                    {
                        "query_embedding": query_embedding,
                        "p_tenant_id": tenant_id,
                        "p_limit": limit,
                    },
                ).execute()
                rows = result.data or []
                return [
                    {
                        "tenant_id": tenant_id,
                        "asset_id": r["asset_id"],
                        "chunk_text": r["chunk_text"],
                        "metadata": r.get("metadata") or {},
                        "score": r.get("similarity", 0),
                    }
                    for r in rows
                ]
            except Exception:
                pass

        if not clerk_key:
            return []
        return _memory_vector_search(clerk_key, tenant_id, query_embedding, limit)

    def list_presentation_assets(
        self,
        tenant_id: str,
        clerk_key: str,
        *,
        missing_preview_only: bool = True,
    ) -> List[Dict[str, Any]]:
        settings = get_settings()
        rows: List[Dict[str, Any]] = []

        if settings.supabase_configured:
            try:
                supabase = get_supabase()
                query = supabase.table("kb_assets").select("*").eq("tenant_id", tenant_id)
                if missing_preview_only:
                    query = query.eq("preview_slide_count", 0)
                result = query.order("uploaded_at", desc=True).execute()
                rows = result.data or []
            except Exception:
                pass

        if not rows:
            for asset in get_memory_store().list_kb_assets(clerk_key):
                fname = asset.get("fileName") or ""
                ext = Path(fname).suffix.lower()
                if ext not in {".ppt", ".pptx"}:
                    continue
                if missing_preview_only and (asset.get("hasPreview") or asset.get("previewSlideCount")):
                    continue
                rows.append(
                    {
                        "id": asset["id"],
                        "file_name": fname,
                        "preview_storage_path": asset.get("previewStoragePath"),
                        "storage_path": f"{tenant_id}/{asset['id']}/{fname}",
                    }
                )

        filtered: List[Dict[str, Any]] = []
        for row in rows:
            fname = row.get("file_name") or ""
            ext = Path(fname).suffix.lower()
            mime = (row.get("mime_type") or "").lower()
            is_deck = ext in {".ppt", ".pptx"} or "presentation" in mime or "ms-powerpoint" in mime
            if is_deck:
                filtered.append(row)
        return filtered

    def get_asset_row(self, tenant_id: str, asset_id: str, clerk_key: str) -> Optional[Dict[str, Any]]:
        settings = get_settings()
        if settings.supabase_configured:
            try:
                supabase = get_supabase()
                result = (
                    supabase.table("kb_assets")
                    .select("*")
                    .eq("tenant_id", tenant_id)
                    .eq("id", asset_id)
                    .limit(1)
                    .execute()
                )
                rows = result.data or []
                if rows:
                    return rows[0]
            except Exception:
                pass

        for asset in get_memory_store().list_kb_assets(clerk_key):
            if asset["id"] == asset_id:
                fname = asset.get("fileName") or "upload.bin"
                preview_storage_path = asset.get("previewStoragePath")
                return {
                    "id": asset_id,
                    "title": asset.get("title"),
                    "asset_type": asset.get("type") or asset.get("asset_type", "deck"),
                    "tags": asset.get("tags") or [],
                    "storage_path": f"{tenant_id}/{asset_id}/{fname}",
                    "preview_storage_path": preview_storage_path,
                    "preview_slide_count": asset.get("previewSlideCount") or 0,
                    "file_name": fname,
                    "mime_type": asset.get("mimeType"),
                    "status": asset.get("status", "ready"),
                    "metadata": asset.get("metadata") or {},
                }
        return None

    def delete_asset(self, ctx: TenantContext, asset_id: str) -> bool:
        tenant_uuid, clerk_key = self._ctx_keys(ctx)
        settings = get_settings()
        row = self.get_asset_row(tenant_uuid, asset_id, clerk_key)
        if not row:
            return False

        storage_path = row.get("storage_path")
        preview_path = row.get("preview_storage_path")
        slide_count = int(row.get("preview_slide_count") or 0)
        if settings.supabase_configured:
            try:
                supabase = get_supabase()
                paths = [p for p in (storage_path, preview_path) if p]
                paths.extend(slide_storage_path(tenant_uuid, asset_id, i) for i in range(1, slide_count + 1))
                if paths:
                    supabase.storage.from_(settings.kb_storage_bucket).remove(paths)
                supabase.table("kb_chunks").delete().eq("tenant_id", tenant_uuid).eq("asset_id", asset_id).execute()
                supabase.table("kb_ingest_jobs").delete().eq("tenant_id", tenant_uuid).eq("asset_id", asset_id).execute()
                supabase.table("kb_assets").delete().eq("tenant_id", tenant_uuid).eq("id", asset_id).execute()
                self._clear_asset_list_cache(tenant_uuid, clerk_key)
                return True
            except Exception:
                pass

        store = get_memory_store()
        store.kb_assets[clerk_key] = [a for a in store.kb_assets.get(clerk_key, []) if a["id"] != asset_id]
        self.delete_chunks_for_asset(tenant_uuid, asset_id, clerk_key)
        if storage_path and storage_path in store.kb_files:
            del store.kb_files[storage_path]
        if preview_path and preview_path in store.kb_files:
            del store.kb_files[preview_path]
        for i in range(1, slide_count + 1):
            slide_path = slide_storage_path(tenant_uuid, asset_id, i)
            if slide_path in store.kb_files:
                del store.kb_files[slide_path]
        self._clear_asset_list_cache(tenant_uuid, clerk_key)
        return True

    def requeue_asset(self, ctx: TenantContext, asset_id: str) -> Optional[Dict[str, Any]]:
        tenant_uuid, clerk_key = self._ctx_keys(ctx)
        row = self.get_asset_row(tenant_uuid, asset_id, clerk_key)
        if not row:
            return None

        self.delete_chunks_for_asset(tenant_uuid, asset_id, clerk_key)
        self.update_asset_status(tenant_uuid, asset_id, status="processing", clerk_key=clerk_key)

        job_row = {
            "id": str(uuid.uuid4()),
            "tenant_id": tenant_uuid,
            "asset_id": asset_id,
            "status": "queued",
            "stage": "uploaded",
            "progress_pct": 0,
            "created_at": _now_iso(),
        }

        settings = get_settings()
        if settings.supabase_configured:
            try:
                supabase = get_supabase()
                inserted = supabase.table("kb_ingest_jobs").insert(job_row).execute()
                return self._job_to_api((inserted.data or [job_row])[0])
            except Exception:
                pass

        get_memory_store().kb_ingest_jobs.setdefault(clerk_key, []).append(job_row)
        return self._job_to_api(job_row)

    @staticmethod
    def _job_to_api(row: Dict[str, Any]) -> Dict[str, Any]:
        return {
            "id": row["id"],
            "assetId": row["asset_id"],
            "status": row["status"],
            "stage": row.get("stage", "uploaded"),
            "progressPct": row.get("progress_pct", 0),
            "errorMessage": row.get("error_message"),
            "startedAt": row.get("started_at"),
            "finishedAt": row.get("finished_at"),
            "createdAt": row.get("created_at"),
        }


def _memory_vector_search(
    clerk_key: str,
    tenant_id: str,
    query_embedding: List[float],
    limit: int,
) -> List[Dict[str, Any]]:
    import math

    chunks = get_memory_store().kb_chunks.get(clerk_key, [])
    scored = []
    for ch in chunks:
        if ch.get("tenant_id") != tenant_id:
            continue
        emb = ch.get("embedding")
        if not emb:
            continue
        dot = sum(a * b for a, b in zip(emb, query_embedding))
        na = math.sqrt(sum(a * a for a in emb))
        nb = math.sqrt(sum(b * b for b in query_embedding))
        sim = dot / (na * nb) if na and nb else 0.0
        scored.append({**ch, "score": sim})
    scored.sort(key=lambda x: x["score"], reverse=True)
    return scored[:limit]


@lru_cache
def get_kb_repository() -> KbRepository:
    return KbRepository()
