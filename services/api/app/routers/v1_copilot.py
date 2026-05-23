from __future__ import annotations

from typing import Any, Dict, List

from fastapi import APIRouter, Depends, HTTPException

from dc_core.tenancy import TenantContext

from app.agents.sales_copilot_agent import list_dispatchable_agents
from app.deps import get_tenant_context
from app.orchestrator.dispatcher import Orchestrator
from app.schemas import CopilotChatIn, CopilotChatResponse, CopilotCitationOut

router = APIRouter(prefix="/api/v1/copilot", tags=["copilot"])
_orch = Orchestrator()


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

    history = [{"role": t.role, "content": t.content} for t in body.history]
    call_id = body.call_id

    result = _orch.dispatch_copilot_chat(
        ctx,
        message,
        history,
        call_id=call_id,
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
    )
