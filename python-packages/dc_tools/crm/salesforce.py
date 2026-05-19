from __future__ import annotations

from typing import Any, Dict, List

from dc_tools.crm.base import CrmAdapter


class SalesforceAdapter(CrmAdapter):
    """Stub — wire Salesforce SDK in production."""

    def create_task(self, payload: Dict[str, Any]) -> str:
        return f"sfdc-task-stub-{payload.get('title', 'task')}"

    def list_open_tasks(self, account_id: str) -> List[Dict[str, Any]]:
        return []
