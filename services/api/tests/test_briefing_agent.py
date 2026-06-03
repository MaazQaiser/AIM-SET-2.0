from __future__ import annotations

from dc_core.tenancy import TenantContext

from app.agents.briefing_agent import _fallback_paragraph, run_daily_briefing


def test_fallback_paragraph_no_calls_today():
    text = _fallback_paragraph({"todaysCallCount": 0, "pendingApprovalCount": 0})
    assert "No discovery calls" in text


def test_fallback_paragraph_with_top_opportunity():
    text = _fallback_paragraph(
        {
            "todaysCallCount": 2,
            "pendingApprovalCount": 0,
            "briefsNotReady": 0,
            "topOpportunity": {
                "accountName": "Acme Corp",
                "annualRevenue": "$1.2M",
                "leadName": "Jane Doe",
            },
        }
    )
    assert "Acme Corp" in text
    assert "Jane Doe" in text


def test_run_daily_briefing_without_api_key_uses_template(monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "")
    ctx = TenantContext(tenant_id="t1", user_id="u1")
    result = run_daily_briefing(
        ctx,
        context={"todaysCallCount": 0, "pendingApprovalCount": 0},
    )
    assert result["source"] == "template"
    assert result["paragraph"]
