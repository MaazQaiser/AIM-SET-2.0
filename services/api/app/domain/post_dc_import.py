from __future__ import annotations

import re
from datetime import datetime
from typing import Any, Dict, List, Optional

POST_DC_HEADERS = {
    "leadStage": "Lead Stage",
    "reasonNotFit": "Reason Not A Fit - Post-DC",
    "bottomLineContext": "Bottom Line Context",
    "engagementModel": "Engagement Model",
    "salesStrategy": "Sales Strategy",
    "additionalInfo": "Additional Info",
    "attendees": "Attendees",
    "icpBucketCorrect": "Was Pre DC ICP bucket correct",
    "budget": "Budget",
    "authority": "Authority",
    "need": "Need",
    "timeline": "Timeline",
    "accountsAnnualPotential": "Accounts Annual Potential",
    "serviceLine": "Service Line",
}

PRE_DC_COMPANY = "Company Name-PreDC"
PRE_DC_LEAD = "Lead Name-PreDC"


def slugify_company(name: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")[:56]
    return f"call-{slug}" if slug else f"call-{int(datetime.now().timestamp())}"


def call_id_aliases(call_id: str) -> List[str]:
    aliases = [call_id]
    if call_id.startswith("call-"):
        aliases.append(call_id.removeprefix("call-"))
    else:
        aliases.append(f"call-{call_id}")
    return list(dict.fromkeys(aliases))


def post_dc_field(fields: Dict[str, Any], key: str) -> str:
    header = POST_DC_HEADERS.get(key, key)
    value = fields.get(header)
    if value is None:
        return ""
    return str(value).strip()


def pre_dc_company(fields: Dict[str, Any]) -> str:
    return str(fields.get(PRE_DC_COMPANY) or "").strip()


def pre_dc_lead(fields: Dict[str, Any]) -> str:
    return str(fields.get(PRE_DC_LEAD) or "").strip()


def map_post_dc_bant(value: str) -> str:
    normalized = (value or "").strip().lower()
    if not normalized or normalized in ("#name?", "n/a", "-"):
        return "unknown"
    if normalized == "yes":
        return "confirmed"
    if normalized == "no":
        return "unknown"
    return "partial"


def build_bant_from_post_dc(row: Dict[str, Any]) -> Dict[str, str]:
    fields = row.get("fields") or {}
    return {
        "budget": map_post_dc_bant(post_dc_field(fields, "budget")),
        "authority": map_post_dc_bant(post_dc_field(fields, "authority")),
        "need": map_post_dc_bant(post_dc_field(fields, "need")),
        "timeline": map_post_dc_bant(post_dc_field(fields, "timeline")),
    }


def build_post_dc_research_sections(row: Dict[str, Any]) -> List[Dict[str, Any]]:
    fields = row.get("fields") or {}
    items = [
        ("Lead stage", post_dc_field(fields, "leadStage")),
        ("Annual potential", post_dc_field(fields, "accountsAnnualPotential")),
        ("Service line", post_dc_field(fields, "serviceLine")),
        ("Engagement model", post_dc_field(fields, "engagementModel")),
        ("Reason not a fit", post_dc_field(fields, "reasonNotFit")),
        ("Bottom line context", post_dc_field(fields, "bottomLineContext")),
        ("Sales strategy", post_dc_field(fields, "salesStrategy")),
        ("Additional info", post_dc_field(fields, "additionalInfo")),
        ("Attendees", post_dc_field(fields, "attendees")),
        ("Budget", post_dc_field(fields, "budget")),
        ("Authority", post_dc_field(fields, "authority")),
        ("Need", post_dc_field(fields, "need")),
        ("Timeline", post_dc_field(fields, "timeline")),
        ("Pre-DC ICP correct", post_dc_field(fields, "icpBucketCorrect")),
    ]
    section_items = [{"label": label, "value": value} for label, value in items if value]
    if not section_items:
        return []
    return [{"title": "Post-DC import (all fields)", "items": section_items}]


def build_post_review_from_post_dc(row: Dict[str, Any]) -> Dict[str, Any]:
    fields = row.get("fields") or {}
    bottom_line = post_dc_field(fields, "bottomLineContext")
    paragraphs = [p.strip() for p in re.split(r"\n\n+", bottom_line) if p.strip()]

    lead_stage = post_dc_field(fields, "leadStage")
    potential = post_dc_field(fields, "accountsAnnualPotential")
    service_line = post_dc_field(fields, "serviceLine")

    bant_notes = {
        "budget": post_dc_field(fields, "budget"),
        "authority": post_dc_field(fields, "authority"),
        "need": post_dc_field(fields, "need"),
        "timeline": post_dc_field(fields, "timeline"),
    }
    open_discovery_gaps = [
        key
        for key, value in bant_notes.items()
        if not value or re.match(r"^(no|unknown|n/a|-)$", value.strip(), re.I)
    ]

    sales_strategy = post_dc_field(fields, "salesStrategy")
    engagement_model = post_dc_field(fields, "engagementModel")
    reason_not_fit = post_dc_field(fields, "reasonNotFit")

    return {
        "headline": " · ".join(filter(None, [lead_stage, potential, service_line])) or "Post-DC summary",
        "summary": paragraphs if paragraphs else [bottom_line or "No summary provided."],
        "nextStepProposal": sales_strategy or engagement_model or "",
        "dealSignals": {
            "leadStage": lead_stage or None,
            "engagementModel": engagement_model or None,
            "accountsAnnualPotential": potential or None,
            "serviceLine": service_line or None,
            "icpBucketCorrect": post_dc_field(fields, "icpBucketCorrect") or None,
            "reasonNotFit": reason_not_fit or None,
            "additionalInfo": post_dc_field(fields, "additionalInfo") or None,
            "attendees": post_dc_field(fields, "attendees") or None,
        },
        "openDiscoveryGaps": open_discovery_gaps,
        "researchSections": build_post_dc_research_sections(row),
        "podScorecard": [
            {
                "member": "Pod",
                "role": "Pod",
                "roleInCall": "Pod",
                "score": 0.82 if lead_stage.lower() == "opportunity" else 0.68,
                "label": lead_stage or "review",
                "strengths": sales_strategy or "See sales strategy notes.",
                "watch": reason_not_fit or "",
                "areasToWork": [
                    reason_not_fit or "Review the imported Post-DC notes for coaching follow-up."
                ],
            }
        ],
        "learned": [
            {"label": "Budget", "note": post_dc_field(fields, "budget") or "—"},
            {"label": "Authority", "note": post_dc_field(fields, "authority") or "—"},
            {"label": "Need", "note": post_dc_field(fields, "need") or "—"},
            {"label": "Timeline", "note": post_dc_field(fields, "timeline") or "—"},
            {
                "label": "ICP bucket",
                "note": (
                    f"Pre-DC ICP correct: {post_dc_field(fields, 'icpBucketCorrect')}"
                    if post_dc_field(fields, "icpBucketCorrect")
                    else "—"
                ),
            },
        ],
    }


def match_post_dc_to_call(
    row: Dict[str, Any],
    calls: List[Dict[str, Any]],
    pre_rows: List[Dict[str, Any]],
) -> Optional[str]:
    fields = row.get("fields") or {}
    haystack = " ".join(
        [
            post_dc_field(fields, "bottomLineContext"),
            post_dc_field(fields, "additionalInfo"),
            post_dc_field(fields, "attendees"),
        ]
    ).lower()

    for pre in pre_rows:
        pre_fields = pre.get("fields") or {}
        company = pre_dc_company(pre_fields)
        if len(company) > 3 and company.lower() in haystack:
            return slugify_company(company)
        lead = pre_dc_lead(pre_fields)
        if len(lead) > 3 and lead.lower() in haystack:
            company_name = pre_dc_company(pre_fields)
            if company_name:
                return slugify_company(company_name)

    for call in calls:
        account = str(call.get("accountName") or "").strip()
        if len(account) > 3 and account.lower() in haystack:
            return str(call.get("id"))

    return None


def apply_post_dc_records(
    calls: List[Dict[str, Any]],
    post_rows: List[Dict[str, Any]],
    pre_rows: List[Dict[str, Any]],
) -> tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    if not post_rows:
        return calls, post_rows

    call_by_id = {call["id"]: {**call} for call in calls}
    enriched_posts: List[Dict[str, Any]] = []

    for row in post_rows:
        matched_call_id = row.get("matched_call_id") or match_post_dc_to_call(row, list(call_by_id.values()), pre_rows)
        enriched = {**row, "matched_call_id": matched_call_id}
        enriched_posts.append(enriched)

        if not matched_call_id:
            continue

        existing = call_by_id.get(matched_call_id)
        if not existing:
            continue

        call_by_id[matched_call_id] = {
            **existing,
            "bant": build_bant_from_post_dc(row),
            "status": "completed",
        }

    return list(call_by_id.values()), enriched_posts


def post_dc_record_for_call(
    call_id: str,
    post_rows: List[Dict[str, Any]],
    pre_rows: List[Dict[str, Any]],
    calls: List[Dict[str, Any]],
) -> Optional[Dict[str, Any]]:
    aliases = set(call_id_aliases(call_id))
    for row in post_rows:
        matched = row.get("matched_call_id") or match_post_dc_to_call(row, calls, pre_rows)
        if matched and str(matched) in aliases:
            return row
    return None


def build_post_call_payload_from_import(call_id: str, row: Dict[str, Any]) -> Dict[str, Any]:
    review = build_post_review_from_post_dc(row)
    account_name = ""
    fields = row.get("fields") or {}
    bottom_line = post_dc_field(fields, "bottomLineContext")
    if bottom_line:
        account_name = bottom_line.split()[0]
    return {
        "callId": call_id,
        "accountName": account_name or call_id,
        "review": review,
        "task": {"taskList": []},
    }
