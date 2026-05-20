from __future__ import annotations

import hashlib
import uuid
from datetime import datetime, timezone
from functools import lru_cache
from typing import Any, Dict, List, Optional, Tuple

from dc_core.tenancy import TenantContext

from app.config import get_settings
from app.deps import get_supabase
from app.domain.kb_constants import ALLOWED_ASSET_TYPES, EXTENSION_ASSET_TYPE, EXTENSION_MIME
from app.domain.memory_store import get_memory_store
from app.domain.kb_tenancy import resolve_kb_tenant
from app.domain.tenant_service import get_tenant_service


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


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
    }


class KbRepository:
    def __init__(self) -> None:
        self._tenants = get_tenant_service()

    def _ctx_keys(self, ctx: TenantContext) -> Tuple[str, str]:
        return resolve_kb_tenant(ctx)

    def list_assets(self, ctx: TenantContext) -> List[Dict[str, Any]]:
        tenant_uuid, clerk_key = self._ctx_keys(ctx)
        settings = get_settings()

        if settings.supabase_configured:
            try:
                supabase = get_supabase()
                result = (
                    supabase.table("kb_assets")
                    .select("*")
                    .eq("tenant_id", tenant_uuid)
                    .order("uploaded_at", desc=True)
                    .execute()
                )
                rows = result.data or []
                if rows:
                    return [_row_to_asset(r) for r in rows]
            except Exception:
                pass

        return get_memory_store().list_kb_assets(clerk_key)

    def get_asset(self, ctx: TenantContext, asset_id: str) -> Optional[Dict[str, Any]]:
        assets = self.list_assets(ctx)
        return next((a for a in assets if a["id"] == asset_id), None)

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
        storage_path = f"{tenant_uuid}/{asset_id}/{file_name}"
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
                return {"asset": _row_to_asset(asset_row), "job": self._job_to_api(job)}
            except Exception as exc:
                raise RuntimeError(f"Failed to persist upload: {exc}") from exc

        store = get_memory_store()
        store.kb_files[storage_path] = file_bytes
        api_asset = _row_to_asset(asset_row)
        store.kb_assets.setdefault(clerk_key, []).append(api_asset)
        store.kb_ingest_jobs.setdefault(clerk_key, []).append(job_row)
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
                return {
                    "id": asset_id,
                    "title": asset.get("title"),
                    "asset_type": asset.get("type") or asset.get("asset_type", "deck"),
                    "tags": asset.get("tags") or [],
                    "storage_path": f"{tenant_id}/{asset_id}/{fname}",
                    "file_name": fname,
                    "mime_type": asset.get("mimeType"),
                    "status": asset.get("status", "ready"),
                }
        return None

    def delete_asset(self, ctx: TenantContext, asset_id: str) -> bool:
        tenant_uuid, clerk_key = self._ctx_keys(ctx)
        settings = get_settings()
        row = self.get_asset_row(tenant_uuid, asset_id, clerk_key)
        if not row:
            return False

        storage_path = row.get("storage_path")
        if settings.supabase_configured:
            try:
                supabase = get_supabase()
                if storage_path:
                    supabase.storage.from_(settings.kb_storage_bucket).remove([storage_path])
                supabase.table("kb_chunks").delete().eq("tenant_id", tenant_uuid).eq("asset_id", asset_id).execute()
                supabase.table("kb_ingest_jobs").delete().eq("tenant_id", tenant_uuid).eq("asset_id", asset_id).execute()
                supabase.table("kb_assets").delete().eq("tenant_id", tenant_uuid).eq("id", asset_id).execute()
                return True
            except Exception:
                pass

        store = get_memory_store()
        store.kb_assets[clerk_key] = [a for a in store.kb_assets.get(clerk_key, []) if a["id"] != asset_id]
        self.delete_chunks_for_asset(tenant_uuid, asset_id, clerk_key)
        if storage_path and storage_path in store.kb_files:
            del store.kb_files[storage_path]
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
