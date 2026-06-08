from __future__ import annotations

from datetime import date
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, ConfigDict, Field

from dc_core.tenancy import TenantContext

from app.agents.briefing_agent import run_daily_briefing
from app.deps import get_tenant_context
from app.domain.daily_briefings_repository import get_daily_briefings_repository

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
    cached: bool = False
    generated_at: Optional[str] = Field(default=None, alias="generatedAt")
    briefing_date: Optional[str] = Field(default=None, alias="briefingDate")


def _briefing_context(body: DailyBriefingIn) -> Dict[str, Any]:
    return {
        "todaysCallCount": body.todays_call_count,
        "pendingApprovalCount": body.pending_approval_count,
        "briefsNotReady": body.briefs_not_ready,
        "highPriorityTodoCount": body.high_priority_todo_count,
        "topOpportunity": (
            body.top_opportunity.model_dump(by_alias=True) if body.top_opportunity else None
        ),
        "todos": [t.model_dump() for t in body.todos[:12]],
    }


def _to_out(payload: Dict[str, Any]) -> DailyBriefingOut:
    return DailyBriefingOut(
        paragraph=payload.get("paragraph") or "",
        source=payload.get("source") or "template",
        model=payload.get("model"),
        cached=bool(payload.get("cached")),
        generatedAt=payload.get("generatedAt"),
        briefingDate=payload.get("briefingDate"),
    )


@router.get("/briefing", response_model=DailyBriefingOut)
def get_daily_briefing(
    ctx: TenantContext = Depends(get_tenant_context),
    briefing_date: Optional[str] = Query(default=None, alias="date"),
) -> DailyBriefingOut:
    day = briefing_date or date.today().isoformat()
    cached = get_daily_briefings_repository().get(ctx, day)
    if not cached:
        raise HTTPException(status_code=404, detail="Daily briefing not found for this date")
    return _to_out(cached)


@router.post("/briefing", response_model=DailyBriefingOut)
def daily_briefing(
    body: DailyBriefingIn,
    ctx: TenantContext = Depends(get_tenant_context),
    refresh: bool = Query(default=False),
    briefing_date: Optional[str] = Query(default=None, alias="date"),
) -> DailyBriefingOut:
    day = briefing_date or date.today().isoformat()
    repo = get_daily_briefings_repository()
    context = _briefing_context(body)

    if not refresh:
        cached = repo.get(ctx, day)
        if cached and cached.get("context") == context:
            return _to_out(cached)

    result = run_daily_briefing(ctx, context=context)
    stored = repo.save(
        ctx,
        day,
        {
            "paragraph": result.get("paragraph") or "",
            "source": result.get("source") or "template",
            "model": result.get("model"),
            "context": context,
        },
    )
    return _to_out(stored)
