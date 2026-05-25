from __future__ import annotations

import base64
import json
from typing import Any, Dict, Optional
from urllib import request
from urllib.error import HTTPError, URLError

from app.config import get_settings


class JiraConfigurationError(RuntimeError):
    pass


class JiraAPIError(RuntimeError):
    pass


class JiraService:
    def create_ticket(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        settings = get_settings()
        if not settings.jira_configured:
            raise JiraConfigurationError("Jira integration is not configured.")

        base_url = settings.jira_base_url.rstrip("/")
        project_key = str(payload.get("projectKey") or settings.jira_project_key or "SALES")
        issue_type = str(payload.get("issueType") or "Review")
        fields: Dict[str, Any] = {
            "project": {"key": project_key},
            "summary": str(payload.get("summary") or "Discovery call follow-up"),
            "issuetype": {"name": issue_type},
            "description": self._description(payload),
            "labels": payload.get("labels") or ["discovery-call"],
        }
        if payload.get("priority"):
            fields["priority"] = {"name": str(payload["priority"])}

        body = json.dumps({"fields": fields}).encode("utf-8")
        req = request.Request(
            f"{base_url}/rest/api/3/issue",
            data=body,
            headers={
                "Content-Type": "application/json",
                "Accept": "application/json",
                **self._auth_headers(settings.jira_email, settings.jira_api_token),
            },
            method="POST",
        )
        try:
            with request.urlopen(req, timeout=15) as res:  # noqa: S310 - configured Jira host
                data = json.loads(res.read().decode("utf-8") or "{}")
        except HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="ignore")
            raise JiraAPIError(f"Jira rejected ticket creation ({exc.code}): {detail}") from exc
        except URLError as exc:
            raise JiraAPIError(f"Jira request failed: {exc.reason}") from exc

        key = str(data.get("key") or "")
        url = f"{base_url}/browse/{key}" if key else base_url
        return {
            "key": key,
            "url": url,
            "status": "created",
            "externalKey": key,
            "externalUrl": url,
            "raw": data,
        }

    def _auth_headers(self, email: str, token: str) -> Dict[str, str]:
        if email:
            raw = f"{email}:{token}".encode("utf-8")
            return {"Authorization": "Basic " + base64.b64encode(raw).decode("ascii")}
        return {"Authorization": f"Bearer {token}"}

    def _description(self, payload: Dict[str, Any]) -> Any:
        text = str(payload.get("description") or "")
        return {
            "type": "doc",
            "version": 1,
            "content": [
                {
                    "type": "paragraph",
                    "content": [{"type": "text", "text": text or "Discovery call follow-up"}],
                }
            ],
        }


_service: Optional[JiraService] = None


def get_jira_service() -> JiraService:
    global _service
    if _service is None:
        _service = JiraService()
    return _service
