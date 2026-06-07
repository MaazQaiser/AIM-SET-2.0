from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from dc_core.tenancy import TenantContext

from app.agents.sales_copilot_agent import list_dispatchable_agents
from app.deps import get_tenant_context
from app.domain.copilot_greeting import simple_greeting_response
from app.domain.kb_tenancy import resolve_kb_tenant
from app.domain.memory_store import get_memory_store
from app.orchestrator.dispatcher import Orchestrator
from app.schemas import CopilotChatIn, CopilotChatResponse, CopilotCitationOut

router = APIRouter(prefix="/api/v1/copilot", tags=["copilot"])
_orch = Orchestrator()


class CopilotFeedbackIn(BaseModel):
    feedback_id: Optional[str] = None
    message_id: str
    rating: Literal["up", "down"]
    comment: str = ""
    response: str = ""
    surface: str = "global"
    call_id: Optional[str] = None
    created_at: Optional[str] = None


@router.get("/agents")
def list_agents() -> List[Dict[str, str]]:
    return list_dispatchable_agents()


@router.post("/chat", response_model=CopilotChatResponse)
def copilot_chat(
    body: CopilotChatIn,
    ctx: TenantContext = Depends(get_tenant_context),
) -> CopilotChatResponse:
    message = (body.message or "").strip()
    if not message:
        raise HTTPException(status_code=400, detail="message is required")

    greeting = simple_greeting_response(message, body.surface)
    if greeting:
        return CopilotChatResponse(
            answer=greeting["answer"],
            message_id=greeting["message_id"],
            citations=[],
            actions_taken=[],
            call_exports=[],
            suggestions=greeting["suggestions"],
            confidence=float(greeting["confidence"]),
            missing_evidence=[],
        )

    history = [{"role": t.role, "content": t.content} for t in body.history]
    call_id = body.call_id

    result = _orch.dispatch_copilot_chat(
        ctx,
        message,
        history,
        call_id=call_id,
        surface=body.surface,
        context=body.context,
    )

    citations = [
        CopilotCitationOut(
            source_type=c.get("source_type", "kb_document"),
            source_id=str(c.get("source_id", "")),
            snippet=str(c.get("snippet", "")),
            confidence=float(c.get("confidence", 0.8)),
        )
        for c in result.get("citations") or []
    ]

    return CopilotChatResponse(
        answer=result.get("answer") or "",
        message_id=result.get("message_id") or "",
        citations=citations,
        actions_taken=result.get("actions_taken") or [],
        call_exports=result.get("call_exports") or [],
        suggestions=result.get("suggestions") or [],
        confidence=float(result.get("confidence") or 0.0),
        missing_evidence=result.get("missing_evidence") or [],
    )


@router.post("/feedback")
def save_copilot_feedback(
    body: CopilotFeedbackIn,
    ctx: TenantContext = Depends(get_tenant_context),
) -> Dict[str, Any]:
    message_id = body.message_id.strip()
    if not message_id:
        raise HTTPException(status_code=400, detail="message_id is required")

    _, clerk_key = resolve_kb_tenant(ctx)
    feedback_id = (body.feedback_id or "").strip() or str(uuid.uuid4())
    created_at = body.created_at or datetime.now(timezone.utc).isoformat()
    feedback = {
        "id": feedback_id,
        "message_id": message_id,
        "rating": body.rating,
        "comment": body.comment.strip(),
        "response": body.response,
        "surface": body.surface or "global",
        "call_id": body.call_id,
        "created_at": created_at,
    }
    get_memory_store().add_audit(
        clerk_key,
        {
            "id": feedback_id,
            "agent": "copilot",
            "action": "chat_feedback",
            "trace_id": message_id,
            "created_at": created_at,
            "payload": feedback,
        },
    )
    return {"ok": True, "feedback": feedback}
