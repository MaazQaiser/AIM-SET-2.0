from __future__ import annotations

import uuid
from datetime import datetime, timezone
from functools import lru_cache
from typing import Any, Dict, List, Optional, Tuple

from dc_core.tenancy import TenantContext

from app.config import get_settings
from app.deps import get_supabase
from app.domain.memory_store import get_memory_store
from app.domain.tenant_service import get_tenant_service

TEMPLATE_EXTENSIONS = {".pptx", ".ppt", ".pdf", ".png", ".jpg", ".jpeg"}
ARTIFACT_TYPES = frozenset({"deck", "one_pager", "image"})


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _tenant_keys(ctx: TenantContext) -> Tuple[str, str]:
    return get_tenant_service().resolve(ctx)


def _tpl_row_to_api(row: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "id": str(row["id"]),
        "name": row["name"],
        "artifactType": row["artifact_type"],
        "status": row.get("status", "ready"),
        "pageCount": row.get("page_count", 1),
        "tags": row.get("tags") or [],
        "thumbnailUrl": row.get("thumbnail_url"),
        "cssVariables": row.get("css_variables") or {},
        "createdAt": (row.get("created_at") or _now_iso())[:19],
        "ingestError": row.get("ingest_error"),
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


class ContentStudioRepository:
    def __init__(self) -> None:
        self._tenants = get_tenant_service()

    def list_templates(
        self,
        ctx: TenantContext,
        *,
        artifact_type: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        tenant_uuid, clerk_key = _tenant_keys(ctx)
        settings = get_settings()
        if settings.supabase_configured:
            try:
                q = (
                    get_supabase()
                    .table("content_templates")
                    .select("id,name,artifact_type,status,page_count,tags,thumbnail_storage_path,css_variables,created_at,ingest_error")
                    .eq("tenant_id", tenant_uuid)
                    .order("created_at", desc=True)
                )
                if artifact_type:
                    q = q.eq("artifact_type", artifact_type)
                rows = q.execute().data or []
                out = []
                for r in rows:
                    api = _tpl_row_to_api(r)
                    if r.get("thumbnail_storage_path"):
                        api["thumbnailUrl"] = self._signed_url(
                            settings.content_templates_bucket,
                            r["thumbnail_storage_path"],
                        )
                    out.append(api)
                return out
            except Exception:
                pass
        store = get_memory_store()
        items = store.content_templates.get(clerk_key, [])
        if artifact_type:
            items = [t for t in items if t.get("artifactType") == artifact_type]
        return items

    def get_template(self, ctx: TenantContext, template_id: str) -> Optional[Dict[str, Any]]:
        tenant_uuid, clerk_key = _tenant_keys(ctx)
        settings = get_settings()
        if settings.supabase_configured:
            try:
                row = (
                    get_supabase()
                    .table("content_templates")
                    .select("*")
                    .eq("tenant_id", tenant_uuid)
                    .eq("id", template_id)
                    .limit(1)
                    .execute()
                )
                data = (row.data or [None])[0]
                if not data:
                    return None
                api = _tpl_row_to_api(data)
                api["html"] = data.get("html") or ""
                return api
            except Exception:
                pass
        for t in get_memory_store().content_templates.get(clerk_key, []):
            if t["id"] == template_id:
                full = get_memory_store().content_template_html.get(f"{clerk_key}:{template_id}")
                return {**t, "html": full or ""}
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
        tenant_uuid, clerk_key = _tenant_keys(ctx)
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
                supabase.table("content_templates").insert(row).execute()
            except Exception:
                use_memory = True
        if use_memory:
            store = get_memory_store()
            store.content_template_files[storage_path] = file_bytes
            api = _tpl_row_to_api(row)
            store.content_templates.setdefault(clerk_key, []).append(api)

        return {"template": _tpl_row_to_api(row), "storagePath": storage_path}

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
    ) -> Dict[str, Any]:
        tenant_uuid, clerk_key = _tenant_keys(ctx)
        settings = get_settings()
        status = "failed" if error else "ready"
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
            "html": html if not error else None,
            "css_variables": css_variables,
            "page_count": page_count,
            "ingest_error": error,
            "thumbnail_storage_path": thumb_path,
        }

        if settings.supabase_configured and not use_memory:
            try:
                get_supabase().table("content_templates").update(patch).eq("id", template_id).eq(
                    "tenant_id", tenant_uuid
                ).execute()
            except Exception:
                use_memory = True
        if use_memory:
            store = get_memory_store()
            for t in store.content_templates.get(clerk_key, []):
                if t["id"] == template_id:
                    t.update(_tpl_row_to_api({**t, **patch, "artifact_type": t["artifactType"]}))
                    t["status"] = status
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
    ) -> Dict[str, Any]:
        if artifact_type not in ARTIFACT_TYPES:
            raise ValueError(f"Invalid artifact_type: {artifact_type}")
        tenant_uuid, clerk_key = _tenant_keys(ctx)
        project_id = str(uuid.uuid4())
        row = {
            "id": project_id,
            "tenant_id": tenant_uuid,
            "title": title,
            "artifact_type": artifact_type,
            "status": "drafting",
            "brief": {},
            "created_by": ctx.user_id,
            "created_at": _now_iso(),
            "updated_at": _now_iso(),
        }
        use_memory = not get_settings().supabase_configured
        if get_settings().supabase_configured:
            try:
                get_supabase().table("content_studio_projects").insert(row).execute()
            except Exception:
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
            except Exception:
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
            except Exception:
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
            except Exception:
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
            except Exception:
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
        tenant_uuid, clerk_key = _tenant_keys(ctx)
        settings = get_settings()
        deleted = False
        if settings.supabase_configured:
            try:
                row = (
                    get_supabase()
                    .table("content_templates")
                    .select("source_storage_path,thumbnail_storage_path")
                    .eq("tenant_id", tenant_uuid)
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
                    .eq("tenant_id", tenant_uuid)
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
            before = len(store.content_templates.get(clerk_key, []))
            kept = []
            for t in store.content_templates.get(clerk_key, []):
                if t.get("id") == template_id:
                    store.content_template_html.pop(f"{clerk_key}:{template_id}", None)
                else:
                    kept.append(t)
            store.content_templates[clerk_key] = kept
            deleted = len(kept) < before
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
