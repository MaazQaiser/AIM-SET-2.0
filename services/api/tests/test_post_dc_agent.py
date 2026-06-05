from dc_core.tenancy import TenantContext
from fastapi.testclient import TestClient

from app.agents.post_dc_agent import run_post_dc_pipeline
from app.config import get_settings
from app.domain.calls_service import CallsService
from app.domain.dc_notes_repository import get_dc_notes_repository
from app.domain.kb_tenancy import resolve_kb_tenant
from app.domain.live_call_repository import get_live_call_repository
from app.domain.memory_store import get_memory_store
from app.main import app
from app.orchestrator.dispatcher import Orchestrator
from app.agents import live_call_session as agent_live_call_session
from app.domain import live_call_session as domain_live_call_session

client = TestClient(app)


def _clear_memory(monkeypatch):
    monkeypatch.setenv("SUPABASE_URL", "")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "")
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    get_settings.cache_clear()
    store = get_memory_store()
    store.calls.clear()
    store.call_briefs.clear()
    store.call_post_reviews.clear()
    store.kb_assets.clear()
    store.kb_chunks.clear()
    store.call_live_signals.clear()
    store.discovery_checklists.clear()
    store.live_sessions.clear()
    store.live_suggestions.clear()
    store.transcript_events.clear()
    store.agent_configs.clear()
    store.agent_runs.clear()
    store.audit.clear()
    agent_live_call_session._SESSIONS.clear()
    domain_live_call_session._sessions.clear()


def _discovery_snapshot():
    return {
        "result": {
            "callId": "call-post-agent",
            "checklist": {"bantCoverage": 0.5},
            "bantProgression": {
                "before": {"budget": "unknown", "authority": "unknown", "need": "partial", "timeline": "unknown"},
                "after": {"budget": "unknown", "authority": "partial", "need": "confirmed", "timeline": "partial"},
                "delta": 2,
                "isQualifying": False,
            },
            "openGaps": ["budget", "authority"],
        }
    }


def _qualifying_discovery_snapshot():
    return {
        "result": {
            "callId": "call-post-agent",
            "checklist": {"bantCoverage": 1.0},
            "bantProgression": {
                "before": {"budget": "partial", "authority": "partial", "need": "partial", "timeline": "partial"},
                "after": {"budget": "confirmed", "authority": "confirmed", "need": "confirmed", "timeline": "confirmed"},
                "delta": 4,
                "isQualifying": True,
            },
            "openGaps": [],
        }
    }


def test_post_dc_agent_heuristic_result_shape(monkeypatch):
    _clear_memory(monkeypatch)
    ctx = TenantContext(tenant_id="tenant-post-dc", user_id="user-post-dc")

    env = run_post_dc_pipeline(
        ctx,
        "call-post-agent",
        call={"id": "call-post-agent", "accountName": "Post Agent Co", "leadEmail": "buyer@example.com"},
        pre_dc_fields={
            "Company Name-PreDC": "Post Agent Co",
            "Industry - PreDC": "SaaS",
            "Have they described their needs": "Modernize the partner portal",
        },
        discovery_snapshot=_discovery_snapshot(),
        transcript_events=[
            {
                "speaker_name": "AE",
                "text": "I will send the case study and follow up with a technical workshop.",
            }
        ],
    )

    assert env.agent == "post_dc"
    assert env.operation == "review_produced"
    assert env.result["review"]["headline"]
    assert env.result["review"]["openDiscoveryGaps"] == ["budget", "authority"]
    scorecard_row = env.result["review"]["podScorecard"][0]
    assert scorecard_row["roleInCall"] == "Account Executive"
    assert scorecard_row["talkTimeSeconds"] > 0
    assert scorecard_row["areasToWork"]
    assert env.result["task"]["emailDraft"]["to"] == ["buyer@example.com"]
    assert env.result["task"]["clientEmailDraft"]["audience"] == "client"
    assert env.result["task"]["internalEmailDraft"]["audience"] == "internal"
    client_email_body = env.result["task"]["clientEmailDraft"]["body_markdown"]
    assert "BANT coverage" not in client_email_body
    assert "Open discovery gaps" not in client_email_body
    assert "A few takeaways" not in client_email_body
    assert "call centered on discovery" not in client_email_body
    assert "attachments" in env.result["task"]["emailDraft"]
    assert env.result["task"]["taskList"]
    assert "crmTasks" not in env.result["task"]
    assert all("crm_system" not in task for task in env.result["task"]["taskList"])
    assert env.result["jiraTicket"] is None


def test_post_dc_agent_generates_jira_draft_for_qualified_call(monkeypatch):
    _clear_memory(monkeypatch)
    ctx = TenantContext(tenant_id="tenant-post-dc", user_id="user-post-dc")

    env = run_post_dc_pipeline(
        ctx,
        "call-post-agent",
        call={"id": "call-post-agent", "accountName": "Qualified Co"},
        pre_dc_fields={"Company Name-PreDC": "Qualified Co", "Campaign Service - PreDC": "AI platform"},
        discovery_snapshot=_qualifying_discovery_snapshot(),
    )

    ticket = env.result["jiraTicket"]
    assert ticket is not None
    assert ticket["status"] == "draft_pending_approval"
    assert ticket["projectKey"] == "SALES"
    assert "description" in ticket
    assert "Client summary:" in ticket["description"]
    assert "Action items:" in ticket["description"]
    assert "BANT" not in ticket["description"]
    assert "Budget" not in ticket["description"]
    assert "subtasks" not in ticket


def test_post_dc_agent_polishes_kb_suggestions(monkeypatch):
    _clear_memory(monkeypatch)
    ctx = TenantContext(tenant_id="tenant-post-dc", user_id="user-post-dc")
    tenant_uuid, clerk_key = resolve_kb_tenant(ctx)
    get_memory_store().kb_chunks[clerk_key] = [
        {
            "tenant_id": tenant_uuid,
            "asset_id": "kb-shopify-stripe-reference",
            "chunk_text": (
                "Industry: Software & IT Services; "
                "LinkedIn Category / Sector: Software & IT Services; "
                "OS: N/A; Platform: N/A; Process: N/A; Skill: Socket; "
                "Technology: ExpressJS, NodeJS, React, Stripe, Shopify APIs, Zoho Email; "
                "Tool: N/A; Architecture: N/A; Cloud Service: AWS"
            ),
            "metadata": {"title": "Shopify and Stripe integration reference"},
        }
    ]

    env = run_post_dc_pipeline(
        ctx,
        "call-post-agent",
        call={"id": "call-post-agent", "accountName": "Post Agent Co"},
        pre_dc_fields={
            "Company Name-PreDC": "Post Agent Co",
            "Industry - PreDC": "Software & IT Services",
            "Campaign Service - PreDC": "Shopify APIs",
        },
        discovery_snapshot=_discovery_snapshot(),
    )

    suggestion = env.result["kbSuggestions"][0]
    assert suggestion["title"] == "Shopify and Stripe integration reference"
    assert suggestion["reason"] == (
        "Matches Software & IT Services with ExpressJS, NodeJS, React, Stripe, Shopify APIs, Zoho Email, AWS."
    )
    assert "N/A" not in suggestion["reason"]
    assert suggestion["suggestedUse"] == "Use as an industry-relevant proof point in the follow-up."


def test_post_dc_agent_attachment_section_uses_kb_and_content_gaps(monkeypatch):
    _clear_memory(monkeypatch)
    ctx = TenantContext(tenant_id="tenant-post-dc", user_id="user-post-dc")
    tenant_uuid, clerk_key = resolve_kb_tenant(ctx)
    get_memory_store().kb_chunks[clerk_key] = [
        {
            "tenant_id": tenant_uuid,
            "asset_id": "kb-ai-architecture",
            "chunk_text": "Industry: Retail; Technology: React, NodeJS, AWS; Service Line: AI platform",
            "metadata": {"title": "Retail AI reference architecture"},
        }
    ]

    env = run_post_dc_pipeline(
        ctx,
        "call-post-agent",
        call={"id": "call-post-agent", "accountName": "Attachment Co"},
        pre_dc_fields={
            "Company Name-PreDC": "Attachment Co",
            "Industry - PreDC": "Retail",
            "Campaign Service - PreDC": "AI platform",
        },
        call_brief={
            "contentToGenerate": [
                {
                    "id": "gap-roi",
                    "name": "CFO ROI one-pager",
                    "type": "one_pager",
                    "reason": "Need unit economics and year-one investment framing before it can be attached.",
                    "neededFor": "CFO readout",
                    "status": "missing",
                }
            ]
        },
        discovery_snapshot=_discovery_snapshot(),
    )

    attachments = env.result["emailAttachments"]
    assert attachments["found"][0]["assetId"] == "kb-ai-architecture"
    assert attachments["found"][0]["source"] == "knowledge_base"
    assert attachments["found"][0]["name"] == "Retail AI reference architecture"
    assert attachments["missing"][0]["name"] == "CFO ROI one-pager"
    assert "unit economics" in attachments["missing"][0]["requiredData"]
    assert attachments["missing"][0]["source"] == "content_gap"
    assert attachments["missing"][0]["contentStudioLink"].startswith("/content/studio")


def test_post_dc_agent_builds_email_tasks_and_assets_from_transcript_context(monkeypatch):
    _clear_memory(monkeypatch)
    ctx = TenantContext(tenant_id="tenant-post-dc", user_id="user-post-dc")

    env = run_post_dc_pipeline(
        ctx,
        "call-post-agent",
        call={"id": "call-post-agent", "accountName": "Context Co", "leadEmail": "buyer@example.com"},
        pre_dc_fields={"Company Name-PreDC": "Context Co"},
        discovery_snapshot=_discovery_snapshot(),
        transcript_events=[
            {
                "speaker_name": "Buyer",
                "speaker_role": "customer",
                "text": (
                    "We need POS integration details before the Q3 launch. "
                    "Can you send a security architecture and CFO ROI one-pager for our review?"
                ),
                "offset_seconds": 35,
            },
            {
                "speaker_name": "AE",
                "speaker_role": "ae",
                "text": "Yes, I will prepare those materials and schedule the review.",
                "offset_seconds": 80,
            },
        ],
    )

    client_email = env.result["task"]["clientEmailDraft"]
    internal_email = env.result["task"]["internalEmailDraft"]
    email_body = client_email["body_markdown"]
    task_descriptions = [task["description"] for task in env.result["task"]["taskList"]]
    missing_names = {item["name"] for item in env.result["emailAttachments"]["missing"]}

    assert client_email["audience"] == "client"
    assert internal_email["audience"] == "internal"
    assert "Minutes of meeting" in email_body
    assert "POS integration details" in email_body
    assert "BANT" not in email_body
    assert "Open discovery gaps" not in email_body
    assert "Jira" not in email_body
    assert "What we committed to" in email_body
    assert client_email["attachments"] == env.result["emailAttachments"]
    assert "BANT score" in internal_email["body_markdown"]
    assert "Next action items" in internal_email["body_markdown"]
    assert "Security architecture overview" in missing_names
    assert "CFO ROI one-pager" in missing_names
    assert any("Security architecture overview" in item for item in task_descriptions)
    assert any("POS integration details" in item for item in task_descriptions)


def test_post_dc_agent_scans_full_transcript_for_commitments(monkeypatch):
    _clear_memory(monkeypatch)
    ctx = TenantContext(tenant_id="tenant-post-dc", user_id="user-post-dc")
    transcript_events = [
        {
            "speaker_name": "AE",
            "speaker_role": "ae",
            "text": "I will send the security architecture and schedule the CFO review.",
            "offset_seconds": 20,
        }
    ]
    transcript_events.extend(
        {
            "speaker_name": "Buyer",
            "speaker_role": "customer",
            "text": f"Additional evaluation detail {idx}.",
            "offset_seconds": 30 + idx,
        }
        for idx in range(20)
    )

    env = run_post_dc_pipeline(
        ctx,
        "call-post-agent",
        call={"id": "call-post-agent", "accountName": "Transcript Co"},
        pre_dc_fields={"Company Name-PreDC": "Transcript Co"},
        discovery_snapshot=_discovery_snapshot(),
        transcript_events=transcript_events,
    )

    commitments = env.result["task"]["emailDraft"]["commitments_referenced"]
    assert any("security architecture" in item for item in commitments)
    assert any("CFO review" in item for item in commitments)
    assert env.result["agentInputs"]["transcriptEventCount"] == 21


def test_post_call_route_persists_review(monkeypatch):
    _clear_memory(monkeypatch)
    ctx = TenantContext(tenant_id="tenant-post-dc", user_id="user-post-dc")
    CallsService().sync_from_dc_notes(ctx)
    get_memory_store().upsert_calls(
        "tenant-post-dc",
        [
            {
                "id": "call-post-agent",
                "accountName": "Post Agent Co",
                "status": "live",
                "briefReady": False,
                "pod": [],
            }
        ],
    )

    headers = {"x-user-id": "user-post-dc", "x-tenant-id": "tenant-post-dc"}
    post = client.post("/api/v1/calls/call-post-agent/post-call", headers=headers)
    assert post.status_code == 200
    body = post.json()
    assert body["review"]["headline"]
    assert body["task"]["emailDraft"]["status"] == "draft_pending_approval"

    saved = CallsService().get_post_review(ctx, "call-post-agent")
    assert saved is not None
    assert saved["review"]["headline"] == body["review"]["headline"]

    fetched = client.get("/api/v1/calls/call-post-agent/post-call", headers=headers)
    assert fetched.status_code == 200
    assert fetched.json()["review"]["headline"] == body["review"]["headline"]


def test_post_call_review_save_uses_memory_when_supabase_tenant_resolution_fails(monkeypatch):
    _clear_memory(monkeypatch)
    from app.domain import calls_service as calls_service_module

    class _SupabaseEnabledSettings:
        supabase_configured = True
        kb_shared_mode = True
        kb_shared_tenant_key = "dc-copilot-shared"

    def _raise_tenant_resolution(*_args, **_kwargs):
        raise RuntimeError("tenant lookup unavailable")

    monkeypatch.setattr(calls_service_module, "get_settings", lambda: _SupabaseEnabledSettings())
    monkeypatch.setattr(calls_service_module, "resolve_team_tenant", _raise_tenant_resolution)
    monkeypatch.setattr(
        calls_service_module,
        "get_supabase",
        lambda: (_ for _ in ()).throw(AssertionError("Supabase should not be used after tenant fallback")),
    )

    ctx = TenantContext(tenant_id="tenant-post-dc", user_id="user-post-dc")
    payload = {"review": {"headline": "Review ready"}, "task": {"emailDraft": {"status": "draft_pending_approval"}}}

    service = CallsService()
    service.save_post_review(ctx, "call-post-agent", payload)

    saved = service.get_post_review(ctx, "call-post-agent")
    assert saved == payload
    stored_call = get_memory_store().list_calls("dc-copilot-shared")[0]
    assert stored_call["status"] == "completed"
    assert stored_call["metadata"]["post_call"] == payload


def test_live_call_inputs_flow_into_post_dc_review(monkeypatch):
    _clear_memory(monkeypatch)
    ctx = TenantContext(tenant_id="tenant-post-dc", user_id="user-post-dc")
    call_id = "call-live-to-post"
    store = get_memory_store()
    store.upsert_calls(
        "tenant-post-dc",
        [
            {
                "id": call_id,
                "accountName": "Live Signal Co",
                "leadEmail": "buyer@example.com",
                "status": "live",
                "briefReady": False,
                "pod": [],
                "bant": {
                    "budget": "unknown",
                    "authority": "unknown",
                    "need": "partial",
                    "timeline": "unknown",
                },
            }
        ],
    )

    orchestrator = Orchestrator()
    orchestrator.dispatch_live_segment(
        ctx,
        call_id,
        {
            "id": "seg-1",
            "speakerId": "buyer-1",
            "speakerName": "Buyer",
            "speakerRole": "customer",
            "text": "Budget is approved, the CFO owns the decision, and we need launch before the Q3 deadline.",
            "timestamp": 60,
        },
        elapsed_seconds=60,
    )

    post = orchestrator.dispatch_post_call(ctx, call_id)

    handoff = post["call_agent_outputs"]
    assert handoff["operation"] == "call_end_handoff"
    assert handoff["transcript"]["event_count"] == 1
    assert "Budget is approved" in handoff["transcript"]["full_text"]
    assert handoff["transcript_summary"]["headline"] == "1 transcript segments captured"
    assert handoff["bant"]["status"]["budget"] in ("partial", "confirmed")
    assert handoff["sentiment"]["event_counts"]
    assert handoff["defined_signals"]["signals"]
    assert handoff["summary"]["transcript_segments"] == 1
    assert post["agentInputs"]["hasCallAgentHandoff"] is True

    live_signals = post["live_signals"]
    assert live_signals["intent"]["label"] == "commercial_discovery"
    assert live_signals["top_keywords"]
    assert "Budget & commercial discovery" in live_signals["focus_areas"]
    assert any(
        "Dominant live-call intent: commercial_discovery." == item
        for item in post["review"]["summary"]
    )
    assert any(item.startswith("Focus areas:") for item in post["review"]["summary"])
    assert post["envelope"]["citations"][0]["source_type"] == "transcript"
    assert "Budget is approved" in post["envelope"]["citations"][0]["snippet"]
    assert any(
        "Budget & commercial discovery" in item
        for item in post["task"]["emailDraft"]["commitments_referenced"]
    )

    saved = CallsService().get_post_review(ctx, call_id)
    assert saved is not None
    assert saved["review"]["headline"] == post["review"]["headline"]
    assert store.call_live_signals["tenant-post-dc"][call_id]["intent"]["label"] == "commercial_discovery"


def test_end_live_call_preserves_live_outputs_for_post_dc(monkeypatch):
    _clear_memory(monkeypatch)
    ctx = TenantContext(tenant_id="tenant-post-dc", user_id="user-post-dc")
    call_id = "call-live-end-to-post"
    store = get_memory_store()
    store.upsert_calls(
        "tenant-post-dc",
        [
            {
                "id": call_id,
                "accountName": "Live End Co",
                "leadEmail": "buyer@example.com",
                "status": "live",
                "briefReady": False,
                "pod": [],
                "bant": {
                    "budget": "unknown",
                    "authority": "unknown",
                    "need": "partial",
                    "timeline": "unknown",
                },
            }
        ],
    )

    orchestrator = Orchestrator()
    orchestrator.dispatch_live_segment(
        ctx,
        call_id,
        {
            "id": "seg-1",
            "speakerId": "buyer-1",
            "speakerName": "Buyer",
            "speakerRole": "customer",
            "text": "Budget is approved and the CFO owns the decision.",
            "timestamp": 60,
        },
        elapsed_seconds=60,
    )

    ended = orchestrator.dispatch_call_end(ctx, call_id)
    post = ended["post_call"]

    assert post["live_signals"]["intent"]["label"] == "commercial_discovery"
    assert post["agentInputs"]["hasLiveSignalSnapshot"] is True
    assert post["agentInputs"]["hasCallAgentHandoff"] is True
    assert post["agentInputs"]["transcriptEventCount"] == 1
    assert post["call_agent_outputs"]["bant"]["status"]["budget"] in ("partial", "confirmed")

    saved_session = store.live_sessions["tenant-post-dc"][call_id]
    assert saved_session["status"] == "ended"
    assert saved_session["summary"]["operation"] == "call_end_handoff"
    assert saved_session["summary"]["transcript"]["event_count"] == 1
    assert saved_session["summary"]["summary"]["transcript_segments"] == 1


def test_post_dc_replays_fragmented_live_bant_into_summary_and_follow_up(monkeypatch):
    _clear_memory(monkeypatch)
    ctx = TenantContext(tenant_id="tenant-post-dc", user_id="user-post-dc")
    call_id = "call-fragmented-post-dc"
    account_name = "Fragmented Post DC Co"
    store = get_memory_store()
    store.upsert_calls(
        "tenant-post-dc",
        [
            {
                "id": call_id,
                "accountName": account_name,
                "leadEmail": "buyer@example.com",
                "status": "live",
                "briefReady": False,
                "pod": [],
                "bant": {
                    "budget": "unknown",
                    "authority": "unknown",
                    "need": "unknown",
                    "timeline": "unknown",
                },
            }
        ],
    )
    get_dc_notes_repository().upsert_pre_dc(
        ctx,
        [
            {
                "id": "pre-fragmented-post-dc",
                "fields": {
                    "Company Name-PreDC": account_name,
                    "Have they described their needs": "Modernize legacy portal",
                },
            }
        ],
    )

    orchestrator = Orchestrator()
    segments = [
        (
            "seg-need",
            "This is a critical priority: we need to replace manual follow-up tracking and automate onboarding.",
            30,
        ),
        ("seg-budget-prefix", "The budget approved is around", 47),
        ("seg-budget-value", "400k", 51),
        ("seg-authority", "The CFO owns the decision and can approve it.", 54),
        (
            "seg-timeline",
            "The deadline for our project timeline will be not more than three months.",
            56,
        ),
        (
            "seg-follow-up",
            "Please send an implementation plan and schedule the review with our CFO next week.",
            64,
        ),
    ]
    for segment_id, text, timestamp in segments:
        orchestrator.dispatch_live_segment(
            ctx,
            call_id,
            {
                "id": segment_id,
                "speakerId": "buyer-1",
                "speakerName": "Buyer",
                "speakerRole": "customer",
                "text": text,
                "timestamp": timestamp,
            },
            elapsed_seconds=timestamp,
        )

    post = orchestrator.dispatch_post_call(ctx, call_id)
    review = post["review"]
    review_text = " ".join(
        [
            review["headline"],
            *review["summary"],
            *[f"{item['label']} {item['note']}" for item in review["learned"]],
        ]
    )
    task_text = " ".join(task["description"] for task in post["task"]["taskList"])
    client_email_text = " ".join(
        [
            post["task"]["clientEmailDraft"]["body_markdown"],
            *post["task"]["clientEmailDraft"]["commitments_referenced"],
        ]
    )
    internal_email_text = post["task"]["internalEmailDraft"]["body_markdown"]
    missing_content_text = " ".join(
        f"{item['name']} {item['requiredData']}"
        for item in post["emailAttachments"]["missing"]
    )
    bant_after = post["coaching"]["bantProgression"]["after"]

    assert bant_after["budget"] == "confirmed"
    assert bant_after["authority"] == "confirmed"
    assert bant_after["need"] == "confirmed"
    assert bant_after["timeline"] == "confirmed"
    assert review["discoveryBantCoverage"] == 1.0
    assert review["openDiscoveryGaps"] == []
    assert "Modernize legacy portal" not in review["summary"][0]
    assert review_text.lower().find("400k") != -1
    assert review_text.lower().find("not more than three months") != -1
    assert review_text.lower().find("cfo") != -1
    assert review_text.lower().find("manual follow-up tracking") != -1
    assert client_email_text.lower().find("implementation plan") != -1
    assert client_email_text.lower().find("cfo next week") != -1
    assert "BANT" not in client_email_text
    assert "Open discovery gaps" not in client_email_text
    assert internal_email_text.lower().find("400k") != -1
    assert internal_email_text.lower().find("not more than three months") != -1
    assert task_text.lower().find("implementation plan") != -1
    assert task_text.lower().find("schedule the review with our cfo next week") != -1
    assert missing_content_text.lower().find("implementation plan") != -1
    assert post["jiraTicket"] is not None
    assert all(post["jiraTicket"]["bantSnapshot"].values())


def test_post_dc_replays_misattributed_recall_transcript_into_bant(monkeypatch):
    _clear_memory(monkeypatch)
    ctx = TenantContext(tenant_id="tenant-post-dc", user_id="user-post-dc")
    call_id = "call-misattributed-recall"
    account_name = "Misattributed Recall Co"
    store = get_memory_store()
    store.upsert_calls(
        "tenant-post-dc",
        [
            {
                "id": call_id,
                "accountName": account_name,
                "leadEmail": "buyer@example.com",
                "status": "live",
                "briefReady": False,
                "pod": [],
                "bant": {
                    "budget": "unknown",
                    "authority": "unknown",
                    "need": "unknown",
                    "timeline": "unknown",
                },
            }
        ],
    )
    get_dc_notes_repository().upsert_pre_dc(
        ctx,
        [
            {
                "id": "pre-misattributed-recall",
                "fields": {
                    "Company Name-PreDC": account_name,
                    "Have they described their needs": "Modernize legacy portal",
                },
            }
        ],
    )

    repo = get_live_call_repository()
    for idx, (text, offset) in enumerate(
        [
            ("i have budget around", 54),
            ("400k", 59),
            (
                "and the deadline for our project timeline will be not more than three months",
                62,
            ),
        ],
        start=1,
    ):
        repo.append_transcript_event(
            ctx,
            call_id,
            {
                "id": f"seg-misattributed-{idx}",
                "speaker_id": "100",
                "speaker_name": "Sales Rep",
                "speaker_role": "ae",
                "text": text,
                "offset_seconds": offset,
                "provider": "recall",
                "provider_event_id": f"seg-misattributed-{idx}",
            },
        )

    # Simulate a restart or stale saved review: no live checklist remains, so wrap-up
    # must repair BANT from the persisted completed transcript.
    store.discovery_checklists.clear()

    post = Orchestrator().dispatch_post_call(ctx, call_id)
    review_text = " ".join(
        [
            *post["review"]["summary"],
            *[f"{item['label']} {item['note']}" for item in post["review"]["learned"]],
        ]
    ).lower()
    after = post["coaching"]["bantProgression"]["after"]

    assert after["budget"] in ("partial", "confirmed")
    assert after["timeline"] == "confirmed"
    assert post["review"]["discoveryBantCoverage"] > 0
    assert "Modernize legacy portal" not in post["review"]["summary"][0]
    assert "400k" in post["review"]["summary"][0]
    assert "bant coverage finished at 0%" not in review_text
    assert "400k" in review_text
    assert "not more than three months" in review_text
    assert "timeline" not in post["review"]["openDiscoveryGaps"]
    assert "400k" in post["task"]["internalEmailDraft"]["body_markdown"].lower()
    assert "not more than three months" in post["task"]["clientEmailDraft"]["body_markdown"].lower()


def test_jira_route_fails_closed_when_unconfigured(monkeypatch):
    _clear_memory(monkeypatch)
    headers = {"x-user-id": "user-post-dc", "x-tenant-id": "tenant-post-dc"}
    res = client.post(
        "/api/v1/integrations/jira/tickets",
        json={"summary": "Draft", "description": "Body", "projectKey": "SALES", "issueType": "Review"},
        headers=headers,
    )
    assert res.status_code == 503
