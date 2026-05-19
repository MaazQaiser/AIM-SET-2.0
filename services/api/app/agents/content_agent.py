from __future__ import annotations

import uuid
from pathlib import Path
from typing import Any, Dict, List, Optional

from dc_core.evidence import AgentEnvelope, Citation, validate_envelope
from dc_core.tenancy import TenantContext
from dc_llm.client import LlmClient
from dc_tools.retrieve_kb import default_embed_fn, retrieve_kb

from app.config import get_settings
from app.domain.kb_repository import get_kb_repository
from app.domain.memory_store import get_memory_store
from app.domain.tenant_service import get_tenant_service

PROMPTS_ROOT = Path(__file__).resolve().parents[4] / "prompts"


def load_prompt(rel_path: str) -> str:
    path = PROMPTS_ROOT / rel_path
    if path.is_file():
        return path.read_text(encoding="utf-8")
    return "You are the DC Copilot Content Agent. Produce concise, cited pre-DC briefs."


def generate_pre_dc_brief(
    tenant_id: str,
    call_id: str,
    account_name: str,
    research: Dict[str, str],
    clerk_tenant_key: Optional[str] = None,
) -> AgentEnvelope:
    settings = get_settings()
    repo = get_kb_repository()
    tenant_uuid, clerk_key = get_tenant_service().resolve(
        TenantContext(tenant_id=clerk_tenant_key or tenant_id, user_id="agent")
    )
    memory_key = clerk_tenant_key or clerk_key

    query = account_name + " " + research.get("needs", "")

    def vector_search(tid: str, embedding: List[float], limit: int) -> List[Dict[str, Any]]:
        return repo.match_chunks(tenant_uuid, embedding, limit=limit, clerk_key=memory_key)

    embed_fn = default_embed_fn if settings.openai_configured or settings.openai_api_key else None
    hits = retrieve_kb(
        tenant_uuid,
        query,
        limit=5,
        chunks=get_memory_store().kb_chunks.get(memory_key, []),
        embed_fn=embed_fn,
        vector_search_fn=vector_search if embed_fn else None,
    )

    system = load_prompt("content/pre_dc_brief/v1.0.0.md")
    user = (
        f"Account: {account_name}\nCall ID: {call_id}\n"
        f"Research: {research}\nKB hits: {hits[:3]}"
    )
    completion = LlmClient().complete(system=system, user=user)

    citations: List[Citation] = []
    for i, hit in enumerate(hits[:3]):
        citations.append(
            Citation(
                source_type="kb_document",
                source_id=str(hit.get("asset_id", f"kb-{i}")),
                snippet=(hit.get("chunk_text") or "")[:200],
                confidence=float(hit.get("score", 0.85)),
            )
        )
    if research.get("company_description"):
        citations.append(
            Citation(
                source_type="crm_record",
                source_id=call_id,
                snippet=research["company_description"][:200],
                confidence=0.9,
            )
        )

    result: Dict[str, Any] = {
        "callId": call_id,
        "accountName": account_name,
        "aiSummary": completion.text,
        "dealStage": research.get("deal_stage", "Discovery"),
        "daysSinceLastContact": 0,
        "icpMatch": 0.75,
        "newSignals": [research.get("other", "")] if research.get("other") else [],
        "pains": [
            {"text": research.get("needs", "Discovery needed"), "confidence": 0.8}
        ],
        "objections": [],
        "discovery_questions": [
            f"What does success look like for {account_name} in the next 90 days?",
        ],
        "deckSlides": [{"id": h.get("asset_id", "kb1"), "title": "KB asset", "included": True} for h in hits[:2]],
        "clientAttendees": [],
        "interactionHistory": [],
        "podNotes": [],
    }

    envelope = AgentEnvelope(
        agent="content",
        operation="pre_dc_brief",
        result=result,
        citations=citations,
        confidence=0.82,
        cost={"tokens": completion.tokens_in + completion.tokens_out, "usd": completion.cost_usd, "model": completion.model},
        trace_id=completion.trace_id,
    )
    validate_envelope(envelope)
    return envelope
