from __future__ import annotations

from dc_core.tenancy import TenantContext

from app.agents.clp_agent import run_clp_generate
from app.lib.client_facing_safety import has_client_unsafe_text


def test_run_clp_generate_produces_sections():
    ctx = TenantContext(user_id="u1", tenant_id="t1")
    out = run_clp_generate(
        ctx,
        "call-1",
        call={"accountName": "Acme Corp", "leadName": "Jane"},
        review={"headline": "BANT coverage finished", "summary": ["Discussed platform roadmap"]},
        brief=None,
    )
    assert out["branding"]["accountName"] == "Acme Corp"
    assert len(out["sections"]) >= 3
    hero = next(s for s in out["sections"] if s["type"] == "hero")
    assert not has_client_unsafe_text(hero.get("headline") or "")


def test_run_clp_generate_reuses_kb_suggestions_without_search(monkeypatch):
    ctx = TenantContext(user_id="u1", tenant_id="t1")

    def fail_search(*_args, **_kwargs):
        raise AssertionError("build_relevant_content should not run when kb suggestions exist")

    monkeypatch.setattr("app.agents.clp_agent.build_relevant_content", fail_search)
    out = run_clp_generate(
        ctx,
        "call-1",
        call={"accountName": "Acme Corp", "leadName": "Jane"},
        review={"headline": "Follow-up ready", "summary": ["Discussed platform roadmap"]},
        kb_suggestions=[
            {
                "assetId": "asset-1",
                "title": "Case study",
                "reason": "Matches cloud context",
                "score": 0.9,
            }
        ],
    )
    assert out["selectedAssets"][0]["assetId"] == "asset-1"
    assert out["aiSuggestions"][0]["title"] == "Case study"


def test_run_clp_generate_excludes_company_playbook_assets(monkeypatch):
    ctx = TenantContext(user_id="u1", tenant_id="t1")

    def fail_search(*_args, **_kwargs):
        raise AssertionError("build_relevant_content should not run when kb suggestions exist")

    monkeypatch.setattr("app.agents.clp_agent.build_relevant_content", fail_search)
    out = run_clp_generate(
        ctx,
        "call-1",
        call={"accountName": "Acme Corp", "leadName": "Jane"},
        review={"headline": "Follow-up ready", "summary": ["Discussed platform roadmap"]},
        kb_suggestions=[
            {
                "assetId": "asset-playbook",
                "title": "Tkxel Company Playbook - Official Site Synthesis",
                "reason": "Internal source",
                "score": 0.95,
            },
            {
                "assetId": "asset-1",
                "title": "Case study",
                "reason": "Matches cloud context",
                "score": 0.9,
            },
        ],
    )

    assert [asset["assetId"] for asset in out["selectedAssets"]] == ["asset-1"]
    assert [asset["assetId"] for asset in out["aiSuggestions"]] == ["asset-1"]
