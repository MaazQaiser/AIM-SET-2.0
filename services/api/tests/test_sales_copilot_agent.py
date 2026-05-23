from __future__ import annotations

from dc_core.tenancy import TenantContext

from app.agents.sales_copilot_agent import (
    copilot_chat_response,
    list_dispatchable_agents,
)


def test_list_dispatchable_agents():
    agents = list_dispatchable_agents()
    ids = {a["id"] for a in agents}
    assert "pre_dc_brief" in ids
    assert "post_call" in ids


def test_copilot_chat_offline(monkeypatch):
    ctx = TenantContext(tenant_id="tenant-a", user_id="u1", clerk_org_id="tenant-a")

    monkeypatch.setattr(
        "app.agents.sales_copilot_agent.CallsService.list_calls",
        lambda self, _ctx: [
            {"id": "call-acme", "accountName": "Acme Corp", "status": "upcoming"},
        ],
    )

    env = copilot_chat_response(ctx, "list all calls", history=[], call_id=None)
    assert env.agent == "sales-copilot"
    assert env.operation == "copilot_chat"
    assert "Acme" in (env.result.get("answer") or "")
