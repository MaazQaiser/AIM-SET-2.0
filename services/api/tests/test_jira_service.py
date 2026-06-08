import json

from app.config import get_settings
from app.services import jira_service
from app.services.jira_service import JiraService


class _FakeJiraResponse:
    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False

    def read(self):
        return json.dumps({"key": "PRJCT-1"}).encode("utf-8")


def test_create_ticket_uses_configured_project_for_legacy_sales_draft(monkeypatch):
    monkeypatch.setenv("JIRA_BASE_URL", "https://pm-tkxel.atlassian.net")
    monkeypatch.setenv("JIRA_EMAIL", "ahmad.ullah@tkxel.com")
    monkeypatch.setenv("JIRA_API_TOKEN", "token")
    monkeypatch.setenv("JIRA_PROJECT_KEY", "PRJCT")
    monkeypatch.setenv("JIRA_ISSUE_TYPE", "Task")
    get_settings.cache_clear()

    captured = {}

    def fake_urlopen(req, timeout):
        captured["body"] = json.loads(req.data.decode("utf-8"))
        captured["url"] = req.full_url
        captured["timeout"] = timeout
        return _FakeJiraResponse()

    monkeypatch.setattr(jira_service.request, "urlopen", fake_urlopen)

    result = JiraService().create_ticket(
        {
            "summary": "Draft",
            "description": "Body",
            "projectKey": "SALES",
            "issueType": "Review",
        }
    )

    fields = captured["body"]["fields"]
    assert fields["project"]["key"] == "PRJCT"
    assert fields["issuetype"]["name"] == "Task"
    assert result["externalKey"] == "PRJCT-1"
