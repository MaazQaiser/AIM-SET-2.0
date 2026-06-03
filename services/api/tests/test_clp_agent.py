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
