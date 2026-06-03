from __future__ import annotations

import uuid
from typing import Any, Dict, List, Optional

from dc_core.tenancy import TenantContext

from app.agents.relevant_content import build_relevant_content
from app.lib.client_facing_safety import sanitize_client_bullets, sanitize_client_headline


def _section_id() -> str:
    return str(uuid.uuid4())[:8]


def run_clp_generate(
    ctx: TenantContext,
    call_id: str,
    *,
    call: Optional[Dict[str, Any]] = None,
    review: Optional[Dict[str, Any]] = None,
    brief: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    account = (call or {}).get("accountName") or (call or {}).get("account_name") or "your team"
    lead = (call or {}).get("leadName") or (call or {}).get("lead_name") or ""
    headline = sanitize_client_headline((review or {}).get("headline") or "", account)
    bullets = sanitize_client_bullets(
        (review or {}).get("summary") or [],
        [f"We discussed priorities for {account} and agreed on follow-up materials."],
    )

    sections: List[Dict[str, Any]] = [
        {
            "id": _section_id(),
            "type": "hero",
            "visible": True,
            "headline": headline,
            "subhead": f"Personalized follow-up for {lead or account}",
        },
        {
            "id": _section_id(),
            "type": "summary",
            "visible": True,
            "title": "What we discussed",
            "bullets": bullets,
        },
        {
            "id": _section_id(),
            "type": "next_steps",
            "visible": True,
            "title": "Next steps",
            "bullets": [
                "Review the materials shared on this page.",
                "Share any questions with your account team.",
                "Schedule a follow-up to align on scope and timing.",
            ],
        },
        {
            "id": _section_id(),
            "type": "ae_contact",
            "visible": True,
            "title": "Your account team",
        },
    ]

    selected_assets: List[Dict[str, Any]] = []
    ai_suggestions: List[Dict[str, Any]] = []

    research = {}
    if brief:
        for sec in brief.get("researchSections") or []:
            for row in sec.get("rows") or []:
                if row.get("label") and row.get("value"):
                    research[str(row["label"]).lower().replace(" ", "_")] = str(row["value"])
    try:
        relevant = build_relevant_content(ctx, account, research)
        docs = relevant.get("relevantDocuments") or []
        for doc in docs[:8]:
            asset_id = doc.get("assetId") or doc.get("asset_id") or doc.get("id")
            title = doc.get("title") or "Reference"
            if not asset_id:
                continue
            entry = {
                "assetId": str(asset_id),
                "title": title,
                "kind": doc.get("format") or doc.get("type") or "document",
                "displayMode": "embed",
            }
            ai_suggestions.append(
                {
                    "assetId": str(asset_id),
                    "title": title,
                    "reason": doc.get("reason") or "Relevant to your discovery conversation",
                    "confidence": doc.get("score") or 0.7,
                }
            )
            if len(selected_assets) < 4:
                selected_assets.append(entry)
    except Exception:
        pass

    attachments = (review or {}).get("emailDraft", {}).get("attachments") or {}
    if isinstance(attachments, dict):
        for found in (attachments.get("found") or [])[:3]:
            aid = found.get("assetId") or found.get("asset_id")
            if aid and not any(a["assetId"] == str(aid) for a in selected_assets):
                selected_assets.append(
                    {
                        "assetId": str(aid),
                        "title": found.get("name") or "Attachment",
                        "displayMode": "embed",
                    }
                )

    if selected_assets:
        sections.insert(
            3,
            {
                "id": _section_id(),
                "type": "asset",
                "visible": True,
                "title": "Shared resources",
                "assetIds": [a["assetId"] for a in selected_assets],
            },
        )

    deck = (brief or {}).get("recommendedDeck")
    if deck and deck.get("assetId"):
        sections.append(
            {
                "id": _section_id(),
                "type": "company_deck",
                "visible": True,
                "title": "Company overview",
                "assetId": deck.get("assetId"),
            }
        )

    return {
        "branding": {
            "accountName": account,
            "leadName": lead or None,
            "aeName": (call or {}).get("ownerName"),
            "aeEmail": (call or {}).get("ownerEmail"),
        },
        "sections": sections,
        "selectedAssets": selected_assets,
        "aiSuggestions": ai_suggestions,
        "settings": {
            "requireIdentityEachVisit": True,
            "allowComments": True,
            "allowChat": True,
            "notifyAeOnActivity": True,
        },
    }
