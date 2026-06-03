from __future__ import annotations

import os
from typing import Any, Dict, List, Optional

from dc_core.tenancy import TenantContext

from app.domain.calls_service import CallsService
from app.domain.clp_repository import get_clp_repository, verify_password


def _public_base_url() -> str:
    return (os.environ.get("NEXT_PUBLIC_APP_URL") or os.environ.get("APP_URL") or "http://localhost:3000").rstrip(
        "/"
    )


class ClpService:
    _notify_debounce: Dict[str, float] = {}

    def __init__(self) -> None:
        self._repo = get_clp_repository()
        self._calls = CallsService()

    def get(self, ctx: TenantContext, call_id: str) -> Optional[Dict[str, Any]]:
        page = self._repo.get_by_call(ctx, call_id, base_url=_public_base_url())
        if page:
            page["stats"] = self._repo.compute_stats(page["id"])
        return page

    def generate_draft(self, ctx: TenantContext, call_id: str) -> Dict[str, Any]:
        from app.agents.clp_agent import run_clp_generate

        call = self._calls.get_call(ctx, call_id)
        if not call:
            raise ValueError("Call not found")
        review = self._calls.get_post_review(ctx, call_id)
        brief = self._calls.get_brief(ctx, call_id)
        draft = run_clp_generate(ctx, call_id, call=call, review=review, brief=brief)
        return self._repo.upsert(
            ctx,
            call_id,
            {
                "ownerUserId": ctx.user_id,
                "branding": draft["branding"],
                "sections": draft["sections"],
                "selectedAssets": draft.get("selectedAssets") or [],
                "aiSuggestions": draft.get("aiSuggestions") or [],
                "settings": draft.get("settings") or {},
            },
            base_url=_public_base_url(),
        )

    def update(self, ctx: TenantContext, call_id: str, patch: Dict[str, Any]) -> Dict[str, Any]:
        return self._repo.upsert(ctx, call_id, patch, base_url=_public_base_url())

    def publish(self, ctx: TenantContext, call_id: str, password: str) -> Dict[str, Any]:
        if len(password) < 6:
            raise ValueError("Password must be at least 6 characters")
        return self._repo.publish(ctx, call_id, password, base_url=_public_base_url())

    def revoke(self, ctx: TenantContext, call_id: str) -> Dict[str, Any]:
        return self._repo.revoke(ctx, call_id, base_url=_public_base_url())

    def activity(self, ctx: TenantContext, call_id: str) -> Dict[str, Any]:
        page = self._repo.get_by_call(ctx, call_id)
        if not page:
            raise ValueError("Landing page not found")
        lp_id = page["id"]
        return {
            "events": self._repo.list_events(lp_id),
            "visitors": self._repo.list_visitors(lp_id),
            "metrics": self._repo.compute_stats(lp_id),
        }

    def generate_proposal(self, ctx: TenantContext, call_id: str) -> Dict[str, Any]:
        from app.agents.clp_proposal_agent import run_clp_proposal_generate

        page = self._repo.get_by_call(ctx, call_id)
        if not page:
            page = self.generate_draft(ctx, call_id)
        call = self._calls.get_call(ctx, call_id)
        review = self._calls.get_post_review(ctx, call_id)
        proposal = run_clp_proposal_generate(ctx, call_id, call=call, review=review, landing_page=page)
        saved = self._repo.save_proposal(ctx, page["id"], call_id, proposal)
        sections = list(page.get("sections") or [])
        if not any(s.get("type") == "proposal" for s in sections):
            sections.append(
                {
                    "id": "proposal-block",
                    "type": "proposal",
                    "visible": True,
                    "title": saved.get("title") or "Proposal",
                }
            )
        self._repo.upsert(
            ctx,
            call_id,
            {
                "proposalId": saved["id"],
                "sections": sections,
            },
            base_url=_public_base_url(),
        )
        return saved

    def get_proposal(self, ctx: TenantContext, call_id: str) -> Optional[Dict[str, Any]]:
        page = self._repo.get_by_call(ctx, call_id)
        if not page or not page.get("proposalId"):
            return None
        return self._repo.get_proposal(ctx, page["proposalId"])

    def public_auth(self, share_token: str, password: str) -> Dict[str, Any]:
        page = self._repo.get_by_token(share_token)
        if not page or page.get("status") != "published":
            raise ValueError("Landing page not available")
        mem = self._repo
        # Load password hash from memory store row
        stored_hash = self._password_hash_for_page(page["id"], share_token)
        if not stored_hash or not verify_password(password, stored_hash):
            mem.add_event(page["id"], "password_failed", payload={})
            raise ValueError("Invalid password")
        mem.add_event(page["id"], "password_success")
        return {"ok": True, "landingPageId": page["id"]}

    def _password_hash_for_page(self, page_id: str, share_token: str) -> Optional[str]:
        from app.domain.memory_store import get_memory_store

        for pages in get_memory_store().landing_pages.values():
            for row in pages.values():
                if str(row.get("id")) == page_id or row.get("share_token") == share_token:
                    return row.get("password_hash")
        return None

    def public_identify(
        self, share_token: str, *, name: str, email: str, title: Optional[str] = None
    ) -> Dict[str, Any]:
        page = self._repo.get_by_token(share_token)
        if not page or page.get("status") != "published":
            raise ValueError("Landing page not available")
        visitor = self._repo.upsert_visitor(page["id"], email=email, name=name, title=title)
        session = self._repo.create_session(page["id"], visitor["id"])
        self._repo.add_event(
            page["id"],
            "identity_submitted",
            session_id=session["id"],
            visitor_id=visitor["id"],
            payload={"email": email},
        )
        self._notify_owner(page, "first_visit", f"{name} visited your landing page", visitor)
        return {"visitor": visitor, "session": session}

    def public_payload(self, share_token: str) -> Dict[str, Any]:
        page = self._repo.get_by_token(share_token)
        if not page or page.get("status") != "published":
            raise ValueError("Landing page not available")
        public = {k: v for k, v in page.items() if k not in ("passwordHash",)}
        proposal = None
        if page.get("proposalId"):
            proposal = self._repo.get_proposal(
                TenantContext(user_id=page.get("ownerUserId") or "public", tenant_id=page.get("tenantId") or ""),
                page["proposalId"],
            )
        return {
            "page": public,
            "proposal": proposal,
            "comments": self._repo.list_comments(page["id"]),
        }

    def ingest_public_events(
        self, share_token: str, events: List[Dict[str, Any]], *, visitor_id: Optional[str] = None, session_id: Optional[str] = None
    ) -> Dict[str, Any]:
        page = self._repo.get_by_token(share_token)
        if not page:
            raise ValueError("Not found")
        for ev in events:
            et = str(ev.get("eventType") or ev.get("event_type") or "page_view")
            self._repo.add_event(
                page["id"],
                et,
                session_id=session_id,
                visitor_id=visitor_id,
                payload=ev.get("payload") or {},
            )
            if et == "proposal_opened":
                self._notify_owner(page, "proposal_opened", "A visitor opened the proposal", {"visitorId": visitor_id})
            elif et == "document_opened":
                self._notify_owner(page, "document_opened", "A visitor opened a document", ev.get("payload") or {})
            elif et == "chat_message_sent":
                self._notify_owner(page, "chat_message", "New message on your landing page", ev.get("payload") or {})
        return {"accepted": len(events)}

    def _notify_owner(self, page: Dict[str, Any], ntype: str, summary: str, payload: Any) -> None:
        import time

        owner = page.get("ownerUserId")
        if not owner or not (page.get("settings") or {}).get("notifyAeOnActivity", True):
            return
        debounce_key = f"{page.get('id')}:{ntype}"
        now = time.time()
        last = ClpService._notify_debounce.get(debounce_key, 0)
        if now - last < 120 and ntype in ("document_opened", "page_view", "link_opened"):
            return
        ClpService._notify_debounce[debounce_key] = now
        ctx = TenantContext(user_id=owner, tenant_id=page.get("tenantId") or owner)
        self._repo.add_notification(
            ctx,
            landing_page_id=page["id"],
            call_id=page["callId"],
            recipient_user_id=owner,
            notification_type=ntype,
            summary=summary,
            payload=payload if isinstance(payload, dict) else {"detail": str(payload)},
        )

    def org_analytics(self, ctx: TenantContext) -> Dict[str, Any]:
        return self._repo.org_analytics(ctx)

    def list_notifications(self, ctx: TenantContext, *, unread_only: bool = False) -> List[Dict[str, Any]]:
        uid = ctx.user_id or ""
        return self._repo.list_notifications(uid, unread_only=unread_only)

    def mark_notification_read(self, ctx: TenantContext, notification_id: str) -> None:
        self._repo.mark_notification_read(notification_id, ctx.user_id or "")


def get_clp_service() -> ClpService:
    return ClpService()
