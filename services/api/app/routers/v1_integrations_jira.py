from __future__ import annotations

from typing import Any, Dict

from fastapi import APIRouter, Depends, HTTPException

from dc_core.tenancy import TenantContext

from app.deps import get_tenant_context
from app.services.jira_service import JiraAPIError, JiraConfigurationError, get_jira_service

router = APIRouter(prefix="/api/v1/integrations", tags=["integrations"])


@router.post("/jira/tickets")
def create_jira_ticket(
    body: Dict[str, Any],
    ctx: TenantContext = Depends(get_tenant_context),
) -> Dict[str, Any]:
    _ = ctx
    try:
        return get_jira_service().create_ticket(body)
    except JiraConfigurationError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except JiraAPIError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
