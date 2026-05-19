from __future__ import annotations

from typing import Any, Dict, List

from dc_tools.crm.base import CrmAdapter


class HubSpotAdapter(CrmAdapter):
    """Stub — wire HubSpot SDK in production."""

    def create_task(self, payload: Dict[str, Any]) -> str:
        return f"hubspot-task-stub-{payload.get('title', 'task')}"

    def list_open_tasks(self, account_id: str) -> List[Dict[str, Any]]:
        return []
