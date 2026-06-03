from __future__ import annotations

from typing import Any, Dict, List, Optional

from dc_core.tenancy import TenantContext

from app.lib.client_facing_safety import sanitize_client_bullets, sanitize_client_headline


def _escape_html(text: str) -> str:
    return (
        text.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )


def run_clp_proposal_generate(
    ctx: TenantContext,
    call_id: str,
    *,
    call: Optional[Dict[str, Any]] = None,
    review: Optional[Dict[str, Any]] = None,
    landing_page: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    account = (call or {}).get("accountName") or "Client"
    branding = (landing_page or {}).get("branding") or {}
    account = branding.get("accountName") or account
    headline = sanitize_client_headline((review or {}).get("headline") or "", account)
    bullets = sanitize_client_bullets(
        (review or {}).get("summary") or [],
        ["Discovery outcomes and recommended next steps."],
    )
    learned = (review or {}).get("learned") or []
    timeline_note = "Timeline to be confirmed in our next working session."
    for item in learned:
        label = (item.get("label") or "").lower()
        if "timeline" in label and item.get("to"):
            timeline_note = f"Target timeline discussed: {_escape_html(str(item.get('to')))}"

    sections_def = [
        ("cover", "Cover", f"<h1>{_escape_html(account)}</h1><p>Proposal prepared following our discovery conversation</p>"),
        ("executive_summary", "Executive summary", "<ul>" + "".join(f"<li>{_escape_html(b)}</li>" for b in bullets[:3]) + "</ul>"),
        ("needs", "Understanding your needs", f"<p>{_escape_html(headline)}</p>"),
        ("approach", "Recommended approach", "<p>Phased delivery aligned to your priorities, with clear milestones and stakeholder checkpoints.</p>"),
        ("timeline", "Timeline", f"<p>{timeline_note}</p>"),
        ("investment", "Investment overview", "<p><strong>Investment:</strong> To be finalized based on scope confirmation. We will provide a detailed estimate after aligning on deliverables.</p>"),
        ("proof", "Proof points", "<p>Relevant case studies and references are included on your landing page.</p>"),
        ("next_steps", "Next steps", "<ol><li>Review this proposal and shared materials</li><li>Schedule a follow-up working session</li><li>Align on pilot or statement of work scope</li></ol>"),
    ]

    body_parts = [
        '<article class="clp-proposal tcs-template">',
        f'<header><h1>{_escape_html(account)} — Proposal</h1></header>',
    ]
    api_sections: List[Dict[str, Any]] = []
    for sid, title, body_html in sections_def:
        api_sections.append({"id": sid, "title": title, "bodyHtml": body_html})
        body_parts.append(f'<section id="{sid}"><h2>{_escape_html(title)}</h2>{body_html}</section>')
    body_parts.append("</article>")
    html = "\n".join(body_parts)

    return {
        "title": f"{account} — Quick proposal",
        "html": html,
        "sections": api_sections,
        "citations": [{"source": "post_dc_review", "label": "Discovery call summary"}],
        "templateId": "tcs-quick-proposal-v1",
        "status": "draft",
        "version": 1,
    }
