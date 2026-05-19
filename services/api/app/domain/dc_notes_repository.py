from __future__ import annotations

from functools import lru_cache
from typing import Any, Dict, List, Literal

from dc_core.tenancy import TenantContext
from dc_embeddings.client import EmbeddingClient

from app.config import get_settings
from app.deps import get_supabase
from app.domain.tenant_service import get_tenant_service


def _require_supabase() -> None:
    if not get_settings().supabase_configured:
        raise RuntimeError(
            "Supabase is required for DC notes. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in services/api/.env"
        )


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
    """Pre/Post-DC records in Supabase Postgres; each row embedded into kb_chunks (pgvector)."""

    def __init__(self) -> None:
        self._tenants = get_tenant_service()

    def _tenant_uuid(self, ctx: TenantContext) -> str:
        tenant_uuid, _ = self._tenants.resolve(ctx)
        return tenant_uuid

    def get_notes(self, ctx: TenantContext) -> Dict[str, List[Dict[str, Any]]]:
        _require_supabase()
        tenant_uuid = self._tenant_uuid(ctx)
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
        _require_supabase()
        tenant_uuid = self._tenant_uuid(ctx)
        supabase = get_supabase()

        for row in rows:
            row["tenant_id"] = tenant_uuid

        supabase.table(table).upsert(rows).execute()
        self._embed_records(tenant_uuid, kind, rows)
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

        client = EmbeddingClient(api_key=settings.openai_api_key or None)
        embeddings = client.embed(texts).embeddings

        supabase = get_supabase()
        for chunk, embedding in zip(chunk_rows, embeddings):
            asset_id = chunk["asset_id"]
            supabase.table("kb_chunks").delete().eq("tenant_id", tenant_uuid).eq("asset_id", asset_id).execute()
            chunk["embedding"] = embedding
            supabase.table("kb_chunks").insert(chunk).execute()


@lru_cache
def get_dc_notes_repository() -> DcNotesRepository:
    return DcNotesRepository()
