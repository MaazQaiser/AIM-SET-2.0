from __future__ import annotations

import uuid
from typing import Any, Dict, List, Optional

from dc_core.tenancy import TenantContext

from app.agents.relevant_content import build_relevant_content
from app.lib.client_facing_safety import sanitize_client_bullets, sanitize_client_headline


def _section_id() -> str:
    return str(uuid.uuid4())[:8]


def _kb_entry_asset_id(entry: Dict[str, Any]) -> Optional[str]:
    asset_id = entry.get("assetId") or entry.get("asset_id") or entry.get("id")
    return str(asset_id) if asset_id else None


def _kb_entry_title(entry: Dict[str, Any], asset_id: str) -> str:
    title = entry.get("title")
    if title:
        return str(title)
    return asset_id.replace("dc:", "").replace(":", " ").strip() or "Reference"


def _apply_kb_entries(
    sections: List[Dict[str, Any]],
    selected_assets: List[Dict[str, Any]],
    ai_suggestions: List[Dict[str, Any]],
    entries: List[Dict[str, Any]],
) -> None:
    for entry in entries[:8]:
        asset_id = _kb_entry_asset_id(entry)
        if not asset_id:
            continue
        title = _kb_entry_title(entry, asset_id)
        reason = str(
            entry.get("reason")
            or entry.get("suggestedUse")
            or "Relevant to your discovery conversation"
        )
        score = entry.get("score") or entry.get("confidence") or entry.get("relevanceScore") or 0.7
        ai_suggestions.append(
            {
                "assetId": asset_id,
                "title": title,
                "reason": reason,
                "confidence": score,
            }
        )
        if len(selected_assets) < 4 and not any(a["assetId"] == asset_id for a in selected_assets):
            selected_assets.append(
                {
                    "assetId": asset_id,
                    "title": title,
                    "kind": entry.get("format") or entry.get("type") or entry.get("kind") or "document",
                    "displayMode": "embed",
                }
            )


def _ensure_asset_section(sections: List[Dict[str, Any]], selected_assets: List[Dict[str, Any]]) -> None:
    if not selected_assets:
        return
    asset_ids = [a["assetId"] for a in selected_assets]
    for section in sections:
        if section.get("type") == "asset":
            section["assetIds"] = asset_ids
            section["visible"] = True
            return
    sections.insert(
        3,
        {
            "id": _section_id(),
            "type": "asset",
            "visible": True,
            "title": "Shared resources",
            "assetIds": asset_ids,
        },
    )


def _hits_to_kb_entries(hits: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    entries: List[Dict[str, Any]] = []
    for hit in hits:
        asset_id = hit.get("asset_id")
        if not asset_id:
            continue
        chunk = str(hit.get("chunk_text") or "").strip()
        snippet = " ".join(chunk.split())[:180] if chunk else "Relevant to your discovery conversation"
        entries.append(
            {
                "assetId": str(asset_id),
                "title": _kb_entry_title(hit, str(asset_id)),
                "reason": snippet,
                "score": hit.get("score"),
            }
        )
    return entries


def run_clp_generate(
    ctx: TenantContext,
    call_id: str,
    *,
    call: Optional[Dict[str, Any]] = None,
    review: Optional[Dict[str, Any]] = None,
    brief: Optional[Dict[str, Any]] = None,
    kb_suggestions: Optional[List[Dict[str, Any]]] = None,
    kb_hits: Optional[List[Dict[str, Any]]] = None,
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

    kb_applied = False
    if kb_suggestions:
        _apply_kb_entries(sections, selected_assets, ai_suggestions, kb_suggestions)
        kb_applied = True
    elif kb_hits:
        _apply_kb_entries(sections, selected_assets, ai_suggestions, _hits_to_kb_entries(kb_hits))
        kb_applied = True

    if not kb_applied:
        research = {}
        if brief:
            for sec in brief.get("researchSections") or []:
                for row in sec.get("rows") or []:
                    if row.get("label") and row.get("value"):
                        research[str(row["label"]).lower().replace(" ", "_")] = str(row["value"])
        try:
            relevant = build_relevant_content(ctx, account, research)
            docs = relevant.get("relevantDocuments") or []
            doc_entries = [
                {
                    "assetId": doc.get("assetId") or doc.get("asset_id") or doc.get("id"),
                    "title": doc.get("title") or "Reference",
                    "reason": doc.get("reason") or "Relevant to your discovery conversation",
                    "score": doc.get("score") or doc.get("relevanceScore") or 0.7,
                    "format": doc.get("format") or doc.get("type") or "document",
                }
                for doc in docs[:8]
                if doc.get("assetId") or doc.get("asset_id") or doc.get("id")
            ]
            _apply_kb_entries(sections, selected_assets, ai_suggestions, doc_entries)
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
        _ensure_asset_section(sections, selected_assets)

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
