from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any, Dict, List


class CrmAdapter(ABC):
    @abstractmethod
    def create_task(self, payload: Dict[str, Any]) -> str:
        ...

    @abstractmethod
    def list_open_tasks(self, account_id: str) -> List[Dict[str, Any]]:
        ...
