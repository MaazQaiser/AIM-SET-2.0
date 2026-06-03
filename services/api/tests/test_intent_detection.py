from __future__ import annotations

from dc_core.tenancy import TenantContext

from app.agents.live_call.intent_detection import analyze_segment
from app.domain.kb_tenancy import resolve_kb_tenant
from app.domain.live_call_session import get_live_session
from app.tools.keyword_extract import extract_keywords
from app.tools.sentiment import analyze_sentiment


def test_sentiment_positive():
    r = analyze_sentiment("This is great and we are excited to move forward")
    assert r["label"] == "positive"
    assert r["score"] > 0


def test_sentiment_positive_franchise_demo_recovery_line():
    r = analyze_sentiment(
        "That's the first answer that doesn't sound like vaporware. "
        "Multi-tenant agent mesh is exactly what our architecture review kept asking for."
    )
    assert r["label"] == "positive"
    assert r["score"] > 0


def test_sentiment_uncertainty_phrase_is_negative():
    r = analyze_sentiment("I'm not sure how you can help us")
    assert r["label"] == "negative"
    assert r["score"] < 0


def test_sentiment_pain_language_is_negative():
    r = analyze_sentiment("Manual audits are a bottleneck and this is a nightmare")
    assert r["label"] == "negative"
    assert r["score"] < 0


def test_keyword_routing_budget():
    rules = [
        {
            "id": "sr-2",
            "keyword_pattern": "budget|cost|price",
            "signal_type": "budget_signal",
            "enabled": True,
            "confidence_threshold": 0.7,
        }
    ]
    r = extract_keywords("What is your budget for this project?", signal_routing=rules)
    assert r["signal_type"] == "budget_signal"


def test_keyword_routing_timeline_eta():
    rules = [
        {
            "id": "sr-4",
            "keyword_pattern": "timeline|eta|estimated delivery|delivery date|completion date|deadline|launch|go-live|kickoff|rollout|pilot|urgent|q[1-4]",
            "signal_type": "timeline_signal",
            "enabled": True,
            "confidence_threshold": 0.7,
        }
    ]
    r = extract_keywords("The project ETA is six weeks from kickoff.", signal_routing=rules)
    assert r["signal_type"] == "timeline_signal"


def test_analyze_segment_updates_counts():
    ctx = TenantContext(tenant_id="test-tenant", user_id="u1")
    call_id = "call-test-budget"
    segment = {
        "text": "Our budget is around fifty thousand for Q3",
        "speakerId": "cust-1",
        "speakerName": "Alex",
        "speakerRole": "customer",
        "timestamp": 10,
    }
    out = analyze_segment(ctx, call_id, segment)
    assert out.get("transcript")
    assert out["keyword_stats"]["global_top"]
    _, clerk_key = resolve_kb_tenant(ctx)
    session = get_live_session(clerk_key, call_id)
    assert session.segment_count >= 1


def test_analyze_segment_prioritizes_pain_point_nudge():
    ctx = TenantContext(tenant_id="test-tenant", user_id="u1")
    call_id = "call-test-pain-nudge"
    segment = {
        "id": "pain-segment-1",
        "text": "Operators live in spreadsheets and manual compliance audits are a bottleneck before expansion.",
        "speakerId": "cust-1",
        "speakerName": "Alex",
        "speakerRole": "customer",
        "timestamp": 68,
    }

    out = analyze_segment(ctx, call_id, segment)

    assert out["operation"] == "proactive_nudge"
    assert out["nudge"]["message"].startswith("Customer raised:")
    assert "bottleneck" in out["nudge"]["message"]
    assert out["intent_update"]["pains"]


def test_analyze_segment_detects_positive_customer_recovery_shift():
    ctx = TenantContext(tenant_id="test-tenant-positive-shift", user_id="u1")
    call_id = "call-test-positive-shift"

    analyze_segment(
        ctx,
        call_id,
        {
            "id": "positive-shift-1",
            "text": "Manual compliance audits are a nightmare and a bottleneck.",
            "speakerId": "cust-1",
            "speakerName": "Alex",
            "speakerRole": "customer",
            "timestamp": 10,
        },
    )
    analyze_segment(
        ctx,
        call_id,
        {
            "id": "positive-shift-2",
            "text": "We can review the pilot scope and architecture together.",
            "speakerId": "cust-1",
            "speakerName": "Alex",
            "speakerRole": "customer",
            "timestamp": 20,
        },
    )
    out = analyze_segment(
        ctx,
        call_id,
        {
            "id": "positive-shift-3",
            "text": (
                "That's the first answer that doesn't sound like vaporware. "
                "Multi-tenant agent mesh is exactly what our architecture review kept asking for."
            ),
            "speakerId": "cust-1",
            "speakerName": "Alex",
            "speakerRole": "customer",
            "timestamp": 30,
        },
    )

    assert out["transcript"]["sentiment"] == "positive"
    assert out["sentiment"]["customer"] > 0
    assert out["sentiment"]["shift"]["direction"] == "positive"


def test_analyze_segment_survives_tenant_resolution_failure(monkeypatch):
    ctx = TenantContext(tenant_id="missing-live-tenant", user_id="u1")
    call_id = "call-test-tenant-fallback"
    segment = {
        "id": "tenant-fallback-1",
        "text": "Manual compliance work is a nightmare and we are not sure how to scale it.",
        "speakerId": "cust-1",
        "speakerName": "Alex",
        "speakerRole": "customer",
        "timestamp": 72,
    }

    def fail_resolve(_ctx):
        raise RuntimeError("tenant unavailable")

    monkeypatch.setattr(
        "app.agents.live_call.intent_detection.resolve_kb_tenant",
        fail_resolve,
    )

    out = analyze_segment(ctx, call_id, segment)

    assert out["transcript"]["sentiment"] == "negative"
    assert out["sentiment"]["customer"] < 0
    assert out["operation"] == "proactive_nudge"
    assert out["nudge"]["message"].startswith("Customer raised:")
