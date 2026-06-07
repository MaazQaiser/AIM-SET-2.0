from __future__ import annotations

from dc_core.tenancy import TenantContext

from app.agents.sales_copilot_agent import (
    copilot_chat_response,
    list_dispatchable_agents,
    _polish_copilot_answer,
)
from app.agents.copilot_surface_contracts import COPILOT_SURFACE_CONTRACTS
from app.services.company_playbook_service import search_company_playbook


def test_list_dispatchable_agents():
    agents = list_dispatchable_agents()
    ids = {a["id"] for a in agents}
    assert "pre_dc_brief" in ids
    assert "post_call" in ids


def test_surface_contracts_define_expected_outputs():
    assert COPILOT_SURFACE_CONTRACTS["home"].output_sections == (
        "Snapshot",
        "Needs attention",
        "Next",
    )
    assert "BANT gaps" in COPILOT_SURFACE_CONTRACTS["pre_dc"].suggested_actions
    assert "Jira handoff" in COPILOT_SURFACE_CONTRACTS["post_dc"].suggested_actions


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


def test_copilot_answer_polish_formats_quotes_bullets_and_closing_question():
    answer = _polish_copilot_answer(
        (
            "**Coaching note** He already signaled “that’s the first answer that doesn’t sound like vaporware,” "
            "so keep leaning into:\n"
            "concrete integration map\n"
            "pilot scope\n"
            "measurable ROI\n\n"
            "SOURCES: Copilot context"
        ),
        surface="live_dc",
    )

    assert "*“that’s the first answer that doesn’t sound like vaporware,”*" in answer
    assert "- concrete integration map" in answer
    assert "- pilot scope" in answer
    assert "SOURCES:" not in answer
    assert answer.rstrip().endswith("?")
    assert "next live-call question" in answer


def test_copilot_answer_polish_bullets_answer_with_blocks():
    answer = _polish_copilot_answer(
        (
            "If Marcus asks “why partner vs. build?”, answer with:\n\n"
            "speed to Q3 pilot\n\n"
            "integration complexity across POS systems\n\n"
            "multi-tenant permissioning\n\n"
            "production hardening and rollout support"
        ),
        surface="live_dc",
    )

    assert "If Marcus asks *“why partner vs. build?”*, answer with:" in answer
    assert "- speed to Q3 pilot" in answer
    assert "- integration complexity across POS systems" in answer
    assert "- multi-tenant permissioning" in answer
    assert "- production hardening and rollout support" in answer
    assert answer.rstrip().endswith("?")


def test_copilot_answer_polish_mutes_evidence_sections():
    answer = _polish_copilot_answer(
        (
            "**Current read**\n\n"
            "Marcus is engaged.\n\n"
            "**Evidence:**\n\n"
            "- Pain: spreadsheets and manual audits.\n"
            "- Quote: “Manual audits are a nightmare.”\n\n"
            "**Best next move**\n\n"
            "- Ask for decision criteria."
        ),
        surface="live_dc",
    )

    assert "**Evidence:**\n\n> - Pain: spreadsheets and manual audits." in answer
    assert "> - Quote: *“Manual audits are a nightmare.”*" in answer
    assert "**Best next move**\n\n- Ask for decision criteria." in answer


def test_repo_company_playbook_searches_engagement_model_content():
    hits = search_company_playbook("what are standard engagement models of Techcel", limit=5)

    assert hits
    assert any(hit["source_type"] == "company_playbook" for hit in hits)
    assert any("Engagement Models" in hit["title"] for hit in hits)
    assert any("fixed-price" in hit["chunk_text"].lower() for hit in hits)
    assert all("Source URLs" not in hit["title"] for hit in hits)


def test_repo_company_playbook_handles_engagement_model_typo():
    hits = search_company_playbook("what are tkxel's engaegment models?", limit=5)

    assert hits
    assert any("Engagement Models" in hit["title"] for hit in hits)
    assert all("Source URLs" not in hit["title"] for hit in hits)


def test_repo_company_playbook_searches_team_location_content():
    hits = search_company_playbook("where tkxel teams are based?", limit=5)

    assert hits
    assert any("Company Snapshot" in hit["title"] or "Public Proof Points" in hit["title"] for hit in hits)
    assert any("Reston" in hit["chunk_text"] and "Lahore" in hit["chunk_text"] for hit in hits)
    assert "AI-First Positioning" not in hits[0]["title"]


def test_copilot_uses_repo_company_playbook_when_tenant_kb_is_empty(monkeypatch):
    ctx = TenantContext(tenant_id="tenant-a", user_id="u1", clerk_org_id="tenant-a")

    monkeypatch.setattr(
        "app.agents.sales_copilot_agent._tenant_kb_search",
        lambda *_args, **_kwargs: [],
    )

    env = copilot_chat_response(
        ctx,
        "what are the standard engagement models of Techcel?",
        history=[],
        surface="global",
    )

    answer = env.result.get("answer") or ""
    assert "company playbook" in answer.lower()
    assert "Fixed-price/project-based" in answer
    assert "Dedicated team" in answer
    assert "Offshore development center" in answer
    assert "Hybrid delivery" in answer
    assert "Source URLs" not in answer
    assert "https://tkxel.com" not in answer
    assert any(c.source_type == "company_playbook" for c in env.citations)
    assert env.result["actions_taken"][0]["tool"] == "search_knowledge_base"


def test_copilot_handles_misspelled_engagement_models_without_source_url_dump(monkeypatch):
    ctx = TenantContext(tenant_id="tenant-a", user_id="u1", clerk_org_id="tenant-a")

    monkeypatch.setattr(
        "app.agents.sales_copilot_agent._tenant_kb_search",
        lambda *_args, **_kwargs: [],
    )

    env = copilot_chat_response(
        ctx,
        "what are tkxel's engaegment models?",
        history=[],
        surface="live_dc",
    )

    answer = env.result.get("answer") or ""
    assert "Tkxel engagement models" in answer
    assert "Fixed-price/project-based" in answer
    assert "Dedicated team" in answer
    assert "Offshore development center" in answer
    assert "Hybrid delivery" in answer
    assert "Source URLs" not in answer
    assert "https://tkxel.com" not in answer


def test_copilot_answers_team_location_question_from_playbook(monkeypatch):
    ctx = TenantContext(tenant_id="tenant-a", user_id="u1", clerk_org_id="tenant-a")

    monkeypatch.setattr(
        "app.agents.sales_copilot_agent._tenant_kb_search",
        lambda *_args, **_kwargs: [],
    )

    env = copilot_chat_response(
        ctx,
        "where tkxel teams are based?",
        history=[],
        surface="live_dc",
    )

    answer = env.result.get("answer") or ""
    assert "Tkxel team / office footprint" in answer
    assert "Reston" in answer
    assert "Dammam" in answer
    assert "Lisbon" in answer
    assert "Lahore" in answer
    assert "AI-first" not in answer
    assert "AI should" not in answer


def test_copilot_uses_repo_company_playbook_for_payment_terms(monkeypatch):
    ctx = TenantContext(tenant_id="tenant-a", user_id="u1", clerk_org_id="tenant-a")

    monkeypatch.setattr(
        "app.agents.sales_copilot_agent._tenant_kb_search",
        lambda *_args, **_kwargs: [],
    )

    env = copilot_chat_response(
        ctx,
        "what are Tkxel payment terms?",
        history=[],
        surface="global",
    )

    answer = env.result.get("answer") or ""
    assert "contract-specific" in answer
    assert "proposal" in answer.lower()
    assert any(c.source_type == "company_playbook" for c in env.citations)


def test_home_surface_uses_real_call_counts(monkeypatch):
    ctx = TenantContext(tenant_id="tenant-a", user_id="u1", clerk_org_id="tenant-a")

    monkeypatch.setattr(
        "app.agents.sales_copilot_agent.CallsService.list_calls",
        lambda self, _ctx: [
            {
                "id": "call-acme",
                "accountName": "Acme Corp",
                "status": "upcoming",
                "briefReady": False,
                "discoveryCallDatePkt": "2026-06-08",
                "discoveryCallTimePkt": "10:00 AM",
            },
            {
                "id": "call-beta",
                "accountName": "Beta Labs",
                "status": "completed",
                "briefReady": True,
            },
        ],
    )
    monkeypatch.setattr(
        "app.agents.sales_copilot_agent._kb_search",
        lambda *_args, **_kwargs: (_ for _ in ()).throw(AssertionError("home should not search KB")),
    )

    env = copilot_chat_response(ctx, "Today's priorities", history=[], surface="home")
    answer = env.result.get("answer") or ""

    assert "**Snapshot**" in answer
    assert "**Needs attention**" in answer
    assert "**Next**" in answer
    assert "Total calls: **2**" in answer
    assert "Briefs missing: **1**" in answer
    assert "Acme Corp" in answer
    assert "Sales Co-pilot (offline)" not in answer
    assert env.result["actions_taken"][0]["surface"] == "home"


def test_pre_dc_surface_uses_bant_and_brief(monkeypatch):
    ctx = TenantContext(tenant_id="tenant-a", user_id="u1", clerk_org_id="tenant-a")

    monkeypatch.setattr(
        "app.agents.sales_copilot_agent.CallsService.get_call",
        lambda self, _ctx, call_id: {
            "id": call_id,
            "accountName": "Acme Corp",
            "status": "upcoming",
            "dealStage": "Enterprise",
            "bant": {
                "budget": "unknown",
                "authority": "confirmed",
                "need": "partial",
                "timeline": "unknown",
            },
        },
    )
    monkeypatch.setattr(
        "app.agents.sales_copilot_agent.CallsService.get_brief",
        lambda self, _ctx, _call_id: {
            "aiSummary": "Acme wants to reduce manual audit work.",
            "pains": [{"text": "Manual audit work slows finance close."}],
            "discoveryQuestions": ["What budget has been allocated?", "What timeline matters?"],
        },
    )

    env = copilot_chat_response(
        ctx,
        "BANT gaps",
        history=[],
        call_id="call-acme",
        surface="pre_dc",
    )
    answer = env.result.get("answer") or ""

    assert "**Prep snapshot**" in answer
    assert "**Gaps to close**" in answer
    assert "**Recommended talk track**" in answer
    assert "Acme Corp" in answer
    assert "Budget" in answer
    assert "Timeline" in answer
    assert "Manual audit work" in answer
    assert "Sales Co-pilot (offline)" not in answer
    assert env.result["actions_taken"][0]["surface"] == "pre_dc"


def test_post_dc_surface_uses_post_review(monkeypatch):
    ctx = TenantContext(tenant_id="tenant-a", user_id="u1", clerk_org_id="tenant-a")

    monkeypatch.setattr(
        "app.agents.sales_copilot_agent.CallsService.get_call",
        lambda self, _ctx, call_id: {
            "id": call_id,
            "accountName": "Acme Corp",
            "status": "completed",
        },
    )
    monkeypatch.setattr(
        "app.agents.sales_copilot_agent.CallsService.get_brief",
        lambda self, _ctx, _call_id: {"aiSummary": "Pre-call brief summary."},
    )
    monkeypatch.setattr(
        "app.agents.sales_copilot_agent.CallsService.get_post_review",
        lambda self, _ctx, _call_id: {
            "headline": "Acme validated a Q3 pilot if CFO approval is clear.",
            "summary": ["Budget needs CFO approval.", "Pilot timing is Q3."],
            "openDiscoveryGaps": ["decision criteria", "technical owner"],
            "nextStepProposal": "Send CFO ROI readout and schedule technical review.",
        },
    )

    env = copilot_chat_response(
        ctx,
        "Jira handoff",
        history=[],
        call_id="call-acme",
        surface="post_dc",
    )
    answer = env.result.get("answer") or ""

    assert "**Outcome**" in answer
    assert "**Open risks**" in answer
    assert "**Next-step path**" in answer
    assert "Acme validated a Q3 pilot" in answer
    assert "decision criteria" in answer
    assert "Send CFO ROI readout" in answer
    assert "Sales Co-pilot (offline)" not in answer
    assert env.result["actions_taken"][0]["surface"] == "post_dc"


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
