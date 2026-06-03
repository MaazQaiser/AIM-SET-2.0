from __future__ import annotations

import hashlib
import secrets
import uuid
from datetime import datetime, timezone
from functools import lru_cache
from typing import Any, Dict, List, Optional, Tuple

from dc_core.tenancy import TenantContext

from app.config import get_settings
from app.deps import get_supabase
from app.domain.memory_store import get_memory_store
from app.domain.tenant_service import get_tenant_service


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _tenant_keys(ctx: TenantContext) -> Tuple[str, str]:
    return get_tenant_service().resolve(ctx)


def hash_password(password: str) -> str:
    salt = "dc-clp-v1"
    return hashlib.sha256(f"{salt}:{password}".encode()).hexdigest()


def verify_password(password: str, password_hash: str) -> bool:
    return hash_password(password) == password_hash


def _lp_row_to_api(row: Dict[str, Any], *, base_url: str = "") -> Dict[str, Any]:
    token = row.get("share_token") or ""
    public_url = f"{base_url}/p/{token}" if base_url and token else None
    return {
        "id": str(row["id"]),
        "callId": row["call_id"],
        "tenantId": str(row.get("tenant_id") or ""),
        "ownerUserId": row.get("owner_user_id") or "",
        "status": row.get("status", "draft"),
        "shareToken": token,
        "publishedAt": row.get("published_at"),
        "revokedAt": row.get("revoked_at"),
        "version": int(row.get("version") or 1),
        "branding": row.get("branding") or {},
        "sections": row.get("sections") or [],
        "selectedAssets": row.get("selected_assets") or [],
        "aiSuggestions": row.get("ai_suggestions") or [],
        "settings": row.get("settings") or {},
        "proposalId": str(row["proposal_id"]) if row.get("proposal_id") else None,
        "createdAt": (row.get("created_at") or _now_iso())[:19] + "Z",
        "updatedAt": (row.get("updated_at") or _now_iso())[:19] + "Z",
        "publicUrl": public_url,
    }


def _proposal_row_to_api(row: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "id": str(row["id"]),
        "landingPageId": str(row["landing_page_id"]),
        "callId": row.get("call_id") or "",
        "status": row.get("status", "draft"),
        "version": int(row.get("version") or 1),
        "title": row.get("title") or "Proposal",
        "html": row.get("html") or "",
        "sections": row.get("sections") or [],
        "citations": row.get("citations") or [],
        "templateId": row.get("template_id"),
        "createdAt": (row.get("created_at") or _now_iso())[:19] + "Z",
        "updatedAt": (row.get("updated_at") or _now_iso())[:19] + "Z",
    }


class ClpRepository:
    def __init__(self) -> None:
        self._tenants = get_tenant_service()

    def get_by_call(
        self, ctx: TenantContext, call_id: str, *, base_url: str = ""
    ) -> Optional[Dict[str, Any]]:
        tenant_uuid, clerk_key = _tenant_keys(ctx)
        settings = get_settings()
        if settings.supabase_configured:
            try:
                res = (
                    get_supabase()
                    .table("customer_landing_pages")
                    .select("*")
                    .eq("tenant_id", tenant_uuid)
                    .eq("call_id", call_id)
                    .limit(1)
                    .execute()
                )
                if res.data:
                    return _lp_row_to_api(res.data[0], base_url=base_url)
            except Exception:
                pass
        store = get_memory_store().landing_pages.get(clerk_key, {})
        row = store.get(call_id)
        return _lp_row_to_api(row, base_url=base_url) if row else None

    def get_by_token(self, share_token: str, *, base_url: str = "") -> Optional[Dict[str, Any]]:
        settings = get_settings()
        if settings.supabase_configured:
            try:
                res = (
                    get_supabase()
                    .table("customer_landing_pages")
                    .select("*")
                    .eq("share_token", share_token)
                    .limit(1)
                    .execute()
                )
                if res.data:
                    return _lp_row_to_api(res.data[0], base_url=base_url)
            except Exception:
                pass
        for clerk_key, pages in get_memory_store().landing_pages.items():
            for row in pages.values():
                if row.get("share_token") == share_token:
                    return _lp_row_to_api(row, base_url=base_url)
        return None

    def upsert(
        self,
        ctx: TenantContext,
        call_id: str,
        payload: Dict[str, Any],
        *,
        base_url: str = "",
    ) -> Dict[str, Any]:
        tenant_uuid, clerk_key = _tenant_keys(ctx)
        existing = self.get_by_call(ctx, call_id)
        now = _now_iso()
        row_id = existing["id"] if existing else str(uuid.uuid4())
        share_token = existing["shareToken"] if existing else secrets.token_urlsafe(24)
        row = {
            "id": row_id,
            "tenant_id": tenant_uuid,
            "call_id": call_id,
            "owner_user_id": payload.get("ownerUserId") or ctx.user_id or clerk_key,
            "status": payload.get("status") or (existing or {}).get("status") or "draft",
            "share_token": share_token,
            "password_hash": payload.get("passwordHash") or self._existing_password_hash(clerk_key, call_id, existing),
            "published_at": payload.get("publishedAt"),
            "revoked_at": payload.get("revokedAt"),
            "version": int(payload.get("version") or (existing or {}).get("version") or 1),
            "branding": payload.get("branding") or (existing or {}).get("branding") or {},
            "sections": payload.get("sections") or (existing or {}).get("sections") or [],
            "selected_assets": payload.get("selectedAssets")
            or (existing or {}).get("selectedAssets")
            or [],
            "ai_suggestions": payload.get("aiSuggestions")
            or (existing or {}).get("aiSuggestions")
            or [],
            "settings": payload.get("settings") or (existing or {}).get("settings") or {},
            "proposal_id": payload.get("proposalId"),
            "created_at": (existing or {}).get("createdAt") or now,
            "updated_at": now,
        }
        settings = get_settings()
        if settings.supabase_configured:
            try:
                get_supabase().table("customer_landing_pages").upsert(
                    {
                        "id": row_id,
                        "tenant_id": tenant_uuid,
                        "call_id": call_id,
                        "owner_user_id": row["owner_user_id"],
                        "status": row["status"],
                        "share_token": share_token,
                        "password_hash": row.get("password_hash"),
                        "published_at": row.get("published_at"),
                        "revoked_at": row.get("revoked_at"),
                        "version": row["version"],
                        "branding": row["branding"],
                        "sections": row["sections"],
                        "selected_assets": row["selected_assets"],
                        "ai_suggestions": row["ai_suggestions"],
                        "settings": row["settings"],
                        "proposal_id": row.get("proposal_id"),
                        "updated_at": now,
                    },
                    on_conflict="tenant_id,call_id",
                ).execute()
            except Exception:
                pass
        mem = get_memory_store().landing_pages.setdefault(clerk_key, {})
        if payload.get("passwordHash"):
            row["password_hash"] = payload["passwordHash"]
        mem[call_id] = row
        return _lp_row_to_api(row, base_url=base_url)

    def _existing_password_hash(
        self, clerk_key: str, call_id: str, existing: Optional[Dict[str, Any]]
    ) -> Optional[str]:
        row = get_memory_store().landing_pages.get(clerk_key, {}).get(call_id)
        if row:
            return row.get("password_hash")
        return None

    def publish(
        self, ctx: TenantContext, call_id: str, password: str, *, base_url: str = ""
    ) -> Dict[str, Any]:
        page = self.get_by_call(ctx, call_id, base_url=base_url)
        if not page:
            raise ValueError("Landing page not found")
        ph = hash_password(password)
        tenant_uuid, clerk_key = _tenant_keys(ctx)
        mem = get_memory_store().landing_pages.setdefault(clerk_key, {})
        if call_id in mem:
            mem[call_id]["password_hash"] = ph
        return self.upsert(
            ctx,
            call_id,
            {
                "status": "published",
                "publishedAt": _now_iso(),
                "revokedAt": None,
                "passwordHash": ph,
                "version": int(page.get("version") or 1),
            },
            base_url=base_url,
        )

    def revoke(self, ctx: TenantContext, call_id: str, *, base_url: str = "") -> Dict[str, Any]:
        return self.upsert(
            ctx,
            call_id,
            {"status": "revoked", "revokedAt": _now_iso()},
            base_url=base_url,
        )

    def add_event(
        self,
        landing_page_id: str,
        event_type: str,
        *,
        session_id: Optional[str] = None,
        visitor_id: Optional[str] = None,
        payload: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        event = {
            "id": str(uuid.uuid4()),
            "landing_page_id": landing_page_id,
            "session_id": session_id,
            "visitor_id": visitor_id,
            "event_type": event_type,
            "payload": payload or {},
            "created_at": _now_iso(),
        }
        settings = get_settings()
        if settings.supabase_configured:
            try:
                get_supabase().table("clp_events").insert(
                    {
                        "landing_page_id": landing_page_id,
                        "session_id": session_id,
                        "visitor_id": visitor_id,
                        "event_type": event_type,
                        "payload": payload or {},
                    }
                ).execute()
            except Exception:
                pass
        get_memory_store().clp_events.setdefault(landing_page_id, []).append(event)
        return {
            "id": event["id"],
            "landingPageId": landing_page_id,
            "sessionId": session_id,
            "visitorId": visitor_id,
            "eventType": event_type,
            "payload": payload or {},
            "createdAt": event["created_at"],
        }

    def list_events(self, landing_page_id: str, limit: int = 100) -> List[Dict[str, Any]]:
        settings = get_settings()
        rows: List[Dict[str, Any]] = []
        if settings.supabase_configured:
            try:
                res = (
                    get_supabase()
                    .table("clp_events")
                    .select("*")
                    .eq("landing_page_id", landing_page_id)
                    .order("created_at", desc=True)
                    .limit(limit)
                    .execute()
                )
                rows = res.data or []
            except Exception:
                pass
        if not rows:
            rows = list(get_memory_store().clp_events.get(landing_page_id, []))[-limit:]
        return [
            {
                "id": str(r["id"]),
                "landingPageId": landing_page_id,
                "sessionId": r.get("session_id"),
                "visitorId": r.get("visitor_id"),
                "eventType": r.get("event_type"),
                "payload": r.get("payload") or {},
                "createdAt": r.get("created_at"),
            }
            for r in reversed(rows)
        ]

    def upsert_visitor(
        self,
        landing_page_id: str,
        *,
        email: str,
        name: str,
        title: Optional[str] = None,
    ) -> Dict[str, Any]:
        normalized = email.strip().lower()
        settings = get_settings()
        now = _now_iso()
        if settings.supabase_configured:
            try:
                existing = (
                    get_supabase()
                    .table("clp_visitors")
                    .select("*")
                    .eq("landing_page_id", landing_page_id)
                    .eq("email", normalized)
                    .limit(1)
                    .execute()
                )
                if existing.data:
                    row = existing.data[0]
                    visit_count = int(row.get("visit_count") or 0) + 1
                    get_supabase().table("clp_visitors").update(
                        {
                            "name": name,
                            "title": title,
                            "visit_count": visit_count,
                            "last_seen_at": now,
                        }
                    ).eq("id", row["id"]).execute()
                    return self._visitor_api({**row, "visit_count": visit_count, "last_seen_at": now})
            except Exception:
                pass
        visitors = get_memory_store().clp_visitors.setdefault(landing_page_id, [])
        for v in visitors:
            if v.get("email") == normalized:
                v["visit_count"] = int(v.get("visit_count") or 0) + 1
                v["name"] = name
                v["title"] = title
                v["last_seen_at"] = now
                return self._visitor_api(v)
        row = {
            "id": str(uuid.uuid4()),
            "landing_page_id": landing_page_id,
            "email": normalized,
            "name": name,
            "title": title,
            "visit_count": 1,
            "first_seen_at": now,
            "last_seen_at": now,
        }
        visitors.append(row)
        return self._visitor_api(row)

    def _visitor_api(self, row: Dict[str, Any]) -> Dict[str, Any]:
        return {
            "id": str(row["id"]),
            "landingPageId": str(row.get("landing_page_id") or ""),
            "email": row.get("email") or "",
            "name": row.get("name") or "",
            "title": row.get("title"),
            "visitCount": int(row.get("visit_count") or 1),
            "firstSeenAt": row.get("first_seen_at"),
            "lastSeenAt": row.get("last_seen_at"),
        }

    def list_visitors(self, landing_page_id: str) -> List[Dict[str, Any]]:
        settings = get_settings()
        rows: List[Dict[str, Any]] = []
        if settings.supabase_configured:
            try:
                res = (
                    get_supabase()
                    .table("clp_visitors")
                    .select("*")
                    .eq("landing_page_id", landing_page_id)
                    .order("last_seen_at", desc=True)
                    .execute()
                )
                rows = res.data or []
            except Exception:
                pass
        if not rows:
            rows = get_memory_store().clp_visitors.get(landing_page_id, [])
        events = self.list_events(landing_page_id, limit=500)
        out: List[Dict[str, Any]] = []
        for r in rows:
            v = self._visitor_api(r)
            vid = v["id"]
            v["proposalViewed"] = any(
                e["eventType"] == "proposal_opened" and e.get("visitorId") == vid for e in events
            )
            doc_ids: List[str] = []
            for e in events:
                if e.get("visitorId") != vid or e["eventType"] != "document_opened":
                    continue
                aid = (e.get("payload") or {}).get("assetId")
                if aid and str(aid) not in doc_ids:
                    doc_ids.append(str(aid))
            v["documentsOpened"] = doc_ids
            out.append(v)
        return out

    def create_session(
        self, landing_page_id: str, visitor_id: str, *, ip_hash: str = "", user_agent: str = ""
    ) -> Dict[str, Any]:
        session = {
            "id": str(uuid.uuid4()),
            "landing_page_id": landing_page_id,
            "visitor_id": visitor_id,
            "started_at": _now_iso(),
            "ip_hash": ip_hash,
            "user_agent": user_agent,
        }
        get_memory_store().clp_sessions.setdefault(landing_page_id, []).append(session)
        return {"id": session["id"], "landingPageId": landing_page_id, "visitorId": visitor_id}

    def save_proposal(self, ctx: TenantContext, landing_page_id: str, call_id: str, data: Dict[str, Any]) -> Dict[str, Any]:
        tenant_uuid, clerk_key = _tenant_keys(ctx)
        pid = data.get("id") or str(uuid.uuid4())
        now = _now_iso()
        row = {
            "id": pid,
            "tenant_id": tenant_uuid,
            "landing_page_id": landing_page_id,
            "call_id": call_id,
            "status": data.get("status", "draft"),
            "version": int(data.get("version") or 1),
            "title": data.get("title", "Proposal"),
            "html": data.get("html", ""),
            "sections": data.get("sections") or [],
            "citations": data.get("citations") or [],
            "template_id": data.get("templateId", "tcs-quick-proposal-v1"),
            "created_at": now,
            "updated_at": now,
        }
        settings = get_settings()
        if settings.supabase_configured:
            try:
                get_supabase().table("clp_proposals").upsert(
                    {
                        "id": pid,
                        "tenant_id": tenant_uuid,
                        "landing_page_id": landing_page_id,
                        "call_id": call_id,
                        "status": row["status"],
                        "version": row["version"],
                        "title": row["title"],
                        "html": row["html"],
                        "sections": row["sections"],
                        "citations": row["citations"],
                        "template_id": row["template_id"],
                    }
                ).execute()
            except Exception:
                pass
        get_memory_store().clp_proposals.setdefault(clerk_key, {})[pid] = row
        return _proposal_row_to_api(row)

    def get_proposal(self, ctx: TenantContext, proposal_id: str) -> Optional[Dict[str, Any]]:
        _, clerk_key = _tenant_keys(ctx)
        settings = get_settings()
        if settings.supabase_configured:
            try:
                res = (
                    get_supabase()
                    .table("clp_proposals")
                    .select("*")
                    .eq("id", proposal_id)
                    .limit(1)
                    .execute()
                )
                if res.data:
                    return _proposal_row_to_api(res.data[0])
            except Exception:
                pass
        row = get_memory_store().clp_proposals.get(clerk_key, {}).get(proposal_id)
        return _proposal_row_to_api(row) if row else None

    def add_notification(
        self,
        ctx: TenantContext,
        *,
        landing_page_id: str,
        call_id: str,
        recipient_user_id: str,
        notification_type: str,
        summary: str,
        payload: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        tenant_uuid, clerk_key = _tenant_keys(ctx)
        row = {
            "id": str(uuid.uuid4()),
            "tenant_id": tenant_uuid,
            "landing_page_id": landing_page_id,
            "call_id": call_id,
            "recipient_user_id": recipient_user_id,
            "notification_type": notification_type,
            "summary": summary,
            "payload": payload or {},
            "created_at": _now_iso(),
        }
        settings = get_settings()
        if settings.supabase_configured:
            try:
                get_supabase().table("clp_notifications").insert(
                    {
                        "tenant_id": tenant_uuid,
                        "landing_page_id": landing_page_id,
                        "call_id": call_id,
                        "recipient_user_id": recipient_user_id,
                        "notification_type": notification_type,
                        "summary": summary,
                        "payload": payload or {},
                    }
                ).execute()
            except Exception:
                pass
        get_memory_store().clp_notifications.setdefault(recipient_user_id, []).append(row)
        return {
            "id": row["id"],
            "landingPageId": landing_page_id,
            "callId": call_id,
            "recipientUserId": recipient_user_id,
            "notificationType": notification_type,
            "summary": summary,
            "payload": payload or {},
            "createdAt": row["created_at"],
        }

    def list_notifications(self, recipient_user_id: str, *, unread_only: bool = False) -> List[Dict[str, Any]]:
        rows = get_memory_store().clp_notifications.get(recipient_user_id, [])
        out = []
        for r in rows:
            if unread_only and r.get("read_at"):
                continue
            out.append(
                {
                    "id": r["id"],
                    "landingPageId": r["landing_page_id"],
                    "callId": r["call_id"],
                    "recipientUserId": recipient_user_id,
                    "notificationType": r["notification_type"],
                    "summary": r["summary"],
                    "payload": r.get("payload") or {},
                    "readAt": r.get("read_at"),
                    "createdAt": r["created_at"],
                }
            )
        return sorted(out, key=lambda x: x["createdAt"], reverse=True)

    def mark_notification_read(self, notification_id: str, recipient_user_id: str) -> None:
        for r in get_memory_store().clp_notifications.get(recipient_user_id, []):
            if r["id"] == notification_id:
                r["read_at"] = _now_iso()
                break

    def add_comment(
        self,
        landing_page_id: str,
        *,
        section_id: Optional[str],
        author_type: str,
        author_name: str,
        body: str,
        visitor_id: Optional[str] = None,
        parent_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        row = {
            "id": str(uuid.uuid4()),
            "landing_page_id": landing_page_id,
            "section_id": section_id,
            "author_type": author_type,
            "author_name": author_name,
            "body": body,
            "visitor_id": visitor_id,
            "parent_id": parent_id,
            "status": "open",
            "created_at": _now_iso(),
        }
        get_memory_store().clp_comments.setdefault(landing_page_id, []).append(row)
        return {
            "id": row["id"],
            "landingPageId": landing_page_id,
            "sectionId": section_id,
            "authorType": author_type,
            "authorName": author_name,
            "body": body,
            "status": "open",
            "parentId": parent_id,
            "createdAt": row["created_at"],
        }

    def list_comments(self, landing_page_id: str) -> List[Dict[str, Any]]:
        rows = get_memory_store().clp_comments.get(landing_page_id, [])
        return [
            {
                "id": r["id"],
                "landingPageId": landing_page_id,
                "sectionId": r.get("section_id"),
                "authorType": r["author_type"],
                "authorName": r["author_name"],
                "body": r["body"],
                "status": r.get("status", "open"),
                "parentId": r.get("parent_id"),
                "createdAt": r["created_at"],
            }
            for r in rows
        ]

    def add_chat_message(
        self,
        landing_page_id: str,
        *,
        visitor_id: str,
        author_type: str,
        author_name: str,
        body: str,
        session_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        row = {
            "id": str(uuid.uuid4()),
            "landing_page_id": landing_page_id,
            "visitor_id": visitor_id,
            "session_id": session_id,
            "author_type": author_type,
            "author_name": author_name,
            "body": body,
            "created_at": _now_iso(),
        }
        get_memory_store().clp_chat.setdefault(landing_page_id, []).append(row)
        return {
            "id": row["id"],
            "landingPageId": landing_page_id,
            "visitorId": visitor_id,
            "authorType": author_type,
            "authorName": author_name,
            "body": body,
            "createdAt": row["created_at"],
        }

    def list_chat(self, landing_page_id: str, visitor_id: Optional[str] = None) -> List[Dict[str, Any]]:
        rows = get_memory_store().clp_chat.get(landing_page_id, [])
        if visitor_id:
            rows = [r for r in rows if r.get("visitor_id") == visitor_id]
        return [
            {
                "id": r["id"],
                "landingPageId": landing_page_id,
                "visitorId": r["visitor_id"],
                "authorType": r["author_type"],
                "authorName": r["author_name"],
                "body": r["body"],
                "createdAt": r["created_at"],
            }
            for r in rows
        ]

    def compute_stats(self, landing_page_id: str) -> Dict[str, Any]:
        events = self.list_events(landing_page_id, limit=500)
        visitors = self.list_visitors(landing_page_id)
        link_opens = sum(1 for e in events if e["eventType"] == "link_opened")
        identity_count = sum(1 for e in events if e["eventType"] == "identity_submitted")
        doc_opens = sum(1 for e in events if e["eventType"] == "document_opened")
        proposal_opens = sum(1 for e in events if e["eventType"] == "proposal_opened")
        return_visits = sum(1 for v in visitors if v.get("visitCount", 0) > 1)
        recipient = self._owner_for_landing_page(landing_page_id)
        unread = 0
        if recipient:
            unread = len(
                [
                    n
                    for n in get_memory_store().clp_notifications.get(recipient, [])
                    if n.get("landing_page_id") == landing_page_id and not n.get("read_at")
                ]
            )
        return {
            "linkOpens": link_opens,
            "uniqueVisitors": len(visitors),
            "returnVisits": return_visits,
            "documentOpens": doc_opens,
            "proposalOpens": proposal_opens,
            "identitySubmissions": identity_count,
            "unreadNotifications": unread,
        }

    def _owner_for_landing_page(self, landing_page_id: str) -> Optional[str]:
        for pages in get_memory_store().landing_pages.values():
            for row in pages.values():
                if str(row.get("id")) == landing_page_id:
                    return row.get("owner_user_id")
        return None

    def org_analytics(self, ctx: TenantContext) -> Dict[str, Any]:
        _, clerk_key = _tenant_keys(ctx)
        pages = list(get_memory_store().landing_pages.get(clerk_key, {}).values())
        published = [p for p in pages if p.get("status") == "published"]
        total_visitors = 0
        total_link = 0
        identity_total = 0
        doc_total = 0
        proposal_total = 0
        account_scores: Dict[str, Dict[str, Any]] = {}
        for p in published:
            pid = str(p["id"])
            stats = self.compute_stats(pid)
            total_visitors += stats["uniqueVisitors"]
            total_link += stats["linkOpens"]
            identity_total += stats.get("identitySubmissions", 0)
            doc_total += stats["documentOpens"]
            proposal_total += stats["proposalOpens"]
            branding = p.get("branding") or {}
            account = branding.get("accountName") or p.get("call_id") or "Account"
            score = stats["documentOpens"] + stats["proposalOpens"] * 2 + stats["uniqueVisitors"]
            existing = account_scores.get(account)
            if not existing or score > existing["engagementScore"]:
                account_scores[account] = {
                    "accountName": account,
                    "callId": p.get("call_id"),
                    "engagementScore": score,
                }
        proposal_rate = (
            (proposal_total / identity_total) if identity_total else 0.0
        )
        top_accounts = sorted(
            account_scores.values(), key=lambda x: x["engagementScore"], reverse=True
        )[:10]
        return {
            "publishedCount": len(published),
            "totalLinkOpens": total_link,
            "totalUniqueVisitors": total_visitors,
            "proposalViewRate": min(1.0, proposal_rate),
            "topAccounts": top_accounts,
            "funnel": {
                "published": len(published),
                "linkOpened": total_link,
                "identitySubmitted": identity_total,
                "documentOpened": doc_total,
                "proposalOpened": proposal_total,
            },
        }


@lru_cache
def get_clp_repository() -> ClpRepository:
    return ClpRepository()
