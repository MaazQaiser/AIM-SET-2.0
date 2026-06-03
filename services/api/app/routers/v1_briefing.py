from __future__ import annotations

from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel, ConfigDict, Field

from dc_core.tenancy import TenantContext

from app.agents.briefing_agent import run_daily_briefing
from app.deps import get_tenant_context

router = APIRouter(prefix="/api/v1/agents", tags=["agents"])


class BriefingTodoIn(BaseModel):
    id: str
    title: str
    priority: str = "medium"


class BriefingCallIn(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    account_name: Optional[str] = Field(default=None, alias="accountName")
    annual_revenue: Optional[str] = Field(default=None, alias="annualRevenue")
    lead_name: Optional[str] = Field(default=None, alias="leadName")
    deal_stage: Optional[str] = Field(default=None, alias="dealStage")


class DailyBriefingIn(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    todays_call_count: int = Field(default=0, alias="todaysCallCount")
    pending_approval_count: int = Field(default=0, alias="pendingApprovalCount")
    briefs_not_ready: int = Field(default=0, alias="briefsNotReady")
    high_priority_todo_count: int = Field(default=0, alias="highPriorityTodoCount")
    top_opportunity: Optional[BriefingCallIn] = Field(default=None, alias="topOpportunity")
    todos: List[BriefingTodoIn] = Field(default_factory=list)


class DailyBriefingOut(BaseModel):
    paragraph: str
    source: str = "template"
    model: Optional[str] = None


@router.post("/briefing", response_model=DailyBriefingOut)
def daily_briefing(
    body: DailyBriefingIn,
    ctx: TenantContext = Depends(get_tenant_context),
) -> DailyBriefingOut:
    context: Dict[str, Any] = {
        "todaysCallCount": body.todays_call_count,
        "pendingApprovalCount": body.pending_approval_count,
        "briefsNotReady": body.briefs_not_ready,
        "highPriorityTodoCount": body.high_priority_todo_count,
        "topOpportunity": (
            body.top_opportunity.model_dump(by_alias=True) if body.top_opportunity else None
        ),
        "todos": [t.model_dump() for t in body.todos[:12]],
    }
    result = run_daily_briefing(ctx, context=context)
    return DailyBriefingOut(
        paragraph=result.get("paragraph") or "",
        source=result.get("source") or "template",
        model=result.get("model"),
    )
