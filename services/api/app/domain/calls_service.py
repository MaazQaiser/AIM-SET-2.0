from __future__ import annotations

import re
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from dc_core.tenancy import TenantContext

from app.config import get_settings
from app.deps import get_supabase
from app.domain.dc_notes_repository import get_dc_notes_repository
from app.domain.memory_store import get_memory_store
from app.domain.supabase_utils import execute_with_retry
from app.domain.bant_authority import infer_authority_from_lead_title
from app.domain.brief_summary_sections import apply_summary_titles_to_brief
from app.domain.post_dc_import import (
    apply_post_dc_records,
    build_post_call_payload_from_import,
    post_dc_record_for_call,
)
from app.domain.post_dc_transcript_builder import build_transcript_events_from_post_dc
from app.domain.kb_tenancy import resolve_team_tenant
from app.domain.live_call_repository import get_live_call_repository


def slugify_company(name: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")[:56]
    return f"call-{slug}" if slug else f"call-{int(datetime.now().timestamp())}"


def call_id_aliases(call_id: str) -> List[str]:
    """Support legacy demo URLs that omit the persisted `call-` prefix."""
    aliases = [call_id]
    if call_id.startswith("call-"):
        aliases.append(call_id.removeprefix("call-"))
    else:
        aliases.append(f"call-{call_id}")
    return list(dict.fromkeys(aliases))


def _asset_ref_matches(item: Any, asset_id: str) -> bool:
    if not isinstance(item, dict):
        return False
    for key in (
        "assetId",
        "asset_id",
        "kbAssetId",
        "kb_asset_id",
        "sourceAssetId",
        "source_asset_id",
    ):
        if str(item.get(key) or "").strip() == asset_id:
            return True
    return False


def _asset_match_item_matches(item: Any, asset_id: str) -> bool:
    if _asset_ref_matches(item, asset_id):
        return True
    return isinstance(item, dict) and str(item.get("id") or "").strip() == asset_id


def _brief_suggests_asset(payload: Any, asset_id: str) -> bool:
    if not isinstance(payload, dict):
        return False

    if _asset_ref_matches(payload.get("recommendedDeck"), asset_id):
        return True
    if any(_asset_ref_matches(doc, asset_id) for doc in payload.get("relevantDocuments") or []):
        return True
    if any(_asset_ref_matches(item, asset_id) for item in payload.get("artifactFulfillment") or []):
        return True
    if any(_asset_ref_matches(item, asset_id) for item in payload.get("kbSuggestions") or []):
        return True

    for item in payload.get("contentToGenerate") or []:
        if not isinstance(item, dict):
            continue
        if _asset_ref_matches(item.get("recommendedDeck"), asset_id):
            return True
        if any(_asset_ref_matches(doc, asset_id) for doc in item.get("relevantDocuments") or []):
            return True
        if any(_asset_match_item_matches(match, asset_id) for match in item.get("kbMatches") or []):
            return True
        if any(_asset_ref_matches(source, asset_id) for source in item.get("evidence") or []):
            return True

    return False


def _memory_fallback_clerk_key(ctx: TenantContext) -> str:
    settings = get_settings()
    if settings.kb_shared_mode:
        return settings.kb_shared_tenant_key.strip() or "dc-copilot-shared"
    return ctx.clerk_org_id or ctx.tenant_id or ctx.user_id or "local-dev"


def _memory_clerk_aliases(ctx: TenantContext, primary: str | None = None) -> List[str]:
    candidates = [
        primary,
        ctx.clerk_org_id,
        ctx.tenant_id,
        ctx.user_id,
        _memory_fallback_clerk_key(ctx),
    ]
    return [str(item) for item in dict.fromkeys(c for c in candidates if c)]


def _field_text(fields: Dict[str, Any], *keys: str) -> str:
    for key in keys:
        value = fields.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return ""


_COMPANY_STAGES = ("SMB", "Ideation", "Startup", "Funded Startup", "Enterprise")
_CALL_STATUSES = {"upcoming", "live", "completed", "no-show"}


def _hash_seed(value: str) -> int:
    h = 0
    for ch in value:
        h = (h * 31 + ord(ch)) & 0xFFFFFFFF
    return abs(h)


def _normalize_company_stage(
    fields: Dict[str, Any],
    *,
    call_id: str,
) -> str:
    combined = " ".join(
        [
            _field_text(fields, "Company Stage", "Company Stage-PreDC"),
            _field_text(fields, "Company Type ICP - PreDC"),
            _field_text(fields, "ICP Bucket"),
        ]
    ).lower()

    funding_stage = _field_text(fields, "If its a startup, what Stage of Funding?").lower()
    funding_amount = _field_text(fields, "If its startup, funding amount received?").lower()
    funding_blob = f"{funding_stage} {funding_amount}"

    if any(
        token in combined
        for token in ("enterprise", "enterprice", "desirable", "fortune", "large cap")
    ):
        return "Enterprise"
    if (
        "funded startup" in combined
        or "funded start-up" in combined
        or "venture" in combined
        or any(token in combined for token in ("series a", "series b", "series c", "series d"))
        or (funding_amount and ("seed" in funding_blob or "series" in funding_blob))
    ):
        return "Funded Startup"
    if any(
        token in combined
        for token in ("startup", "start-up", "seed", "early stage")
    ):
        return "Startup"
    if any(
        token in combined
        for token in ("ideation", "evaluation", "discovery", "active opportunity")
    ):
        return "Ideation"
    if any(token in combined for token in ("smb", "small business", "sme", "small cap")):
        return "SMB"

    revenue = _field_text(fields, "Annual Revenue - PreDC").lower()
    if "b" in revenue or "million" in revenue or "180m" in revenue:
        return "Enterprise"

    return _COMPANY_STAGES[_hash_seed(call_id) % len(_COMPANY_STAGES)]


def _icp_score_from_bucket(bucket: str) -> float:
    normalized = bucket.strip().lower()
    if not normalized:
        return 0.55
    if "enterprise" in normalized or "desirable" in normalized:
        return 0.88
    if "sweet spot" in normalized or "sweet" in normalized:
        return 0.78
    if "potential" in normalized:
        return 0.62
    return 0.55


def _deal_stage_from_fields(fields: Dict[str, Any], *, call_id: str) -> str:
    return _normalize_company_stage(fields, call_id=call_id)


def _resolve_call_status(
    persisted_status: Optional[str],
    imported_status: Optional[str],
) -> str:
    """Resolve competing status sources without letting Pre-DC import rewind a call."""
    persisted = persisted_status if persisted_status in _CALL_STATUSES else None
    imported = imported_status if imported_status in _CALL_STATUSES else None
    if persisted == "completed" or imported == "completed":
        return "completed"
    if persisted == "no-show" or imported == "no-show":
        return "no-show"
    if persisted == "live" or imported == "live":
        return "live"
    return persisted or imported or "upcoming"


def build_calls_from_pre_dc(
    pre_rows: List[Dict[str, Any]], post_rows: List[Dict[str, Any]]
) -> List[Dict[str, Any]]:
    calls: List[Dict[str, Any]] = []
    for row in pre_rows:
        fields = row.get("fields") or {}
        company = (fields.get("Company Name-PreDC") or "").strip()
        if not company:
            continue
        call_id = slugify_company(company)
        icp_bucket = _field_text(fields, "ICP Bucket")
        annual_revenue = _field_text(fields, "Annual Revenue - PreDC")
        employee_count = _field_text(fields, "No. of Employees - PreDC")
        lead_title = _field_text(fields, "Prospect's Persona")
        calls.append(
            {
                "id": call_id,
                "accountName": company,
                "scheduledAt": datetime.now(timezone.utc).isoformat(),
                "status": "upcoming",
                "briefReady": True,
                "pod": [],
                "bant": {
                    "budget": "unknown",
                    "authority": infer_authority_from_lead_title(lead_title),
                    "need": "unknown",
                    "timeline": "unknown",
                },
                "leadName": _field_text(fields, "Lead Name-PreDC"),
                "leadTitle": lead_title,
                "industry": _field_text(fields, "Industry - PreDC"),
                "annualRevenueRaw": annual_revenue or None,
                "employeeCount": employee_count or None,
                "companyTypeIcp": _field_text(fields, "Company Type ICP - PreDC") or None,
                "dealStage": _deal_stage_from_fields(fields, call_id=call_id),
                "icpBucket": icp_bucket or None,
                "icpMatch": _icp_score_from_bucket(icp_bucket),
                "discoveryCallDatePkt": _field_text(fields, "Discovery Call Date (PKT)") or None,
                "discoveryCallTimePkt": _field_text(fields, "Discovery Call Time (PKT)") or None,
                "meetingUrl": _meeting_url_from_fields(fields),
            }
        )

    if post_rows:
        calls, _ = apply_post_dc_records(calls, post_rows, pre_rows)

    return calls


class CallsService:
    def __init__(self) -> None:
        self._dc = get_dc_notes_repository()

    def _tenant_uuid(self, ctx: TenantContext) -> str:
        tenant_uuid, _ = resolve_team_tenant(ctx)
        return tenant_uuid

    def _clerk_key(self, ctx: TenantContext) -> str:
        try:
            _, clerk_key = resolve_team_tenant(ctx, allow_memory_fallback=True)
            return clerk_key
        except Exception:
            return _memory_fallback_clerk_key(ctx)

    def _read_tenant_keys(self, ctx: TenantContext) -> tuple[str, str]:
        return resolve_team_tenant(ctx, allow_memory_fallback=True)

    def _fallback_clerk_key(self, ctx: TenantContext) -> str:
        settings = get_settings()
        if getattr(settings, "kb_shared_mode", False):
            return (getattr(settings, "kb_shared_tenant_key", "") or "dc-copilot-shared").strip()
        return ctx.clerk_org_id or ctx.tenant_id or ctx.user_id or "local-dev"

    def _memory_keys(self, ctx: TenantContext, clerk_key: str) -> List[str]:
        fallback = self._fallback_clerk_key(ctx)
        return list(dict.fromkeys([clerk_key, fallback]))

    def _save_post_review_memory(
        self, ctx: TenantContext, clerk_key: str, call_id: str, payload: Dict[str, Any]
    ) -> None:
        for key in self._memory_keys(ctx, clerk_key):
            get_memory_store().save_post_review(key, call_id, payload)

    def _save_post_review_call_memory(
        self, ctx: TenantContext, clerk_key: str, call_id: str, payload: Dict[str, Any]
    ) -> None:
        for key in self._memory_keys(ctx, clerk_key):
            calls = get_memory_store().list_calls(key)
            call = next((item for item in calls if item.get("id") == call_id), None)
            if not call:
                call = {"id": call_id, "accountName": call_id, "briefReady": False}
            meta = call.get("metadata") or {}
            if not isinstance(meta, dict):
                meta = {}
            meta["post_call"] = payload
            call["metadata"] = meta
            call["status"] = "completed"
            get_memory_store().upsert_calls(key, [call])

    def _save_live_signals_memory(
        self, ctx: TenantContext, clerk_key: str, call_id: str, snapshot: Dict[str, Any]
    ) -> None:
        for key in self._memory_keys(ctx, clerk_key):
            get_memory_store().save_live_signals(key, call_id, snapshot)

    def sync_from_dc_notes(self, ctx: TenantContext) -> List[Dict[str, Any]]:
        notes = self._dc.get_notes(ctx)
        calls = build_calls_from_pre_dc(notes["pre_dc_records"], notes["post_dc_records"])
        _, enriched_posts = apply_post_dc_records(
            calls,
            notes["post_dc_records"],
            notes["pre_dc_records"],
        )
        if enriched_posts:
            self._dc.upsert_post_dc(ctx, enriched_posts)
        self._seed_post_dc_transcripts(ctx, enriched_posts, notes["pre_dc_records"])
        self._persist_calls(ctx, calls)
        return calls

    def _seed_post_dc_transcripts(
        self,
        ctx: TenantContext,
        post_rows: List[Dict[str, Any]],
        _pre_rows: List[Dict[str, Any]],
    ) -> None:
        if not post_rows:
            return
        repo = get_live_call_repository()
        for row in post_rows:
            matched_call_id = row.get("matched_call_id")
            if not matched_call_id:
                continue
            if repo.list_transcript_events(ctx, matched_call_id, limit=1):
                continue
            for event in build_transcript_events_from_post_dc(matched_call_id, row):
                repo.append_transcript_event(ctx, matched_call_id, event)

    def _persist_calls(self, ctx: TenantContext, calls: List[Dict[str, Any]]) -> None:
        if not calls:
            return
        clerk_key = self._clerk_key(ctx)
        if not get_settings().supabase_configured:
            get_memory_store().upsert_calls(clerk_key, calls)
            return
        tenant_uuid = self._tenant_uuid(ctx)
        supabase = get_supabase()
        rows = [
            {
                "id": c["id"],
                "tenant_id": tenant_uuid,
                "account_slug": c["id"],
                "account_name": c["accountName"],
                "scheduled_at": c.get("scheduledAt") or datetime.now(timezone.utc).isoformat(),
                "status": c.get("status", "upcoming"),
                "brief_ready": bool(c.get("briefReady")),
                "metadata": {
                    "leadName": c.get("leadName"),
                    "leadTitle": c.get("leadTitle"),
                    "industry": c.get("industry"),
                    "annualRevenueRaw": c.get("annualRevenueRaw"),
                    "employeeCount": c.get("employeeCount"),
                    "companyTypeIcp": c.get("companyTypeIcp"),
                    "dealStage": c.get("dealStage"),
                    "icpBucket": c.get("icpBucket"),
                    "icpMatch": c.get("icpMatch"),
                    "discoveryCallDatePkt": c.get("discoveryCallDatePkt"),
                    "discoveryCallTimePkt": c.get("discoveryCallTimePkt"),
                    "meetingUrl": c.get("meetingUrl"),
                },
            }
            for c in calls
        ]
        if rows:
            supabase.table("calls").upsert(rows).execute()

    def mark_call_status(
        self,
        ctx: TenantContext,
        call_id: str,
        status: str,
    ) -> Dict[str, Any]:
        if status not in _CALL_STATUSES:
            raise ValueError(f"Unsupported call status: {status}")

        try:
            clerk_key = self._clerk_key(ctx)
        except Exception:
            clerk_key = self._fallback_clerk_key(ctx)

        call = self.get_call(ctx, call_id) or {
            "id": call_id,
            "accountName": call_id,
            "scheduledAt": datetime.now(timezone.utc).isoformat(),
            "briefReady": False,
            "pod": [],
        }
        call["status"] = status

        for tenant_key in _memory_clerk_aliases(ctx, clerk_key):
            get_memory_store().upsert_calls(tenant_key, [call])

        if get_settings().supabase_configured:
            try:
                self._persist_calls(ctx, [call])
            except Exception:
                pass

        return call

    def mark_call_completed(self, ctx: TenantContext, call_id: str) -> Dict[str, Any]:
        return self.mark_call_status(ctx, call_id, "completed")

    def list_calls(self, ctx: TenantContext) -> List[Dict[str, Any]]:
        tenant_uuid, clerk_key = self._read_tenant_keys(ctx)
        if not get_settings().supabase_configured:
            mem_calls: List[Dict[str, Any]] = []
            seen: set[str] = set()
            for key in _memory_clerk_aliases(ctx, clerk_key):
                for call in get_memory_store().list_calls(key):
                    cid = str(call.get("id") or "")
                    if cid and cid in seen:
                        continue
                    if cid:
                        seen.add(cid)
                    mem_calls.append(call)
            if mem_calls:
                return self._merge_calls_with_dc_notes(ctx, mem_calls)
            return self.sync_from_dc_notes(ctx)
        supabase = get_supabase()
        try:
            result = execute_with_retry(
                lambda: (
                    supabase.table("calls")
                    .select("id, account_name, scheduled_at, status, brief_ready, metadata")
                    .eq("tenant_id", tenant_uuid)
                    .order("scheduled_at", desc=True)
                    .execute()
                )
            )
        except Exception:
            mem_calls = get_memory_store().list_calls(clerk_key)
            if mem_calls:
                return self._merge_calls_with_dc_notes(ctx, mem_calls)
            return []
        rows = result.data or []
        if rows:
            calls = [_row_to_call(r) for r in rows]
            calls = self._merge_calls_with_dc_notes(ctx, calls)
            get_memory_store().upsert_calls(clerk_key, calls)
            return calls

        return self.sync_from_dc_notes(ctx)

    def _merge_calls_with_dc_notes(
        self, ctx: TenantContext, calls: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        notes = self._dc.get_notes(ctx)
        if not notes["pre_dc_records"]:
            return calls

        dc_calls = build_calls_from_pre_dc(notes["pre_dc_records"], notes["post_dc_records"])
        dc_by_id = {call["id"]: call for call in dc_calls}

        merged: List[Dict[str, Any]] = []
        for call in calls:
            enriched = dc_by_id.get(call["id"])
            if not enriched:
                merged.append(call)
                continue
            merged.append(
                {
                    **enriched,
                    **call,
                    "scheduledAt": call.get("scheduledAt") or enriched.get("scheduledAt"),
                    "status": _resolve_call_status(call.get("status"), enriched.get("status")),
                    "bant": enriched.get("bant") or call.get("bant"),
                    "dealStage": call.get("dealStage") or enriched.get("dealStage"),
                    "industry": call.get("industry") or enriched.get("industry"),
                    "icpBucket": call.get("icpBucket") or enriched.get("icpBucket"),
                    "leadName": call.get("leadName") or enriched.get("leadName"),
                    "leadTitle": call.get("leadTitle") or enriched.get("leadTitle"),
                }
            )
        return merged

    def get_call(self, ctx: TenantContext, call_id: str) -> Optional[Dict[str, Any]]:
        aliases = set(call_id_aliases(call_id))
        return next((c for c in self.list_calls(ctx) if c["id"] in aliases), None)

    def get_brief(self, ctx: TenantContext, call_id: str) -> Optional[Dict[str, Any]]:
        tenant_uuid, clerk_key = self._read_tenant_keys(ctx)
        if not get_settings().supabase_configured:
            for tenant_key in _memory_clerk_aliases(ctx, clerk_key):
                for alias in call_id_aliases(call_id):
                    brief = get_memory_store().get_call_brief(tenant_key, alias)
                    if brief:
                        return apply_summary_titles_to_brief(brief)
            return None
        supabase = get_supabase()
        for alias in call_id_aliases(call_id):
            try:
                result = execute_with_retry(
                    lambda: (
                        supabase.table("call_briefs")
                        .select("payload")
                        .eq("tenant_id", tenant_uuid)
                        .eq("call_id", alias)
                        .order("version", desc=True)
                        .limit(1)
                        .execute()
                    )
                )
            except Exception:
                brief = get_memory_store().get_call_brief(clerk_key, alias)
                if brief:
                    return apply_summary_titles_to_brief(brief)
                continue
            rows = result.data or []
            if rows:
                payload = rows[0].get("payload")
                if payload:
                    get_memory_store().save_call_brief(clerk_key, alias, payload)
                    if alias != call_id:
                        get_memory_store().save_call_brief(clerk_key, call_id, payload)
                    return apply_summary_titles_to_brief(payload)
        return None

    def asset_suggestion_stats(self, ctx: TenantContext, asset_id: str) -> Dict[str, Any]:
        asset_id = str(asset_id or "").strip()
        matched_call_ids: set[str] = set()
        if not asset_id:
            return {"assetId": asset_id, "suggestedLeadCount": 0}

        tenant_uuid, clerk_key = self._read_tenant_keys(ctx)
        rows: List[Dict[str, Any]] = []

        if get_settings().supabase_configured:
            try:
                result = execute_with_retry(
                    lambda: (
                        get_supabase()
                        .table("call_briefs")
                        .select("call_id,payload")
                        .eq("tenant_id", tenant_uuid)
                        .execute()
                    )
                )
                rows = result.data or []
            except Exception:
                rows = []

        if not rows:
            seen: set[str] = set()
            for tenant_key in _memory_clerk_aliases(ctx, clerk_key):
                for call_id, payload in get_memory_store().call_briefs.get(tenant_key, {}).items():
                    key = f"{tenant_key}:{call_id}"
                    if key in seen:
                        continue
                    seen.add(key)
                    rows.append({"call_id": call_id, "payload": payload})

        for row in rows:
            payload = row.get("payload") or {}
            if _brief_suggests_asset(payload, asset_id):
                call_id = str(row.get("call_id") or payload.get("callId") or "").strip()
                if call_id:
                    matched_call_ids.add(call_id)

        return {"assetId": asset_id, "suggestedLeadCount": len(matched_call_ids)}

    def save_brief(self, ctx: TenantContext, call_id: str, payload: Dict[str, Any]) -> None:
        clerk_key = self._clerk_key(ctx)
        if not get_settings().supabase_configured:
            for tenant_key in _memory_clerk_aliases(ctx, clerk_key):
                get_memory_store().save_call_brief(tenant_key, call_id, payload)
                for call in get_memory_store().list_calls(tenant_key):
                    if call["id"] == call_id:
                        call["briefReady"] = True
                        break
            return
        tenant_uuid = self._tenant_uuid(ctx)
        supabase = get_supabase()
        supabase.table("call_briefs").upsert(
            {
                "tenant_id": tenant_uuid,
                "call_id": call_id,
                "version": 1,
                "payload": payload,
                "citations": payload.get("citations", []),
            },
            on_conflict="tenant_id,call_id,version",
        ).execute()

        supabase.table("calls").update({"brief_ready": True}).eq("tenant_id", tenant_uuid).eq("id", call_id).execute()

    def get_post_review(self, ctx: TenantContext, call_id: str) -> Optional[Dict[str, Any]]:
        clerk_key = self._clerk_key(ctx)
        for tenant_key in _memory_clerk_aliases(ctx, clerk_key):
            for alias in call_id_aliases(call_id):
                cached = get_memory_store().get_post_review(tenant_key, alias)
                if cached:
                    return cached

        if get_settings().supabase_configured:
            try:
                tenant_uuid = self._tenant_uuid(ctx)
            except Exception:
                return self._post_review_from_dc_import(ctx, call_id, clerk_key)
            supabase = get_supabase()
            for alias in call_id_aliases(call_id):
                try:
                    result = execute_with_retry(
                        lambda: (
                            supabase.table("calls")
                            .select("metadata")
                            .eq("tenant_id", tenant_uuid)
                            .eq("id", alias)
                            .limit(1)
                            .execute()
                        )
                    )
                except Exception:
                    continue
                rows = result.data or []
                if not rows:
                    continue
                metadata = rows[0].get("metadata") or {}
                if not isinstance(metadata, dict):
                    continue
                payload = metadata.get("post_call")
                if isinstance(payload, dict):
                    get_memory_store().save_post_review(clerk_key, alias, payload)
                    if alias != call_id:
                        get_memory_store().save_post_review(clerk_key, call_id, payload)
                    return payload

        return self._post_review_from_dc_import(ctx, call_id, clerk_key)

    def _post_review_from_dc_import(
        self, ctx: TenantContext, call_id: str, clerk_key: str
    ) -> Optional[Dict[str, Any]]:
        notes = self._dc.get_notes(ctx)
        calls = build_calls_from_pre_dc(notes["pre_dc_records"], notes["post_dc_records"])
        calls, _ = apply_post_dc_records(calls, notes["post_dc_records"], notes["pre_dc_records"])
        row = post_dc_record_for_call(call_id, notes["post_dc_records"], notes["pre_dc_records"], calls)
        if not row:
            return None
        payload = build_post_call_payload_from_import(call_id, row)
        get_memory_store().save_post_review(clerk_key, call_id, payload)
        return payload

    def _mark_post_review_in_memory(
        self,
        ctx: TenantContext,
        clerk_key: str,
        call_id: str,
        payload: Dict[str, Any],
    ) -> None:
        keys = _memory_clerk_aliases(ctx, clerk_key)
        for tenant_key in keys:
            get_memory_store().save_post_review(tenant_key, call_id, payload)

        call: Optional[Dict[str, Any]] = None
        try:
            call = self.get_call(ctx, call_id)
        except Exception:
            call = None
        if not call:
            call = {
                "id": call_id,
                "accountName": call_id,
                "status": "completed",
                "briefReady": False,
                "pod": [],
                "metadata": {},
            }
        meta = call.get("metadata") or {}
        if not isinstance(meta, dict):
            meta = {}
        meta["post_call"] = payload
        call["metadata"] = meta
        call["status"] = "completed"
        for tenant_key in keys:
            get_memory_store().upsert_calls(tenant_key, [call])

    def save_post_review(self, ctx: TenantContext, call_id: str, payload: Dict[str, Any]) -> None:
        clerk_key = self._clerk_key(ctx)
        for tenant_key in _memory_clerk_aliases(ctx, clerk_key):
            get_memory_store().save_post_review(tenant_key, call_id, payload)

        if not get_settings().supabase_configured:
            self._mark_post_review_in_memory(ctx, clerk_key, call_id, payload)
            return

        try:
            tenant_uuid = self._tenant_uuid(ctx)
        except Exception:
            self._mark_post_review_in_memory(ctx, clerk_key, call_id, payload)
            return
        supabase = get_supabase()
        meta: Dict[str, Any] = {}
        try:
            result = execute_with_retry(
                lambda: (
                    supabase.table("calls")
                    .select("metadata")
                    .eq("tenant_id", tenant_uuid)
                    .eq("id", call_id)
                    .limit(1)
                    .execute()
                )
            )
            rows = result.data or []
            if rows and isinstance(rows[0].get("metadata"), dict):
                meta = rows[0]["metadata"]
        except Exception:
            call = self.get_call(ctx, call_id)
            meta = (call or {}).get("metadata") or {}
        if not isinstance(meta, dict):
            meta = {}
        meta["post_call"] = payload
        supabase.table("calls").update({"metadata": meta, "status": "completed"}).eq("tenant_id", tenant_uuid).eq("id", call_id).execute()

    def save_live_signals(self, ctx: TenantContext, call_id: str, snapshot: Dict[str, Any]) -> None:
        try:
            tenant_uuid, clerk_key = self._read_tenant_keys(ctx)
        except Exception:
            tenant_uuid = ""
            clerk_key = self._fallback_clerk_key(ctx)
        if not get_settings().supabase_configured:
            for tenant_key in _memory_clerk_aliases(ctx, clerk_key):
                get_memory_store().save_live_signals(tenant_key, call_id, snapshot)
            call = self.get_call(ctx, call_id)
            if call:
                meta = call.get("metadata") or {}
                if not isinstance(meta, dict):
                    meta = {}
                meta["live_signals"] = snapshot
                call["metadata"] = meta
                for tenant_key in _memory_clerk_aliases(ctx, clerk_key):
                    get_memory_store().upsert_calls(tenant_key, [call])
            return
        try:
            tenant_uuid = self._tenant_uuid(ctx)
        except Exception:
            for tenant_key in _memory_clerk_aliases(ctx, clerk_key):
                get_memory_store().save_live_signals(tenant_key, call_id, snapshot)
            return
        supabase = get_supabase()
        call = self.get_call(ctx, call_id)
        meta = (call or {}).get("metadata") or {}
        if not isinstance(meta, dict):
            meta = {}
        meta["live_signals"] = snapshot
        supabase.table("calls").update({"metadata": meta}).eq("tenant_id", tenant_uuid).eq("id", call_id).execute()


def _row_to_call(row: Dict[str, Any]) -> Dict[str, Any]:
    meta = row.get("metadata") or {}
    return {
        "id": row["id"],
        "accountName": row.get("account_name") or row["id"],
        "scheduledAt": row.get("scheduled_at"),
        "status": row.get("status", "upcoming"),
        "briefReady": bool(row.get("brief_ready")),
        "pod": [],
        "leadName": meta.get("leadName"),
        "leadTitle": meta.get("leadTitle"),
        "industry": meta.get("industry"),
        "annualRevenueRaw": meta.get("annualRevenueRaw"),
        "employeeCount": meta.get("employeeCount"),
        "companyTypeIcp": meta.get("companyTypeIcp"),
        "dealStage": meta.get("dealStage"),
        "icpBucket": meta.get("icpBucket"),
        "icpMatch": meta.get("icpMatch"),
        "discoveryCallDatePkt": meta.get("discoveryCallDatePkt"),
        "discoveryCallTimePkt": meta.get("discoveryCallTimePkt"),
        "meetingUrl": meta.get("meetingUrl") or meta.get("meeting_url") or meta.get("recall_meeting_url"),
    }


def _meeting_url_from_fields(fields: Dict[str, Any]) -> Optional[str]:
    for key in (
        "Meeting URL",
        "Meeting Link",
        "Meeting URL-PreDC",
        "Meeting Link-PreDC",
        "Google Meet Link",
        "Zoom Link",
        "Teams Link",
    ):
        value = fields.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return None
