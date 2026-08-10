from __future__ import annotations

from dc_core.tenancy import TenantContext

from app.agents.briefing_agent import _fallback_paragraph, run_daily_briefing


def test_fallback_paragraph_no_calls_today():
    text = _fallback_paragraph({"todaysCallCount": 0, "pendingApprovalCount": 0})
    assert "No calls" in text
    assert "Overall, no prep items" in text


def test_fallback_paragraph_with_priority_calls():
    text = _fallback_paragraph(
        {
            "todaysCallCount": 2,
            "completedCallCount": 1,
            "pendingPostDcActionCount": 2,
            "pendingPrepItemCount": 4,
            "briefsNotReady": 0,
            "priorityCalls": [{
                "accountName": "Acme Corp",
                "leadName": "Jane Doe",
                "agentRating": 8,
            }],
            "postDcActionTypes": ["follow_up", "content_request"],
            "recommendedMaterialTypes": ["ROI one-pager"],
        }
    )
    assert "2 calls" in text
    assert "Acme Corp" in text
    assert "agent rating of 8" in text
    assert "2 post-DC actions are pending" in text
    assert "4 prep items are still pending creation" in text


def test_run_daily_briefing_without_api_key_uses_template(monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "")
    monkeypatch.setenv("OPENAI_API_KEY", "")
    ctx = TenantContext(tenant_id="t1", user_id="u1")
    result = run_daily_briefing(
        ctx,
        context={"todaysCallCount": 0, "pendingApprovalCount": 0},
    )
    assert result["source"] == "template"
    assert result["paragraph"]
