from __future__ import annotations

import uuid
import logging
from datetime import datetime, timezone
from functools import lru_cache
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from dc_core.tenancy import TenantContext

from app.config import get_settings
from app.deps import get_supabase
from app.domain.memory_store import get_memory_store
from app.domain.tenant_service import get_tenant_service

TEMPLATE_EXTENSIONS = {".pptx", ".ppt", ".pdf", ".png", ".jpg", ".jpeg"}
ARTIFACT_TYPES = frozenset({"deck", "one_pager", "image", "case_study"})
_logger = logging.getLogger(__name__)


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _tenant_keys(ctx: TenantContext) -> Tuple[str, str]:
    return get_tenant_service().resolve(ctx)


def _public_template_keys(ctx: TenantContext) -> Tuple[str, str]:
    settings = get_settings()
    clerk_key = (settings.kb_shared_tenant_key or "dc-copilot-shared").strip()
    public_ctx = TenantContext(
        tenant_id=clerk_key,
        user_id=ctx.user_id or "template-public",
        clerk_org_id=clerk_key,
    )
    return get_tenant_service().resolve(public_ctx, allow_memory_fallback=True)


def _template_slide_path(tenant_uuid: str, template_id: str, slide_index: int) -> str:
    return f"{tenant_uuid}/{template_id}/slides/{slide_index}.png"


def _tpl_row_to_api(row: Dict[str, Any]) -> Dict[str, Any]:
    source_file_name = row.get("source_file_name") or row.get("sourceFileName")
    source_storage_path = row.get("source_storage_path") or row.get("sourceStoragePath")
    page_count = int(row.get("page_count") or row.get("pageCount") or 1)
    metadata = row.get("metadata") or {}
    if not isinstance(metadata, dict):
        metadata = {}
    return {
        "id": str(row["id"]),
        "name": row["name"],
        "artifactType": row.get("artifact_type") or row.get("artifactType"),
        "status": row.get("status", "ready"),
        "pageCount": page_count,
        "tags": row.get("tags") or [],
        "thumbnailUrl": row.get("thumbnail_url") or row.get("thumbnailUrl"),
        "cssVariables": row.get("css_variables") or row.get("cssVariables") or {},
        "createdAt": (row.get("created_at") or row.get("createdAt") or _now_iso())[:19],
        "ingestError": row.get("ingest_error") or row.get("ingestError"),
        "sourceFileName": source_file_name,
        "hasSourceFile": bool(source_storage_path),
        "previewSlideCount": page_count if source_storage_path else 0,
        "metadata": metadata,
    }


def _project_row_to_api(row: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "id": str(row["id"]),
        "title": row["title"],
        "artifactType": row["artifact_type"],
        "templateId": str(row["template_id"]) if row.get("template_id") else None,
        "status": row.get("status", "drafting"),
        "brief": row.get("brief") or {},
        "recommendedTemplateIds": [str(x) for x in (row.get("recommended_template_ids") or [])],
        "costUsd": float(row.get("cost_usd") or 0),
        "createdAt": (row.get("created_at") or _now_iso())[:19],
        "updatedAt": (row.get("updated_at") or _now_iso())[:19],
    }


def _warn_memory_fallback(operation: str, exc: Exception) -> None:
    _logger.warning("content_studio.%s falling back to memory store: %s", operation, exc)


class ContentStudioRepository:
    def __init__(self) -> None:
        self._tenants = get_tenant_service()

    def template_tenant_keys(self, ctx: TenantContext) -> Tuple[str, str]:
        return _public_template_keys(ctx)

    def template_storage_tenant_uuid(self, ctx: TenantContext, template_id: str) -> str:
        row = self.get_template_row(ctx, template_id)
        if row and row.get("tenant_id"):
            return str(row["tenant_id"])
        tenant_uuid, _ = self.template_tenant_keys(ctx)
        return tenant_uuid

    def _all_memory_templates(self) -> List[Tuple[str, Dict[str, Any]]]:
        out: List[Tuple[str, Dict[str, Any]]] = []
        for clerk_key, items in get_memory_store().content_templates.items():
            out.extend((clerk_key, item) for item in items)
        return out

    def _enrich_template_api(self, api: Dict[str, Any], row: Dict[str, Any]) -> Dict[str, Any]:
        thumb_path = row.get("thumbnail_storage_path") or row.get("thumbnailStoragePath")
        if thumb_path:
            api["thumbnailUrl"] = f"/api/content/templates/{api['id']}/slides/1"
        source_path = self.resolve_template_source_path_from_row(row)
        if source_path:
            api["hasSourceFile"] = True
            if not api.get("sourceFileName"):
                api["sourceFileName"] = Path(source_path).name
            api["previewSlideCount"] = int(api.get("pageCount") or 0)
        return api

    def resolve_template_source_path_from_row(self, row: Dict[str, Any]) -> Optional[str]:
        path = row.get("source_storage_path") or row.get("sourceStoragePath")
        return str(path) if path else None

    def resolve_template_source_path(self, ctx: TenantContext, template_id: str) -> Optional[str]:
        row = self.get_template_row(ctx, template_id)
        if row:
            path = self.resolve_template_source_path_from_row(row)
            if path:
                return path

        tenant_uuid, _ = self.template_tenant_keys(ctx)
        prefix = f"{tenant_uuid}/{template_id}/"
        candidates = []
        for path in get_memory_store().content_template_files.keys():
            path_str = str(path)
            if not path_str.startswith(prefix) and f"/{template_id}/" not in path_str:
                continue
            if "/slides/" in path_str or path_str.endswith("thumb.png"):
                continue
            candidates.append(path_str)
        if not candidates:
            return None
        candidates.sort(key=lambda p: (0 if p.lower().endswith((".ppt", ".pptx")) else 1, p))
        return candidates[0]

    def list_templates(
        self,
        ctx: TenantContext,
        *,
        artifact_type: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        settings = get_settings()
        if settings.supabase_configured:
            try:
                q = (
                    get_supabase()
                    .table("content_templates")
                    .select(
                        "id,name,artifact_type,status,page_count,tags,"
                        "thumbnail_storage_path,css_variables,created_at,ingest_error,"
                        "source_file_name,source_storage_path,metadata"
                    )
                    .order("created_at", desc=True)
                )
                if artifact_type:
                    q = q.eq("artifact_type", artifact_type)
                rows = q.execute().data or []
                out = []
                for r in rows:
                    api = self._enrich_template_api(_tpl_row_to_api(r), r)
                    out.append(api)
                return out
            except Exception:
                pass
        store = get_memory_store()
        items = [template for _, template in self._all_memory_templates()]
        if artifact_type:
            items = [t for t in items if t.get("artifactType") == artifact_type]
        return sorted(items, key=lambda t: str(t.get("createdAt") or ""), reverse=True)

    def get_template(self, ctx: TenantContext, template_id: str) -> Optional[Dict[str, Any]]:
        settings = get_settings()
        if settings.supabase_configured:
            try:
                row = (
                    get_supabase()
                    .table("content_templates")
                    .select("*")
                    .eq("id", template_id)
                    .limit(1)
                    .execute()
                )
                data = (row.data or [None])[0]
                if not data:
                    return None
                api = self._enrich_template_api(_tpl_row_to_api(data), data)
                api["html"] = data.get("html") or ""
                source_path = self.resolve_template_source_path(ctx, template_id)
                if source_path:
                    api["hasSourceFile"] = True
                    api.setdefault("sourceFileName", Path(source_path).name)
                    api["previewSlideCount"] = int(api.get("pageCount") or 0)
                return api
            except Exception:
                pass
        for clerk_key, t in self._all_memory_templates():
            if t["id"] == template_id:
                full = get_memory_store().content_template_html.get(f"{clerk_key}:{template_id}")
                api = {**t, "html": full or ""}
                source_path = self.resolve_template_source_path(ctx, template_id)
                if source_path:
                    api["hasSourceFile"] = True
                    api.setdefault("sourceFileName", Path(source_path).name)
                    api["previewSlideCount"] = int(api.get("pageCount") or 0)
                tenant_uuid = self.template_storage_tenant_uuid(ctx, template_id)
                thumb_path = f"{tenant_uuid}/{template_id}/thumb.png"
                if not api.get("thumbnailUrl") and thumb_path in get_memory_store().content_template_files:
                    api["thumbnailUrl"] = f"/api/content/templates/{template_id}/slides/1"
                return api
        return None

    def create_template_upload(
        self,
        ctx: TenantContext,
        *,
        file_name: str,
        file_bytes: bytes,
        ext: str,
        name: Optional[str] = None,
        artifact_type: Optional[str] = None,
        tags: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        tenant_uuid, clerk_key = self.template_tenant_keys(ctx)
        settings = get_settings()
        template_id = str(uuid.uuid4())
        resolved_type = artifact_type if artifact_type in ARTIFACT_TYPES else _ext_to_artifact(ext)
        display_name = name or file_name.rsplit(".", 1)[0]
        storage_path = f"{tenant_uuid}/{template_id}/{file_name}"

        row = {
            "id": template_id,
            "tenant_id": tenant_uuid,
            "name": display_name,
            "artifact_type": resolved_type,
            "status": "processing",
            "source_file_name": file_name,
            "source_storage_path": storage_path,
            "tags": tags or [],
            "metadata": {
                "source": {"fileName": file_name, "extension": ext.lstrip(".")},
                "processing": {
                    "progress": 5,
                    "stage": "uploaded",
                    "message": "Upload received",
                    "updatedAt": _now_iso(),
                },
            },
            "created_by": ctx.user_id,
            "created_at": _now_iso(),
        }

        use_memory = not settings.supabase_configured
        if settings.supabase_configured:
            try:
                supabase = get_supabase()
                supabase.storage.from_(settings.content_templates_bucket).upload(
                    storage_path,
                    file_bytes,
                    {"content-type": _mime_for_ext(ext), "upsert": "true"},
                )
                try:
                    supabase.table("content_templates").insert(row).execute()
                except Exception:
                    legacy_row = {key: value for key, value in row.items() if key != "metadata"}
                    supabase.table("content_templates").insert(legacy_row).execute()
            except Exception:
                use_memory = True
        if use_memory:
            store = get_memory_store()
            store.content_template_files[storage_path] = file_bytes
            api = _tpl_row_to_api(row)
            api["sourceStoragePath"] = storage_path
            store.content_templates.setdefault(clerk_key, []).append(api)

        return {"template": _tpl_row_to_api(row), "storagePath": storage_path}

    def update_template_progress(
        self,
        ctx: TenantContext,
        template_id: str,
        *,
        progress: int,
        stage: str,
        message: str,
    ) -> None:
        row = self.get_template_row(ctx, template_id) or {}
        metadata = row.get("metadata") or {}
        if not isinstance(metadata, dict):
            metadata = {}
        metadata["processing"] = {
            "progress": max(0, min(100, int(progress))),
            "stage": stage,
            "message": message,
            "updatedAt": _now_iso(),
        }

        use_memory = not get_settings().supabase_configured
        if get_settings().supabase_configured:
            try:
                get_supabase().table("content_templates").update({"metadata": metadata}).eq("id", template_id).execute()
                return
            except Exception:
                use_memory = True

        if use_memory:
            for _clerk_key, template in self._all_memory_templates():
                if template.get("id") == template_id:
                    template["metadata"] = metadata

    def create_manual_template(
        self,
        ctx: TenantContext,
        *,
        name: str,
        artifact_type: str,
        html: str,
        css_variables: Dict[str, Any],
        tags: Optional[List[str]] = None,
        page_count: int = 1,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        if artifact_type not in ARTIFACT_TYPES:
            raise ValueError(f"Invalid artifact_type: {artifact_type}")
        tenant_uuid, clerk_key = self.template_tenant_keys(ctx)
        settings = get_settings()
        template_id = str(uuid.uuid4())
        row = {
            "id": template_id,
            "tenant_id": tenant_uuid,
            "name": name,
            "artifact_type": artifact_type,
            "status": "ready",
            "source_file_name": None,
            "source_storage_path": None,
            "tags": tags or [],
            "html": html,
            "css_variables": css_variables,
            "page_count": max(1, page_count),
            "ingest_error": None,
            "metadata": metadata or {},
            "created_by": ctx.user_id,
            "created_at": _now_iso(),
        }

        use_memory = not settings.supabase_configured
        if settings.supabase_configured:
            try:
                get_supabase().table("content_templates").insert(row).execute()
            except Exception:
                use_memory = True
        if use_memory:
            store = get_memory_store()
            api = _tpl_row_to_api(row)
            store.content_templates.setdefault(clerk_key, []).append(api)
            store.content_template_html[f"{clerk_key}:{template_id}"] = html

        return self.get_template(ctx, template_id) or _tpl_row_to_api(row)

    def update_template(
        self,
        ctx: TenantContext,
        template_id: str,
        patch: Dict[str, Any],
    ) -> Optional[Dict[str, Any]]:
        db_patch: Dict[str, Any] = {}
        if "name" in patch:
            db_patch["name"] = patch["name"]
        if "artifactType" in patch:
            db_patch["artifact_type"] = patch["artifactType"]
        if "tags" in patch:
            db_patch["tags"] = patch["tags"]
        if "html" in patch:
            db_patch["html"] = patch["html"]
            db_patch["status"] = "ready"
            db_patch["ingest_error"] = None
        if "cssVariables" in patch:
            db_patch["css_variables"] = patch["cssVariables"]
        if "pageCount" in patch:
            db_patch["page_count"] = max(1, int(patch["pageCount"] or 1))
        if "metadata" in patch:
            db_patch["metadata"] = patch["metadata"] if isinstance(patch["metadata"], dict) else {}

        if db_patch.get("artifact_type") and db_patch["artifact_type"] not in ARTIFACT_TYPES:
            raise ValueError(f"Invalid artifact_type: {db_patch['artifact_type']}")

        use_memory = not get_settings().supabase_configured
        if get_settings().supabase_configured:
            try:
                get_supabase().table("content_templates").update(db_patch).eq("id", template_id).execute()
            except Exception:
                use_memory = True

        if use_memory:
            store = get_memory_store()
            found = False
            for clerk_key, t in self._all_memory_templates():
                if t.get("id") != template_id:
                    continue
                found = True
                if "name" in patch:
                    t["name"] = patch["name"]
                if "artifactType" in patch:
                    t["artifactType"] = patch["artifactType"]
                if "tags" in patch:
                    t["tags"] = patch["tags"]
                if "cssVariables" in patch:
                    t["cssVariables"] = patch["cssVariables"]
                if "pageCount" in patch:
                    t["pageCount"] = max(1, int(patch["pageCount"] or 1))
                if "metadata" in patch:
                    t["metadata"] = patch["metadata"] if isinstance(patch["metadata"], dict) else {}
                if "html" in patch:
                    t["status"] = "ready"
                    t["ingestError"] = None
                    store.content_template_html[f"{clerk_key}:{template_id}"] = patch["html"]
            if not found:
                return None

        return self.get_template(ctx, template_id)

    def finalize_template(
        self,
        ctx: TenantContext,
        template_id: str,
        *,
        html: str,
        css_variables: Dict[str, Any],
        page_count: int,
        thumbnail_bytes: Optional[bytes] = None,
        error: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        tenant_uuid = self.template_storage_tenant_uuid(ctx, template_id)
        settings = get_settings()
        status = "failed" if error and page_count <= 0 else "ready"
        ingest_error = error
        if error and page_count > 0:
            ingest_error = f"HTML conversion skipped: {error}"
        thumb_path: Optional[str] = None
        use_memory = not settings.supabase_configured
        if thumbnail_bytes and settings.supabase_configured:
            try:
                thumb_path = f"{tenant_uuid}/{template_id}/thumb.png"
                get_supabase().storage.from_(settings.content_templates_bucket).upload(
                    thumb_path,
                    thumbnail_bytes,
                    {"content-type": "image/png", "upsert": "true"},
                )
            except Exception:
                use_memory = True

        patch = {
            "status": status,
            "html": html if html else None,
            "css_variables": css_variables,
            "page_count": page_count,
            "ingest_error": ingest_error,
            "thumbnail_storage_path": thumb_path,
        }
        if metadata is not None:
            patch["metadata"] = metadata

        if settings.supabase_configured and not use_memory:
            try:
                get_supabase().table("content_templates").update(patch).eq("id", template_id).execute()
            except Exception:
                if "metadata" in patch:
                    try:
                        legacy_patch = {key: value for key, value in patch.items() if key != "metadata"}
                        get_supabase().table("content_templates").update(legacy_patch).eq("id", template_id).execute()
                        patch = legacy_patch
                    except Exception:
                        use_memory = True
                else:
                    use_memory = True
        if use_memory:
            store = get_memory_store()
            for clerk_key, t in self._all_memory_templates():
                if t["id"] == template_id:
                    merged = {
                        "id": template_id,
                        "name": t.get("name"),
                        "artifact_type": t.get("artifactType"),
                        "source_file_name": t.get("sourceFileName") or t.get("source_file_name"),
                        "source_storage_path": t.get("sourceStoragePath") or t.get("source_storage_path"),
                        "tags": t.get("tags") or [],
                        "metadata": t.get("metadata") or {},
                        "created_at": t.get("createdAt"),
                        **patch,
                    }
                    updated = _tpl_row_to_api(merged)
                    updated["sourceStoragePath"] = merged.get("source_storage_path")
                    updated["sourceFileName"] = merged.get("source_file_name")
                    t.update(updated)
                    t["status"] = status
            if thumbnail_bytes:
                thumb_path = f"{tenant_uuid}/{template_id}/thumb.png"
                store.content_template_files[thumb_path] = thumbnail_bytes
            if html:
                store.content_template_html[f"{clerk_key}:{template_id}"] = html

        row = self.get_template(ctx, template_id)
        return row or _tpl_row_to_api({"id": template_id, "name": "", "artifact_type": "deck", **patch})

    def download_template_source(self, ctx: TenantContext, storage_path: str) -> bytes:
        settings = get_settings()
        if settings.supabase_configured:
            try:
                return get_supabase().storage.from_(settings.content_templates_bucket).download(storage_path)
            except Exception:
                pass
        data = get_memory_store().content_template_files.get(storage_path)
        if not data:
            raise FileNotFoundError(storage_path)
        return data

    def get_template_row(self, ctx: TenantContext, template_id: str) -> Optional[Dict[str, Any]]:
        settings = get_settings()
        if settings.supabase_configured:
            try:
                row = (
                    get_supabase()
                    .table("content_templates")
                    .select("*")
                    .eq("id", template_id)
                    .limit(1)
                    .execute()
                )
                data = (row.data or [None])[0]
                if data:
                    return data
            except Exception:
                pass
        for _clerk_key, template in self._all_memory_templates():
            if template.get("id") == template_id:
                source_path = template.get("sourceStoragePath") or template.get("source_storage_path")
                return {
                    "id": template_id,
                    "name": template.get("name"),
                    "artifact_type": template.get("artifactType"),
                    "status": template.get("status"),
                    "page_count": template.get("pageCount", 1),
                    "source_file_name": template.get("sourceFileName") or template.get("source_file_name"),
                    "source_storage_path": source_path,
                    "metadata": template.get("metadata") or {},
                }
        return None

    def upload_template_blob(
        self,
        storage_path: str,
        file_bytes: bytes,
        *,
        content_type: str = "application/octet-stream",
    ) -> None:
        settings = get_settings()
        if settings.supabase_configured:
            try:
                get_supabase().storage.from_(settings.content_templates_bucket).upload(
                    storage_path,
                    file_bytes,
                    {"content-type": content_type, "upsert": "true"},
                )
                return
            except Exception:
                pass
        get_memory_store().content_template_files[storage_path] = file_bytes

    def save_template_preview_slides(
        self,
        ctx: TenantContext,
        template_id: str,
        slide_pngs: List[bytes],
    ) -> int:
        tenant_uuid = self.template_storage_tenant_uuid(ctx, template_id)
        for index, png in enumerate(slide_pngs, start=1):
            path = _template_slide_path(tenant_uuid, template_id, index)
            self.upload_template_blob(path, png, content_type="image/png")
        return len(slide_pngs)

    def download_template_slide(
        self,
        ctx: TenantContext,
        template_id: str,
        slide_index: int,
    ) -> bytes:
        tenant_uuid = self.template_storage_tenant_uuid(ctx, template_id)
        path = _template_slide_path(tenant_uuid, template_id, slide_index)
        return self.download_template_source(ctx, path)

    def get_template_source_file(
        self,
        ctx: TenantContext,
        template_id: str,
    ) -> Tuple[bytes, str, str]:
        storage_path = self.resolve_template_source_path(ctx, template_id)
        if not storage_path:
            raise FileNotFoundError(template_id)
        file_name = Path(storage_path).name
        row = self.get_template_row(ctx, template_id)
        if row and row.get("source_file_name"):
            file_name = str(row["source_file_name"])
        ext = Path(file_name).suffix.lower()
        data = self.download_template_source(ctx, storage_path)
        return data, file_name, _mime_for_ext(ext)

    def get_template_preview_pdf(self, ctx: TenantContext, template_id: str) -> Optional[bytes]:
        tenant_uuid = self.template_storage_tenant_uuid(ctx, template_id)
        path = f"{tenant_uuid}/{template_id}/preview.pdf"
        try:
            return self.download_template_source(ctx, path)
        except FileNotFoundError:
            return None

    def list_projects(self, ctx: TenantContext) -> List[Dict[str, Any]]:
        tenant_uuid, clerk_key = _tenant_keys(ctx)
        settings = get_settings()
        if settings.supabase_configured:
            try:
                rows = (
                    get_supabase()
                    .table("content_studio_projects")
                    .select("*")
                    .eq("tenant_id", tenant_uuid)
                    .order("updated_at", desc=True)
                    .execute()
                    .data
                    or []
                )
                return [_project_row_to_api(r) for r in rows]
            except Exception:
                pass
        return list(get_memory_store().content_projects.get(clerk_key, []))

    def get_project(self, ctx: TenantContext, project_id: str) -> Optional[Dict[str, Any]]:
        tenant_uuid, clerk_key = _tenant_keys(ctx)
        settings = get_settings()
        if settings.supabase_configured:
            try:
                rows = (
                    get_supabase()
                    .table("content_studio_projects")
                    .select("*")
                    .eq("tenant_id", tenant_uuid)
                    .eq("id", project_id)
                    .limit(1)
                    .execute()
                    .data
                    or []
                )
                if rows:
                    return _project_row_to_api(rows[0])
            except Exception:
                pass
        return next(
            (p for p in get_memory_store().content_projects.get(clerk_key, []) if p["id"] == project_id),
            None,
        )

    def create_project(
        self,
        ctx: TenantContext,
        *,
        title: str,
        artifact_type: str,
        template_id: Optional[str] = None,
        brief: Optional[Dict[str, Any]] = None,
        recommended_template_ids: Optional[List[str]] = None,
        call_id: Optional[str] = None,
        source_gap_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        if artifact_type not in ARTIFACT_TYPES:
            raise ValueError(f"Invalid artifact_type: {artifact_type}")
        tenant_uuid, clerk_key = _tenant_keys(ctx)
        project_id = str(uuid.uuid4())
        project_brief = dict(brief or {})
        if call_id:
            project_brief.setdefault("call_id", call_id)
        if source_gap_id:
            project_brief.setdefault("gap_id", source_gap_id)
        row = {
            "id": project_id,
            "tenant_id": tenant_uuid,
            "title": title,
            "artifact_type": artifact_type,
            "template_id": template_id,
            "status": "drafting",
            "brief": project_brief,
            "recommended_template_ids": recommended_template_ids or [],
            "created_by": ctx.user_id,
            "created_at": _now_iso(),
            "updated_at": _now_iso(),
        }
        use_memory = not get_settings().supabase_configured
        if get_settings().supabase_configured:
            try:
                get_supabase().table("content_studio_projects").insert(row).execute()
            except Exception as exc:
                _warn_memory_fallback("create_project", exc)
                use_memory = True
        if use_memory:
            api = _project_row_to_api(row)
            get_memory_store().content_projects.setdefault(clerk_key, []).append(api)
            get_memory_store().content_messages.setdefault(project_id, [])
        return _project_row_to_api(row)

    def update_project(
        self,
        ctx: TenantContext,
        project_id: str,
        patch: Dict[str, Any],
    ) -> Optional[Dict[str, Any]]:
        tenant_uuid, clerk_key = _tenant_keys(ctx)
        db_patch: Dict[str, Any] = {"updated_at": _now_iso()}
        if "templateId" in patch:
            db_patch["template_id"] = patch["templateId"]
        if "status" in patch:
            db_patch["status"] = patch["status"]
        if "brief" in patch:
            db_patch["brief"] = patch["brief"]
        if "recommendedTemplateIds" in patch:
            db_patch["recommended_template_ids"] = patch["recommendedTemplateIds"]
        if "costUsd" in patch:
            db_patch["cost_usd"] = patch["costUsd"]

        use_memory = not get_settings().supabase_configured
        if get_settings().supabase_configured:
            try:
                get_supabase().table("content_studio_projects").update(db_patch).eq("id", project_id).eq(
                    "tenant_id", tenant_uuid
                ).execute()
            except Exception as exc:
                _warn_memory_fallback("update_project", exc)
                use_memory = True
        if use_memory:
            for p in get_memory_store().content_projects.get(clerk_key, []):
                if p["id"] == project_id:
                    p.update({**patch, "updatedAt": _now_iso()[:19]})
        return self.get_project(ctx, project_id)

    def add_message(
        self,
        ctx: TenantContext,
        project_id: str,
        *,
        role: str,
        content: Dict[str, Any],
        turn_type: Optional[str] = None,
        trace_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        msg_id = str(uuid.uuid4())
        row = {
            "id": msg_id,
            "project_id": project_id,
            "role": role,
            "turn_type": turn_type,
            "content": content,
            "trace_id": trace_id,
            "created_at": _now_iso(),
        }
        use_memory = not get_settings().supabase_configured
        if get_settings().supabase_configured:
            try:
                get_supabase().table("content_studio_messages").insert(row).execute()
            except Exception as exc:
                _warn_memory_fallback("add_message", exc)
                use_memory = True
        if use_memory:
            get_memory_store().content_messages.setdefault(project_id, []).append(
                {
                    "id": msg_id,
                    "role": role,
                    "turnType": turn_type,
                    "content": content,
                    "traceId": trace_id,
                    "createdAt": row["created_at"][:19],
                }
            )
        return row

    def list_messages(self, ctx: TenantContext, project_id: str) -> List[Dict[str, Any]]:
        if get_settings().supabase_configured:
            try:
                rows = (
                    get_supabase()
                    .table("content_studio_messages")
                    .select("*")
                    .eq("project_id", project_id)
                    .order("created_at")
                    .execute()
                    .data
                    or []
                )
                return [
                    {
                        "id": str(r["id"]),
                        "role": r["role"],
                        "turnType": r.get("turn_type"),
                        "content": r.get("content") or {},
                        "createdAt": (r.get("created_at") or "")[:19],
                    }
                    for r in rows
                ]
            except Exception:
                pass
        return list(get_memory_store().content_messages.get(project_id, []))

    def create_revision(
        self,
        ctx: TenantContext,
        project_id: str,
        *,
        html: str,
        citations: List[Dict[str, Any]],
        template_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        rev_id = str(uuid.uuid4())
        row = {
            "id": rev_id,
            "project_id": project_id,
            "html": html,
            "citations": citations,
            "template_id": template_id,
            "created_at": _now_iso(),
        }
        use_memory = not get_settings().supabase_configured
        if get_settings().supabase_configured:
            try:
                get_supabase().table("content_studio_revisions").insert(row).execute()
            except Exception as exc:
                _warn_memory_fallback("create_revision", exc)
                use_memory = True
        if use_memory:
            get_memory_store().content_revisions.setdefault(project_id, []).append(
                {
                    "id": rev_id,
                    "html": html,
                    "citations": citations,
                    "templateId": template_id,
                    "createdAt": row["created_at"][:19],
                }
            )
        return {"id": rev_id, "projectId": project_id, "createdAt": row["created_at"][:19]}

    def restore_revision(self, ctx: TenantContext, project_id: str, revision_id: str) -> Optional[Dict[str, Any]]:
        revision = self.get_revision(ctx, revision_id)
        if not revision or revision.get("projectId") != project_id:
            return None
        restored = self.create_revision(
            ctx,
            project_id,
            html=str(revision.get("html") or ""),
            citations=revision.get("citations") or [],
            template_id=revision.get("templateId"),
        )
        self.update_project(
            ctx,
            project_id,
            {
                "status": "preview",
                "templateId": revision.get("templateId"),
            },
        )
        full = self.get_revision(ctx, restored["id"]) or restored
        return {"revision": full, "project": self.get_project(ctx, project_id)}

    def get_revision(self, ctx: TenantContext, revision_id: str) -> Optional[Dict[str, Any]]:
        if get_settings().supabase_configured:
            try:
                rows = (
                    get_supabase()
                    .table("content_studio_revisions")
                    .select("*")
                    .eq("id", revision_id)
                    .limit(1)
                    .execute()
                    .data
                    or []
                )
                if rows:
                    r = rows[0]
                    return {
                        "id": str(r["id"]),
                        "projectId": str(r["project_id"]),
                        "html": r["html"],
                        "citations": r.get("citations") or [],
                        "templateId": str(r["template_id"]) if r.get("template_id") else None,
                        "createdAt": (r.get("created_at") or "")[:19],
                    }
            except Exception:
                pass
        for revs in get_memory_store().content_revisions.values():
            for r in revs:
                if r["id"] == revision_id:
                    return r
        return None

    def list_revisions(self, ctx: TenantContext, project_id: str) -> List[Dict[str, Any]]:
        if get_settings().supabase_configured:
            try:
                rows = (
                    get_supabase()
                    .table("content_studio_revisions")
                    .select("id,project_id,created_at,template_id")
                    .eq("project_id", project_id)
                    .order("created_at", desc=True)
                    .execute()
                    .data
                    or []
                )
                return [
                    {
                        "id": str(r["id"]),
                        "projectId": str(r["project_id"]),
                        "templateId": str(r["template_id"]) if r.get("template_id") else None,
                        "createdAt": (r.get("created_at") or "")[:19],
                    }
                    for r in rows
                ]
            except Exception:
                pass
        return list(get_memory_store().content_revisions.get(project_id, []))

    def latest_revision(self, ctx: TenantContext, project_id: str) -> Optional[Dict[str, Any]]:
        revs = self.list_revisions(ctx, project_id)
        if not revs:
            return None
        return self.get_revision(ctx, revs[0]["id"])

    def create_export(
        self,
        ctx: TenantContext,
        revision_id: str,
        *,
        fmt: str,
        file_bytes: bytes,
    ) -> Dict[str, Any]:
        tenant_uuid, _ = _tenant_keys(ctx)
        settings = get_settings()
        export_id = str(uuid.uuid4())
        storage_path = f"{tenant_uuid}/{revision_id}/{export_id}.{fmt}"
        use_memory = not settings.supabase_configured
        if settings.supabase_configured:
            try:
                get_supabase().storage.from_(settings.content_exports_bucket).upload(
                    storage_path,
                    file_bytes,
                    {"content-type": _export_mime(fmt), "upsert": "true"},
                )
                get_supabase().table("content_exports").insert(
                    {
                        "id": export_id,
                        "revision_id": revision_id,
                        "format": fmt,
                        "storage_path": storage_path,
                        "byte_size": len(file_bytes),
                    }
                ).execute()
                signed = self._signed_url(settings.content_exports_bucket, storage_path)
            except Exception as exc:
                _warn_memory_fallback("create_export", exc)
                use_memory = True
                signed = ""
        else:
            signed = ""
        if use_memory:
            get_memory_store().content_exports[storage_path] = file_bytes
            signed = f"memory://{storage_path}"

        return {
            "id": export_id,
            "format": fmt,
            "downloadUrl": signed,
            "byteSize": len(file_bytes),
        }

    def _signed_url(self, bucket: str, path: str, expires_in: int = 300) -> str:
        try:
            return get_supabase().storage.from_(bucket).create_signed_url(path, expires_in)["signedURL"]
        except Exception:
            return ""

    def list_kb_asset_ids(self, ctx: TenantContext) -> set:
        from app.domain.kb_repository import get_kb_repository

        return {a["id"] for a in get_kb_repository().list_assets(ctx)}

    def delete_project(self, ctx: TenantContext, project_id: str) -> bool:
        tenant_uuid, clerk_key = _tenant_keys(ctx)
        deleted = False
        if get_settings().supabase_configured:
            try:
                res = (
                    get_supabase()
                    .table("content_studio_projects")
                    .delete()
                    .eq("tenant_id", tenant_uuid)
                    .eq("id", project_id)
                    .execute()
                )
                deleted = bool(res.data)
            except Exception:
                deleted = False

        if not deleted:
            store = get_memory_store()
            before = len(store.content_projects.get(clerk_key, []))
            store.content_projects[clerk_key] = [
                p for p in store.content_projects.get(clerk_key, []) if p.get("id") != project_id
            ]
            store.content_messages.pop(project_id, None)
            store.content_revisions.pop(project_id, None)
            deleted = len(store.content_projects.get(clerk_key, [])) < before
        return deleted

    def delete_template(self, ctx: TenantContext, template_id: str) -> bool:
        settings = get_settings()
        deleted = False
        if settings.supabase_configured:
            try:
                row = (
                    get_supabase()
                    .table("content_templates")
                    .select("source_storage_path,thumbnail_storage_path")
                    .eq("id", template_id)
                    .limit(1)
                    .execute()
                    .data
                    or []
                )
                res = (
                    get_supabase()
                    .table("content_templates")
                    .delete()
                    .eq("id", template_id)
                    .execute()
                )
                deleted = bool(res.data)
                if deleted and row:
                    source_path = row[0].get("source_storage_path")
                    thumb_path = row[0].get("thumbnail_storage_path")
                    paths = [p for p in [source_path, thumb_path] if p]
                    if paths:
                        try:
                            get_supabase().storage.from_(settings.content_templates_bucket).remove(paths)
                        except Exception:
                            pass
            except Exception:
                deleted = False

        if not deleted:
            store = get_memory_store()
            for clerk_key, items in list(store.content_templates.items()):
                before = len(items)
                kept = []
                for t in items:
                    if t.get("id") == template_id:
                        store.content_template_html.pop(f"{clerk_key}:{template_id}", None)
                    else:
                        kept.append(t)
                store.content_templates[clerk_key] = kept
                deleted = deleted or len(kept) < before
        return deleted


def _ext_to_artifact(ext: str) -> str:
    if ext in {".png", ".jpg", ".jpeg"}:
        return "image"
    if ext == ".pdf":
        return "one_pager"
    return "deck"


def _mime_for_ext(ext: str) -> str:
    return {
        ".pdf": "application/pdf",
        ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        ".ppt": "application/vnd.ms-powerpoint",
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
    }.get(ext, "application/octet-stream")


def _export_mime(fmt: str) -> str:
    return {
        "pdf": "application/pdf",
        "png": "image/png",
        "pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    }.get(fmt, "application/octet-stream")


@lru_cache
def get_content_studio_repository() -> ContentStudioRepository:
    return ContentStudioRepository()
