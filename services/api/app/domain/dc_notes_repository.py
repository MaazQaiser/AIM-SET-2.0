from __future__ import annotations

from functools import lru_cache
from typing import Any, Dict, List, Literal

from dc_core.tenancy import TenantContext
from dc_embeddings.client import EmbeddingClient

from app.config import get_settings
from app.deps import get_supabase
from app.domain.memory_store import get_memory_store
from app.domain.tenant_service import get_tenant_service


def _dc_asset_id(kind: Literal["pre-dc", "post-dc"], record_id: str) -> str:
    return f"dc:{kind}:{record_id}"


def _record_chunk_text(kind: Literal["pre-dc", "post-dc"], fields: Dict[str, Any]) -> str:
    lines = [f"[{kind} discovery notes]"]
    for key, value in fields.items():
        text = str(value or "").strip()
        if text:
            lines.append(f"{key}: {text}")
    return "\n".join(lines)


class DcNotesRepository:
    """Pre/Post-DC records in Supabase (or in-memory when Supabase is unset)."""

    def __init__(self) -> None:
        self._tenants = get_tenant_service()

    def _tenant_keys(self, ctx: TenantContext) -> tuple[str, str]:
        tenant_uuid, clerk_key = self._tenants.resolve(ctx)
        return tenant_uuid, clerk_key

    def get_notes(self, ctx: TenantContext) -> Dict[str, List[Dict[str, Any]]]:
        tenant_uuid, clerk_key = self._tenant_keys(ctx)
        settings = get_settings()

        if settings.supabase_configured:
            try:
                supabase = get_supabase()
                pre_result = (
                    supabase.table("pre_dc_records")
                    .select("id, fields")
                    .eq("tenant_id", tenant_uuid)
                    .execute()
                )
                post_result = (
                    supabase.table("post_dc_records")
                    .select("id, matched_call_id, fields")
                    .eq("tenant_id", tenant_uuid)
                    .execute()
                )
                return {
                    "pre_dc_records": pre_result.data or [],
                    "post_dc_records": post_result.data or [],
                }
            except Exception as exc:
                raise RuntimeError(f"Failed to load DC notes from Supabase: {exc}") from exc

        store = get_memory_store()
        return {
            "pre_dc_records": store.list_pre_dc_records(clerk_key),
            "post_dc_records": store.list_post_dc_records(clerk_key),
        }

    def upsert_pre_dc(self, ctx: TenantContext, rows: List[Dict[str, Any]]) -> int:
        return self._upsert(ctx, "pre-dc", "pre_dc_records", rows)

    def upsert_post_dc(self, ctx: TenantContext, rows: List[Dict[str, Any]]) -> int:
        return self._upsert(ctx, "post-dc", "post_dc_records", rows)

    def _upsert(
        self,
        ctx: TenantContext,
        kind: Literal["pre-dc", "post-dc"],
        table: str,
        rows: List[Dict[str, Any]],
    ) -> int:
        tenant_uuid, clerk_key = self._tenant_keys(ctx)
        settings = get_settings()

        if settings.supabase_configured:
            try:
                supabase = get_supabase()
                payload = [{**row, "tenant_id": tenant_uuid} for row in rows]
                supabase.table(table).upsert(payload).execute()
                self._embed_records(tenant_uuid, kind, rows)
                return len(rows)
            except Exception as exc:
                raise RuntimeError(f"Failed to save DC notes to Supabase: {exc}") from exc

        store = get_memory_store()
        if kind == "pre-dc":
            store.upsert_pre_dc_records(clerk_key, rows)
        else:
            store.upsert_post_dc_records(clerk_key, rows)
        self._embed_records_memory(clerk_key, kind, rows)
        return len(rows)

    def _embed_records(
        self,
        tenant_uuid: str,
        kind: Literal["pre-dc", "post-dc"],
        rows: List[Dict[str, Any]],
    ) -> None:
        settings = get_settings()
        texts: List[str] = []
        chunk_rows: List[Dict[str, Any]] = []

        for row in rows:
            record_id = str(row["id"])
            fields = row.get("fields") or {}
            asset_id = _dc_asset_id(kind, record_id)
            text = _record_chunk_text(kind, fields)
            texts.append(text)

            metadata: Dict[str, Any] = {
                "source": "dc_note",
                "kind": kind,
                "record_id": record_id,
            }
            if kind == "pre-dc":
                metadata["company"] = fields.get("Company Name-PreDC", "")
            if kind == "post-dc":
                metadata["matched_call_id"] = row.get("matched_call_id")
                metadata["lead_stage"] = fields.get("Lead Stage", "")

            chunk_rows.append(
                {
                    "tenant_id": tenant_uuid,
                    "asset_id": asset_id,
                    "chunk_text": text,
                    "chunk_index": 0,
                    "metadata": metadata,
                }
            )

        if not texts:
            return

        try:
            client = EmbeddingClient(api_key=settings.openai_api_key or None)
            embeddings = client.embed(texts).embeddings
        except Exception:
            return

        supabase = get_supabase()
        for chunk, embedding in zip(chunk_rows, embeddings):
            asset_id = chunk["asset_id"]
            supabase.table("kb_chunks").delete().eq("tenant_id", tenant_uuid).eq("asset_id", asset_id).execute()
            chunk["embedding"] = embedding
            supabase.table("kb_chunks").insert(chunk).execute()

    def _embed_records_memory(
        self,
        clerk_key: str,
        kind: Literal["pre-dc", "post-dc"],
        rows: List[Dict[str, Any]],
    ) -> None:
        settings = get_settings()
        if not rows:
            return

        texts = [_record_chunk_text(kind, row.get("fields") or {}) for row in rows]
        try:
            client = EmbeddingClient(api_key=settings.openai_api_key or None)
            embeddings = client.embed(texts).embeddings
        except Exception:
            return

        store = get_memory_store()
        existing = [c for c in store.kb_chunks.get(clerk_key, []) if not str(c.get("asset_id", "")).startswith(f"dc:{kind}:")]
        for row, embedding in zip(rows, embeddings):
            record_id = str(row["id"])
            existing.append(
                {
                    "asset_id": _dc_asset_id(kind, record_id),
                    "chunk_text": _record_chunk_text(kind, row.get("fields") or {}),
                    "embedding": embedding,
                    "metadata": {"source": "dc_note", "kind": kind, "record_id": record_id},
                }
            )
        store.kb_chunks[clerk_key] = existing


@lru_cache
def get_dc_notes_repository() -> DcNotesRepository:
    return DcNotesRepository()
