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


def test_analyze_segment_emits_sentiment_signal_and_ignores_neutral_filler():
    ctx = TenantContext(tenant_id="test-tenant-sentiment-signal", user_id="u1")
    call_id = "call-test-sentiment-signal"

    concern = analyze_segment(
        ctx,
        call_id,
        {
            "id": "sentiment-signal-1",
            "text": "I'm not sure that you will be able to help us overcome this challenge.",
            "speakerId": "cust-1",
            "speakerName": "Alex",
            "speakerRole": "customer",
            "timestamp": 19,
        },
    )

    assert concern["transcript"]["sentiment"] == "negative"
    assert concern["sentiment"]["customer"] < 0
    assert concern["sentiment"]["signal"]["tone"] == "negative"
    assert concern["sentiment"]["signal"]["label"] == "Customer sentiment: Decision risk"
    assert concern["sentiment"]["customerSentiment"]["label"] == "Decision risk"
    assert "Clarify the doubt" in concern["sentiment"]["customerSentiment"]["guidance"]
    assert concern["sentiment"]["signal"]["snippet"].startswith("I'm not sure")

    filler = analyze_segment(
        ctx,
        call_id,
        {
            "id": "sentiment-signal-2",
            "text": "now",
            "speakerId": "cust-1",
            "speakerName": "Alex",
            "speakerRole": "customer",
            "timestamp": 54,
        },
    )

    assert filler["transcript"]["sentiment"] == "neutral"
    assert filler["sentiment"]["signal"] is None
    assert filler["sentiment"]["customer"] < 0
    assert filler["sentiment"]["customerSentiment"] == concern["sentiment"]["customerSentiment"]


def test_internal_speaker_sentiment_signal_uses_sales_rep_label():
    ctx = TenantContext(tenant_id="test-tenant-sales-rep-sentiment-signal", user_id="u1")
    call_id = "call-test-sales-rep-sentiment-signal"

    out = analyze_segment(
        ctx,
        call_id,
        {
            "id": "sentiment-signal-sales-rep",
            "text": "I'm concerned this is getting confusing and risky.",
            "speakerId": "ae-sarah",
            "speakerName": "Sarah",
            "speakerRole": "ae",
            "timestamp": 24,
        },
    )

    assert out["sentiment"]["signal"]["tone"] == "negative"
    assert out["sentiment"]["signal"]["label"] == "Sales rep tone: Needs reset"
    assert "AE" not in out["sentiment"]["signal"]["label"]
    assert out["sentiment"]["salesRepTone"]["label"] == "Needs reset"
    assert "Soften the wording" in out["sentiment"]["salesRepTone"]["guidance"]
    assert out["sentiment"]["salesRepTone"]["tone"] == "negative"


def test_internal_speaker_discovery_question_gets_actionable_tone_cue():
    ctx = TenantContext(tenant_id="test-tenant-sales-rep-discovery-tone", user_id="u1")
    call_id = "call-test-sales-rep-discovery-tone"

    out = analyze_segment(
        ctx,
        call_id,
        {
            "id": "sentiment-signal-sales-rep-question",
            "text": (
                "Understood. When you say AI-native for franchise ops, "
                "what's broken today across corporate and franchisees?"
            ),
            "speakerId": "ae-sarah",
            "speakerName": "Sarah",
            "speakerRole": "ae",
            "timestamp": 30,
        },
    )

    assert out["transcript"]["sentiment"] == "positive"
    assert out["sentiment"]["salesRepTone"]["label"] == "Empathetic discovery"
    assert out["sentiment"]["salesRepTone"]["guidance"].startswith("Good direction")


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
    assert out["sentiment"]["customerSentiment"]["label"] == "Buying confidence"


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
