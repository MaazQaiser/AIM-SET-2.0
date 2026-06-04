# Agent Specifications: AI-Native Discovery Call Platform
**Companion to:** `01_PRD.md`, `02_Architecture.md`
**Version:** 0.1 (Draft)
**Owner:** Ahmad
**Last updated:** May 2026

---

## How to read this document

Each agent spec follows the same structure:

- **Purpose** — what this agent exists to do, in one sentence
- **Triggers** — what events cause this agent to run
- **Inputs** — the structured data the agent receives
- **Outputs** — the structured data the agent must produce, including the mandatory citation envelope
- **Tools available** — which deterministic tools the agent may call
- **Reasoning approach** — how the agent should think about its work (high-level prompt strategy, not literal prompts)
- **Success criteria** — how we know it's working
- **Failure modes** — what goes wrong and how the system handles it
- **Handoffs** — what other agents pick up where this one stops

Agents communicate only through the Lead Orchestrator. No direct agent-to-agent calls. This is enforced architecturally.

---

## Universal Output Envelope

Every agent returns this structure. The orchestrator rejects outputs that don't validate.

```json
{
  "agent": "live_call | content | knowledge | coaching | task",
  "operation": "string identifying what was done",
  "result": { /* operation-specific payload */ },
  "citations": [
    {
      "source_type": "kb_document | transcript | crm_record | prior_call | external",
      "source_id": "string",
      "snippet": "string showing the evidence",
      "confidence": 0.0
    }
  ],
  "confidence": 0.0,
  "cost": { "tokens": 0, "usd": 0.0, "model": "string" },
  "trace_id": "string"
}
```

Operations with no factual claims (e.g., "draft a creative slide title") may return `citations: []` only if the output is explicitly marked `creative: true`. Anything factual without citations is rejected.

---

## Agent 1: Live Call Agent

### Purpose
Operate the live-call experience: feed the pod with relevant signal in real time while the call is happening, without breaking the flow of conversation.

### Triggers
- New transcript segment arrives on the WebSocket (every ~2s during a live call)
- Pod member submits a bot-chat query
- Call-end signal (cleanup, final state emission)

### Inputs
- Current transcript window (last 60 seconds, full call context available on demand)
- Call session state (pod members, account ID, pre-DC brief reference, KB version)
- Pod member identity (for routing role-specific cues)

### Outputs
Four operation types:

1. **Proactive nudge**
   ```json
   {
     "operation": "proactive_nudge",
     "result": {
       "target_role": "AE | SE | Designer",
       "nudge_type": "objection_handler | reference_asset | discovery_question | risk_flag",
       "content": "short actionable text, under 25 words",
       "suggested_action": "show_asset | ask_question | acknowledge | dismiss"
     }
   }
   ```
2. **Bot-chat response**
   ```json
   {
     "operation": "bot_chat_response",
     "result": {
       "answer": "grounded answer to pod member's query",
       "asset_refs": ["kb_doc_id_1", "kb_doc_id_2"]
     }
   }
   ```
3. **Signal annotation** (background, not user-facing in real time, drives downstream coaching)
   ```json
   {
     "operation": "signal_annotation",
     "result": {
       "signal_type": "objection_raised | commitment_made | competitor_mentioned | budget_signal | timeline_signal",
       "speaker": "string",
       "transcript_offset_seconds": 0,
       "extracted_value": "string"
     }
   }
   ```
4. **Call-end handoff** (canonical Post-DC input)
   ```json
   {
     "operation": "call_end_handoff",
     "result": {
       "transcript": {
         "event_count": 0,
         "events": [
           {
             "speaker_name": "string",
             "speaker_role": "customer | ae | se | designer",
             "offset_seconds": 0,
             "text": "string",
             "keywords": [],
             "sentiment": "positive | neutral | negative",
             "signal_type": "string | null"
           }
         ],
         "full_text": "speaker-attributed transcript"
       },
       "transcript_summary": {
         "headline": "string",
         "bullets": [],
         "top_keywords": [],
         "signal_counts": {},
         "sentiment_counts": {}
       },
       "defined_signals": {
         "signal_counts": {},
         "signals": []
       },
       "bant": {
         "coverage": 0.0,
         "status": { "budget": "unknown | partial | confirmed", "authority": "unknown | partial | confirmed", "need": "unknown | partial | confirmed", "timeline": "unknown | partial | confirmed" },
         "progression": { "before": {}, "after": {}, "delta": 0, "isQualifying": false },
         "open_gaps": [],
         "signals": []
       },
       "sentiment": {
         "ae_score": 0.0,
         "customer_score": 0.0,
         "sales_rep_tone": {},
         "customer_sentiment": {},
         "sentiment_shift": {},
         "event_counts": {},
         "signals": []
       },
       "summary": {
         "headline": "string",
         "bullets": [],
         "intent_snapshot": {},
         "focus_areas": [],
         "pains": [],
         "suggestion_counts": {},
         "accepted": 0,
         "dismissed": 0,
         "total_suggestions": 0,
         "transcript_segments": 0
       }
     }
   }
   ```

### Tools available
- `transcribe` (streaming, owned by infra, not called per-segment)
- `sentiment` (per-utterance, returns valence + intensity)
- `keyword_extract` (extracts terminology, jargon, named entities)
- `retrieve_kb` (semantic search against KB, returns top-K chunks with metadata)
- `citation_track` (validates that any factual claim in output is grounded)

### Reasoning approach

The Live Call Agent does **not** run an LLM call on every transcript segment. That would be ruinous on cost and latency. Instead:

1. **Cheap pass on every segment.** Keyword extract + sentiment. Deterministic, fast, sub-100ms.
2. **Trigger-based LLM call.** Only when the cheap pass detects a *triggering signal*: a competitor name, a budget keyword, a pain point matching the ICP, a question directed at a specific pod role, a sentiment shift. Then run a constrained LLM call to produce a nudge.
3. **Bot-chat queries always run an LLM call.** Latency budget 5s, model tier should be fast (lower-cost Claude variant for chat-style retrieval).
4. **Throttling.** Hard cap of N nudges per 5-minute window per pod member, where N is a policy setting (default: 3). Cognitive load is the bigger risk than missing a nudge.

### Success criteria
- ≥40% of proactive nudges are acted on (accepted or partially used)
- Bot-chat answers cite a valid KB source ≥98% of the time
- 95th percentile bot-chat response time ≤5s
- Pod members rate live experience ≥4/5 post-call

### Failure modes
- *Nudge fatigue*: too many nudges → throttle aggressively, learn from dismissals
- *Hallucinated reference*: nudge mentions an asset that doesn't exist → orchestrator validates asset_refs before delivery
- *Latency spike*: LLM provider slow → fallback to keyword-only nudges, log degradation
- *Wrong role routing*: technical nudge sent to AE → role classifier improvement loop; misrouted nudges captured for retraining

### Handoffs
- Signal annotations flow to Coaching Agent post-call
- Asset references that were used flow to Knowledge Agent (effectiveness tracking)
- Call-end signal triggers Task Agent and Coaching Agent via orchestrator

---

## Agent 2: Content Agent

### Purpose
Find, assemble, and (when needed) draft content artifacts — pre-call briefs, deck assemblies, slide drafts, one-pagers — grounded in the KB.

### Triggers
- Pre-DC brief generation request (scheduled, T-4 hours before call)
- AE in-call request: "build me a 3-slide story on [topic]"
- Content gap detected: a pain point was raised in a call with no matching asset
- Manual content generation request from leadership

### Inputs
- Account context (ICP match, BANT, prior interactions)
- Pod composition for the call
- Specific intent (brief, deck, one-pager, slide insert)
- KB access (read-only)

### Outputs

1. **Pre-DC brief**
   ```json
   {
     "operation": "pre_dc_brief",
     "result": {
       "account_snapshot": "...",
       "persona_profiles": [...],
       "bant_scorecard": {...},
       "hypothesized_pains": [...],
       "recommended_deck": ["slide_id_1", "slide_id_2", ...],
       "discovery_questions": [...],
       "anticipated_objections": [...],
       "role_specific_notes": { "AE": "...", "SE": "...", "Designer": "..." }
     }
   }
   ```
2. **Deck assembly**
   ```json
   {
     "operation": "deck_assembly",
     "result": {
       "title": "string",
       "slides": [
         { "source_slide_id": "string", "rationale": "why this slide", "position": 1 }
       ],
       "estimated_runtime_minutes": 0
     }
   }
   ```
3. **Draft asset** (for content gaps)
   ```json
   {
     "operation": "draft_asset",
     "result": {
       "asset_type": "slide | one_pager | mini_case_study",
       "draft_content": "...",
       "rationale": "what gap this fills",
       "review_required_from": "string (content owner)"
     }
   }
   ```

### Tools available
- `retrieve_kb`
- `embedding`
- `deck_generate` (stitches slides into a coherent deck; handles layout, transitions)
- `citation_track`

### Reasoning approach

For pre-DC briefs:
1. Pull account context from CRM and ICP system
2. Retrieve top-K similar prior calls for pattern matching
3. Retrieve top-K assets aligned to hypothesized pain points
4. Synthesize brief with explicit "because…" reasoning for each recommendation
5. Generate role-specific cuts by filtering brief sections through role lens

For in-call deck assembly:
1. Parse AE's request into intent (problem, audience, runtime budget)
2. Retrieve candidate slides with metadata (topic, persona-fit, deal-stage-fit)
3. Sequence by narrative arc (context → problem → solution → evidence → ask)
4. Return with rationale per slide so AE can quickly swap if needed

For draft asset generation: this is the rare case where the agent produces net-new content. Always marked `review_required_from` — never auto-published.

### Success criteria
- Pre-DC brief opened by AE ≥85% of the time
- Recommended deck slides used ≥60% of the time without modification
- AE satisfaction with brief quality ≥4.2/5
- Draft assets approved (with minor edits) ≥50% of the time

### Failure modes
- *Stale KB*: recommendation cites deprecated asset → ingestion pipeline must enforce versioning, agent filters deprecated content
- *Generic brief*: brief lacks account-specific signal → require ≥3 account-specific data points or flag as low confidence
- *Bad sequencing*: deck doesn't flow → narrative-arc heuristic enforced; AE feedback loop refines

### Handoffs
- Brief delivered to pod via notification system
- Deck assembly stored, referenced by Live Call Agent if used in call
- Draft assets flow to Knowledge Agent for review workflow

---

## Agent 3: Knowledge Agent

### Purpose
Maintain the integrity, freshness, and effectiveness of the Knowledge Base. The KB is the substrate; this agent is its keeper.

### Triggers
- New asset ingestion (manual upload or system event)
- Scheduled: nightly re-embedding sweep for changed content
- Asset effectiveness signals from other agents
- Content owner workflow events (review, approve, deprecate)

### Inputs
- Raw assets (PPTX, PDF, DOCX, MD, structured data)
- Metadata: tags, ownership, deal-stage relevance, persona fit
- Effectiveness signals: which assets were used, in what calls, with what outcomes

### Outputs

1. **Ingestion record**
   ```json
   {
     "operation": "ingest_asset",
     "result": {
       "asset_id": "string",
       "asset_type": "string",
       "chunks_created": 0,
       "embeddings_generated": 0,
       "tags_extracted": [...],
       "duplicate_of": "string | null"
     }
   }
   ```
2. **Effectiveness update**
   ```json
   {
     "operation": "effectiveness_update",
     "result": {
       "asset_id": "string",
       "usage_count_delta": 0,
       "positive_outcome_rate": 0.0,
       "recommend_action": "promote | maintain | deprecate"
     }
   }
   ```
3. **Deprecation flag**
   ```json
   {
     "operation": "flag_deprecation",
     "result": {
       "asset_id": "string",
       "reason": "outdated | superseded | low_effectiveness | content_owner_request",
       "review_required_from": "string"
     }
   }
   ```

### Tools available
- `embedding`
- `retrieve_kb` (for duplicate detection)
- `pii_redact` (for transcripts entering KB)

### Reasoning approach

Knowledge Agent is the least "agentic" agent — most of what it does is mechanical (ingestion, chunking, embedding). The reasoning lives in:
1. **Duplicate detection** — when a new asset is too similar to an existing one, route to content owner
2. **Tag inference** — extract persona/industry/stage tags from content; conservative on auto-tagging, prefer human confirmation
3. **Effectiveness scoring** — correlate asset usage with downstream call outcomes; recommend deprecation when correlation is consistently negative or zero

### Success criteria
- 100% of ingested assets have embeddings within 10 minutes of upload
- Retrieval precision (relevant docs in top-5): ≥85%
- Effectiveness scores correlate with human assessment ≥0.7
- Zero unauthorized PII in KB

### Failure modes
- *Embedding drift*: model upgrades change embedding space → version embeddings, re-embed on model change
- *Tag noise*: bad auto-tags pollute retrieval → require human confirmation for low-confidence tags
- *PII leak*: redaction misses something → conservative defaults, human audit on sampled ingestions

### Handoffs
- KB changes notify all other agents (cache invalidation)
- Deprecation flags route to content owner via Task Agent

---

## Agent 4: Coaching Agent

### Purpose
Produce coaching insights for Sales Leadership: per-call scorecards, per-person coaching recommendations, win-loss pattern analysis, content-effectiveness rollups.

### Triggers
- Call-end (single-call scorecard)
- Weekly scheduled run (team-level rollup, coaching candidates)
- Monthly run (win-loss patterns, cohort analysis)
- Leadership ad-hoc query: "why are we losing in [industry]?"

### Inputs
- Transcripts and signal annotations from Live Call Agent
- Pre-DC briefs (to compare plan vs execution)
- Outcome data: did the deal progress, did it close, did it stall, where
- Pod composition and role attribution
- Aggregate data across the team / time window for rollups

### Outputs

1. **Per-call scorecard**
   ```json
   {
     "operation": "call_scorecard",
     "result": {
       "call_id": "string",
       "overall_quality": 0.0,
       "bant_progression": { "before": {}, "after": {}, "delta": {} },
       "pod_performance": {
         "AE": { "score": 0.0, "strengths": [...], "improvements": [...] },
         "SE": { "score": 0.0, "strengths": [...], "improvements": [...] },
         "Designer": { "score": 0.0, "strengths": [...], "improvements": [...] }
       },
       "key_moments": [
         { "timestamp": 0, "moment_type": "string", "description": "..." }
       ]
     }
   }
   ```
2. **Coaching recommendation**
   ```json
   {
     "operation": "coaching_recommendation",
     "result": {
       "target_person": "string",
       "pattern_observed": "string (e.g., 'consistently misses budget discovery')",
       "evidence_call_ids": [...],
       "recommended_action": "1:1 topic | training module | shadowing session",
       "urgency": "low | medium | high"
     }
   }
   ```
3. **Win-loss insight**
   ```json
   {
     "operation": "win_loss_insight",
     "result": {
       "pattern": "string",
       "scope": "industry | persona | deal_size | pod_composition",
       "evidence_sample": [...],
       "implication": "string",
       "suggested_response": "string"
     }
   }
   ```

### Tools available
- `summarize`
- `score_bant`
- `retrieve_kb`
- `citation_track`

### Reasoning approach

This is the most reasoning-heavy agent. It needs to:
1. Compare individual calls to the pre-DC plan (was the plan executed?)
2. Aggregate signals across many calls to find patterns
3. Distinguish *individual* coaching needs from *systemic* problems (training gap vs missing collateral vs bad ICP)
4. Frame insights for the audience (Sales Leadership cares about action, not data dumps)

Coaching outputs must be **actionable, specific, and evidence-cited**. A coaching recommendation like "be better at discovery" is useless. "On 4 of the last 6 calls with CIO-level prospects, [AE] didn't ask any budget questions in the first 20 minutes; recommend pairing on the next CIO call with [Senior AE]" — that's actionable.

### Success criteria
- Coaching recommendations acted on by leadership ≥50% of the time
- Leadership rates weekly insights ≥4/5 for usefulness
- Win-loss patterns surface root causes that humans hadn't already identified ≥1/month
- Zero false-pattern claims (every claim has evidence)

### Failure modes
- *Pattern from too few samples*: agent claims a pattern from 2 data points → minimum N for any pattern claim, configurable per pattern type
- *Stale criticism*: agent flags an old weakness someone already worked on → coaching has a memory; previously-flagged patterns marked resolved
- *Bias against newer pod members*: scoring penalizes inexperience → adjust scoring by tenure context

### Handoffs
- Scorecards visible to pod members in their app surfaces
- Coaching recommendations delivered to leadership dashboard
- Aggregate insights inform Knowledge Agent's effectiveness scoring

---

## Agent 5: Task Agent

### Purpose
Turn call outcomes into concrete next-step artifacts: follow-up emails, CRM tasks, internal notifications, content-gap requests. The "muscle" agent — it executes.

### Triggers
- Call-end event
- AE approval on a draft (e.g., approve email → send)
- Content gap signal from Live Call Agent
- Scheduled: stale-task sweeps

### Inputs
- Live Call Agent `call_end_handoff`: transcript, transcript summary, defined signals, BANT, sentiment, and live summary
- Call summary and signal annotations
- Pod identities and CRM mappings
- AE writing style (learned from prior approved emails)
- Commitments made during call (extracted by Live Call Agent)

### Outputs

1. **Draft follow-up email**
   ```json
   {
     "operation": "draft_email",
     "result": {
       "to": ["..."],
       "cc": ["..."],
       "subject": "string",
       "body_markdown": "string",
       "style_signals": ["learned from AE's prior emails"],
       "commitments_referenced": [...],
       "status": "draft_pending_approval"
     }
   }
   ```
2. **CRM task creation**
   ```json
   {
     "operation": "create_crm_task",
     "result": {
       "crm_system": "hubspot | salesforce",
       "task_type": "follow_up | internal_review | content_request | schedule_next_meeting",
       "owner": "string",
       "due_date": "ISO date",
       "description": "string",
       "related_record_ids": [...],
       "status": "created"
     }
   }
   ```
3. **Internal notification**
   ```json
   {
     "operation": "notify_internal",
     "result": {
       "recipients": [...],
       "channel": "slack | email | in_app",
       "message": "string",
       "urgency": "low | medium | high"
     }
   }
   ```

### Tools available
- `draft_email`
- `task_create` (CRM adapter)
- `summarize`
- `citation_track`

### Reasoning approach

Task Agent prioritizes **freshness, accuracy, and approval workflow integrity** over creativity.

For email drafts:
1. Extract commitments from call (what the AE said they'd do)
2. Match commitments to assets in KB (if AE said "I'll send the case study," find the case study)
3. Compose in AE's voice — style signals learned from approved emails
4. Mark as draft; AE must approve before send
5. Capture AE's edits to feed back into style learning

For CRM tasks:
1. Determine task ownership based on commitment + pod role
2. Set due date based on commitment urgency (default 48 hours if not specified)
3. Link to CRM records (account, opportunity, contact)
4. Create as actual CRM record via adapter

Critical rule: **nothing outbound without explicit AE approval.** Internal notifications and CRM tasks can be auto-created; anything leaving the org to a customer is staged.

### Success criteria
- Email drafts approved with no or minor edits ≥70% of the time
- CRM tasks created within 60s of call-end ≥95% of the time
- Zero unauthorized outbound sends
- AE post-call admin time reduced by ≥80% vs baseline

### Failure modes
- *Email tone mismatch*: draft doesn't sound like the AE → style learning improves with feedback; AE can override style
- *Wrong CRM mapping*: task created on wrong opportunity → adapter validates mapping; fails closed if ambiguous
- *Missed commitment*: AE made a commitment that wasn't extracted → Live Call Agent extraction quality is the upstream fix
- *CRM API failure*: task creation fails → retry queue with backoff, alert AE after 3 failures

### Handoffs
- Approved emails sent via email infra; approval event logged
- CRM tasks visible in CRM and in DC Copilot UI
- Content-gap requests routed to Knowledge Agent for triage

---

## Cross-Agent Concerns

### Cost discipline
- Every agent calls `cost_check` before any LLM operation above a cost threshold
- Live Call Agent has the tightest budget; Coaching Agent has more headroom (async, higher-value)
- Per-call cost cap enforced at orchestrator: if hit, expensive operations queue or degrade

### Evidence discipline
- Every factual claim in any output has a citation
- Orchestrator validates citations against source store before forwarding output to UI
- Outputs that fail validation are retried with stronger grounding; persistent failures are dropped with logging

### Audit discipline
- Every agent action logged: who triggered, what was decided, what tools were called, what was produced
- Audit log is immutable and queryable
- Sampled reasoning traces stored for debugging (full traces are too expensive; sample at 5–10%)

### Prompt versioning
- Every prompt has a version number
- Prompt changes go through review and shadow-testing before production
- A/B testing infra so prompt changes are measured, not assumed

### Continuous improvement
- Every agent emits training signals: dismissed nudges, edited emails, overridden scores
- Weekly review of signals feeds prompt and tool improvements
- Quarterly model evaluation: are we on the right model tier per agent?
