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


def test_copilot_chat_offline_project_industry_search(monkeypatch):
    ctx = TenantContext(tenant_id="tenant-a", user_id="u1", clerk_org_id="tenant-a")

    monkeypatch.setattr(
        "app.agents.sales_copilot_agent._kb_search",
        lambda _ctx, _query, limit=5: [
            {
                "asset_id": "security-project-1",
                "chunk_text": (
                    "Project Name: Enterprise Security Rollout; "
                    "LinkedIn Industry: Security; "
                    "Technical Solution: SOC 2 readiness and access controls; "
                    "Definitions & Examples: https://docs.google.com/spreadsheets/d/example"
                ),
                "metadata": {"title": "Security project database"},
                "score": 0.92,
            },
            {
                "asset_id": "security-project-1",
                "chunk_text": (
                    "Project Name: Enterprise Security Rollout; "
                    "LinkedIn Industry: Security; "
                    "Technical Solution: SOC 2 readiness and access controls"
                ),
                "metadata": {"title": "Security project database"},
                "score": 0.92,
            }
        ],
    )

    env = copilot_chat_response(
        ctx,
        "share me the project for security industry",
        history=[],
        call_id=None,
    )

    answer = env.result.get("answer") or ""
    assert "Enterprise Security Rollout" in answer
    assert "SOC 2 readiness and access controls" in answer
    assert "Security project database" in answer
    assert "| Project / product | Relevant information | KB source |" in answer
    assert "kb-" not in answer
    assert "Sales Co-pilot (offline)" not in answer
    assert env.result["actions_taken"][0]["tool"] == "search_knowledge_base"


def test_copilot_chat_offline_filters_non_matching_industry(monkeypatch):
    ctx = TenantContext(tenant_id="tenant-a", user_id="u1", clerk_org_id="tenant-a")

    monkeypatch.setattr(
        "app.agents.sales_copilot_agent._kb_search",
        lambda _ctx, _query, limit=20: [
            {
                "asset_id": "kb-sales-1",
                "chunk_text": (
                    "Project Name: SalesProphet - Pre Assessment - SOW#1; "
                    "LinkedIn Industry: Software & IT Services; "
                    "Technical Solution: Sales enablement workflow; "
                    "Technology: Figma"
                ),
                "metadata": {"title": "Projects for Sale Enablement"},
                "score": 0.91,
            }
        ],
    )

    env = copilot_chat_response(
        ctx,
        "share me security industry product",
        history=[],
        call_id=None,
    )

    answer = env.result.get("answer") or ""
    assert "could not find a clean KB-backed match" in answer
    assert "filtered out" in answer
    assert "Projects for Sale Enablement" in answer
    assert "| KB source | Why I filtered it out |" in answer
