# PRD: AI-Native Discovery Call Platform
**Working title:** *DC Copilot* (placeholder — naming TBD)
**Version:** 0.1 (Draft for review)
**Owner:** Ahmad (Principal Product Designer, reloadux / Tkxel)
**Status:** Pre-development, scoping phase
**Last updated:** May 2026

---

## 1. Executive Summary

DC Copilot is an AI-native, multi-agent platform that operates the Discovery Call (DC) layer of an IT services firm's sales motion. It owns the workflow from the moment an Account Executive opens their pre-call brief to the moment a follow-up email lands in the prospect's inbox and a task is created in the CRM.

The platform is built for **Sales Leadership and RevOps** as the primary owners. Account Executives, Solutions Engineers, and Designers (the "PCL" pod) are the daily users producing the data; leadership uses the platform to coach the team, govern AI behavior, and read win-loss patterns across the pipeline.

Three things make this platform different from the existing crowd of meeting-bot tools (Gong, Chorus, Fireflies, Otter):

1. **It is proactive, not just observational.** It anticipates objections, surfaces collateral mid-call, drafts deliverables, and creates tasks without being asked.
2. **It is pod-aware.** Discovery calls in IT services involve a cross-functional pod (AE + SE + Designer + occasionally a Domain SME). DC Copilot assigns role-specific cues to each pod member in real time.
3. **It treats evidence as a first-class requirement.** Every suggestion the AI makes is grounded in a citation — a knowledge base document, a transcript moment, an ICP attribute, or a prior call. No untraceable advice.

---

## 2. Problem Statement

### Today's pain (the bull case for building this)

Discovery calls in IT services firms suffer from four compounding problems:

1. **Pod misalignment.** The AE, SE, and Designer often haven't synced on what this specific account needs. They show up with generic decks and discover the customer's actual context mid-call.
2. **Collateral is a graveyard.** Companies have hundreds of decks, case studies, before/after artifacts, and reference architectures. AEs can't find the right one in the moment. They default to the same five slides everyone uses.
3. **Post-call drag.** Follow-up emails, CRM updates, and task creation get done badly or late. The freshness window where the prospect is warm closes before action.
4. **Coaching at scale is impossible.** Sales Leadership cannot listen to every call. Existing tools (Gong, Chorus) record and tag, but they don't tell leadership *what specifically to coach this AE on this week*.

### What success looks like (the leadership-level outcome)

Sales Leadership / RevOps can answer four questions on a Monday morning that they cannot answer today:

- Which DCs this week went well, which went badly, and *why* — grounded in evidence, not hunch?
- Which AE / SE / Designer needs which specific coaching intervention this week?
- Which content assets are working in which buyer-persona conversations, and which are dead weight?
- Where is the pipeline leaking between DC and the next stage, and what's the root cause?

---

## 3. Scope

### In scope (v1)

- The full Discovery Call workflow: Pre-DC preparation, Live Call assistance, Post-DC artifacts
- A unified knowledge base ingesting decks, case studies, before/after artifacts, ICP definitions, BANT framework data
- Multi-agent orchestration for live and async tasks
- Sales leadership dashboard with team-level analytics, coaching surfaces, and governance controls
- CRM integration (HubSpot and Salesforce, adapter pattern)
- Meeting platform integration (Zoom, Google Meet, Microsoft Teams)
- AI cost governance, compliance audit logs, and prompt/response tracing

### Out of scope (v1, deferred to later versions)

- Lead generation, enrichment, ICP discovery — already handled upstream by other systems
- Proposal generation, SOW drafting, contract workflow — happens after DC, future scope
- Customer-facing surfaces (this platform is internal-only in v1)
- Marketing-tier analytics (attribution, campaign performance)
- Multi-language live transcription (English-only in v1; i18n is a v2 conversation)

### Explicit non-goals

- This is **not** a Gong replacement. Gong is a recording-and-tagging tool. DC Copilot is a workflow operator that happens to use recordings as one input.
- This is **not** a general meeting assistant. The platform is purpose-built for the DC stage of the IT services sales motion. Other meeting types are out of scope.

---

## 4. Users and Jobs to Be Done

### Primary persona: Sales Leadership / RevOps

**Profile.** VP Sales, Director of Revenue Operations, Sales Enablement Lead. Owns the team's number and the systems that produce it. Typically 5–15 years of experience. Lives in dashboards, calls, and 1:1s.

**Jobs to be done.**

- *When I review the team's week, I want to know which calls need my attention, so I can coach the right person on the right thing before more deals slip.*
- *When I evaluate our content library, I want to know what's actually being used and what's working, so I can kill dead assets and commission new ones.*
- *When I approve AI usage in the org, I want clear evidence that the system is safe, auditable, and cost-controlled, so I can defend the spend and the risk profile.*
- *When I forecast, I want to know which DCs produced qualified pipeline and which were noise, so my numbers reflect reality.*

### Secondary persona: Account Executive

**Profile.** Carries quota, owns the account relationship, runs the DC. 2–8 years in tech sales. Lives in the CRM and the calendar.

**Jobs to be done.**

- *Before a DC, give me a 5-minute brief that tells me what this account actually needs and what's worked with similar accounts.*
- *During a DC, watch the conversation and feed me the right asset, the right question, the right objection-handler in the moment — without breaking my flow.*
- *After a DC, do my follow-up for me so I can spend my time on the next conversation, not on admin.*

### Tertiary persona: Solutions Engineer / Designer (PCL pod members)

**Profile.** Joins DCs alongside the AE. Brings technical or design depth. Wants to be useful without dominating the call.

**Jobs to be done.**

- *Tell me what the customer is asking for in my domain, in real time, so I can answer with confidence.*
- *Give me reference architectures, prior work, and design patterns I can pull up mid-call without rummaging through Drive.*
- *After the call, give me my action items separately from the AE's so I know what's mine to own.*

---

## 5. The Six Functional Phases

The platform's functionality is organized into six phases. Phases 1–3 are sequential to a single DC. Phases 4–6 are continuous and span all calls.

### Phase 1 — Pre-DC

The AE opens DC Copilot. They see today's upcoming calls. For each call, the system has already prepared a brief grounded in the upstream ICP data, BANT notes, and prior touchpoints. The brief contains:

- Account snapshot (industry, size, geography, tech stack from enrichment)
- Buyer persona profile of the attendees (LinkedIn, public signals)
- BANT scorecard from prior interactions
- Top 3 hypothesized pain points based on ICP match
- Recommended pod composition and a recommended deck assembly
- 5 suggested discovery questions tuned to this persona
- 3 likely objections and pre-staged handlers

The AE can edit the brief, swap deck slides, and approve the pod composition. The SE and Designer get notified with their role-specific cuts of the brief.

### Phase 2 — Live Call

A meeting bot joins the call (consented, announced). During the call:

- A side panel runs live: transcript, keyword highlighting with click-to-define, sentiment timeline, emphasis detection ("the customer just said 'compliance' three times in two minutes")
- A bot-chat is always open: any pod member can side-ask the AI a question and get a grounded, cited answer without interrupting the call
- Proactive nudges appear when the system detects an opening: "*the customer is describing a problem you solved for [Reference Client]. Want to surface that case study?*"
- Role-specific cues route to the right pod member: technical questions → SE's panel, design questions → Designer's panel, commercial questions → AE's panel
- Runtime deck assembly: the system can stitch slides from the collateral library and present them in-call if the AE chooses

### Phase 3 — Post-DC

Within 60 seconds of the call ending:

- A polished AI summary is generated (executive summary, customer pain points, commitments made, open questions, BANT progression)
- A draft follow-up email is created in the AE's voice (style learned from prior approved emails)
- CRM tasks are created automatically (next-step task, internal review task if needed, content request task if a missing asset was identified)
- Pod performance scorecard is generated for the AE and each pod member
- Analytics events are emitted to the team dashboard

Nothing post-DC is auto-sent. Every artifact requires AE approval before it leaves the platform.

### Phase 4 — Content Generation

A dedicated agent watches for content gaps. When a DC reveals that no existing asset addresses a pain point, the Content Generation agent flags it, drafts a candidate asset (slide, one-pager, mini case study), and routes it to the content owner for review. Over time, this closes the "I wish we had a deck for that" loop.

### Phase 5 — Knowledge Base

The KB is the substrate for all other phases. It ingests:

- Sales decks, case studies, before/after artifacts, reference architectures
- Battlecards, ICP definitions, persona profiles
- Transcripts and summaries from prior DCs (with embeddings for retrieval)
- Pricing guidance, qualification frameworks, BANT criteria

Retrieval is the hot path. Every agent that needs grounding pulls from here. The KB has its own admin surface for content lifecycle (add, version, deprecate, tag).

### Phase 6 — Analytics and Coaching

The leadership surface. Aggregates across calls, pods, AEs, and time. Surfaces:

- Win/loss patterns by persona, industry, deal size
- Content asset effectiveness (which decks correlate with progression)
- Individual coaching recommendations grounded in transcript evidence
- Pipeline health: BANT progression rates, stage conversion, time-in-stage
- AI cost tracking, governance events, and compliance audit trail

---

## 6. Functional Requirements

The following are numbered for traceability into engineering tickets. Each FR includes a priority (P0 = v1 blocker, P1 = v1 stretch, P2 = post-v1).

### Pre-DC

- **FR-1.1 (P0)** System auto-generates a pre-call brief for every scheduled DC at least 4 hours before the call
- **FR-1.2 (P0)** Brief is editable; AE changes are versioned and learned from
- **FR-1.3 (P0)** Brief includes recommended deck assembly drawn from KB
- **FR-1.4 (P0)** Pod members receive role-specific cuts of the brief
- **FR-1.5 (P1)** Brief includes 3 likely objections with pre-staged handlers
- **FR-1.6 (P1)** AE can request a "deeper brief" that triggers extended research (additional web signals, news mentions)

### Live Call

- **FR-2.1 (P0)** Meeting bot joins consented calls on Zoom, Meet, and Teams
- **FR-2.2 (P0)** Live transcript with speaker diarization, <3 second latency
- **FR-2.3 (P0)** Live keyword highlighting with click-to-define from KB
- **FR-2.4 (P0)** Live sentiment timeline (per speaker)
- **FR-2.5 (P0)** Bot-chat side panel: pod members ask questions, receive grounded answers in <5 seconds
- **FR-2.6 (P0)** Proactive nudges with citation to source (KB doc or prior call)
- **FR-2.7 (P1)** Role-routed cues: technical → SE, design → Designer, commercial → AE
- **FR-2.8 (P1)** Runtime deck assembly: AE can request "build me a 3-slide story on [X]" mid-call
- **FR-2.9 (P2)** Emotion-tone detection beyond positive/negative/neutral (interest, hesitation, urgency, confusion)

### Post-DC

- **FR-3.1 (P0)** AI summary generated within 60 seconds of call end
- **FR-3.2 (P0)** Draft follow-up email in AE's voice; requires approval before send
- **FR-3.3 (P0)** CRM tasks auto-created (next-step, content gap, internal review)
- **FR-3.4 (P0)** Pod performance scorecard per call
- **FR-3.5 (P1)** BANT progression auto-scored against the upstream framework
- **FR-3.6 (P1)** "What went well / what to improve" coaching note for each pod member
- **FR-3.7 (P2)** Auto-detection of unstated commitments ("you said you'd send X")

### Content Generation

- **FR-4.1 (P1)** Content gap detection from transcripts (pain points with no matching asset)
- **FR-4.2 (P1)** Draft asset generation (slide, one-pager) routed for human review
- **FR-4.3 (P2)** Asset performance learning loop (used-vs-effective correlation)

### Knowledge Base

- **FR-5.1 (P0)** Ingestion pipeline for decks (PPTX), docs (DOCX, PDF), and structured data (CSV, JSON)
- **FR-5.2 (P0)** Versioning and deprecation workflow
- **FR-5.3 (P0)** Tagging by persona, industry, deal stage, asset type
- **FR-5.4 (P0)** Semantic retrieval with citation surfacing
- **FR-5.5 (P1)** Asset effectiveness tracking (which assets correlate with progression)

### Analytics and Coaching

- **FR-6.1 (P0)** Team dashboard for Sales Leadership: calls this week, win rate, coaching candidates
- **FR-6.2 (P0)** Individual scorecards: per AE, per SE, per Designer
- **FR-6.3 (P0)** Win/loss pattern analysis with evidence (transcript citations)
- **FR-6.4 (P1)** Predictive deal-progression score based on call signals
- **FR-6.5 (P1)** Coaching recommendation engine: "this week, work with [AE] on [specific pattern]"
- **FR-6.6 (P2)** Cohort analysis (new hires vs tenured, by industry vertical)

### Governance, cost, compliance, security (cross-cutting)

- **FR-7.1 (P0)** Every AI output carries a citation trail to source data
- **FR-7.2 (P0)** Audit log of every agent action, retrievable for 12 months
- **FR-7.3 (P0)** AI cost dashboard per AE, per team, per agent
- **FR-7.4 (P0)** Cost guardrails: per-call ceiling, per-team monthly cap, alerting
- **FR-7.5 (P0)** PII redaction in transcripts (configurable)
- **FR-7.6 (P0)** Customer consent capture and revocation flow
- **FR-7.7 (P0)** Data residency controls (regional deployment options)
- **FR-7.8 (P1)** Prompt injection and jailbreak detection in bot-chat
- **FR-7.9 (P1)** Model fallback chain (degrade gracefully if a model is down or rate-limited)

---

## 7. Non-Functional Requirements

| Category | Requirement |
|---|---|
| **Latency: live** | Transcript <3s, bot-chat response <5s, sentiment update <2s |
| **Latency: async** | Post-call summary <60s, brief generation <2 minutes |
| **Availability** | 99.5% during business hours (8am–8pm in primary user region) |
| **Scale** | Support 200 concurrent live calls; 10,000 calls/month per tenant |
| **Security** | SOC 2 Type II readiness from day one; encryption at rest and in transit |
| **Compliance** | GDPR, CCPA; recording consent captured per jurisdiction |
| **Data retention** | Transcripts 24 months default, configurable per tenant |
| **Observability** | Every LLM call traced (latency, tokens, cost, model, prompt version) |

---

## 8. Success Metrics

### North Star
**Discovery Call → Qualified Pipeline conversion rate.** This is what RevOps actually cares about. If DC Copilot doesn't move this number, nothing else matters.

### Leading indicators (the proxies we watch weekly)

- **Brief usage rate:** % of DCs where the AE opened the pre-call brief
- **In-call assist rate:** average proactive nudges accepted per call
- **Post-call cycle time:** median time from call-end to CRM-task-created (target: <10 minutes vs current ~24 hours)
- **Content library activation:** % of KB assets used at least once per quarter
- **Coaching action rate:** % of leadership-coaching recommendations acted on

### Quality indicators

- **Citation coverage:** % of AI outputs with valid source citations (target: 100%)
- **Hallucination rate:** measured via weekly sampling and human review (target: <1%)
- **Pod satisfaction:** post-call survey, 1–5 scale (target: ≥4.2)
- **Cost per call:** AI spend per DC (target: <$X, set during pilot)

---

## 9. Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| **Hallucination in customer-facing follow-up email** | Medium | High | All outbound requires explicit AE approval; citation surfacing in editor |
| **Pod members ignore in-call nudges (cognitive load)** | High | Medium | Aggressive defaults to silence; nudge throttling; opt-in surfaces per role |
| **KB content quality is poor; garbage in → garbage out** | High | High | Ingestion review workflow; asset effectiveness scoring kills bad content |
| **AI cost runs away** | Medium | High | Per-call and per-tenant caps; cheaper-model fallbacks; caching for repeated retrievals |
| **Customer refuses recording consent** | Medium | Medium | Fallback to extension-based capture for AE-side audio only, with clear disclosure |
| **Meeting bot blocked by customer IT policy** | Medium | Medium | Manual transcript upload path; extension fallback |
| **Agent proliferation creates debugging nightmares** | High | High | Architecture position: fewer agents, more tools (see Architecture doc) |
| **Sales Leadership doesn't change behavior; tool becomes shelfware** | Medium | High | Pilot with one team for 90 days; success criteria gates expansion |

---

## 10. Rollout Plan

### Phase 0 — Internal alpha (Weeks 1–8)
Build the skeleton: Pre-DC brief, live transcript, post-call summary, basic dashboard. One agent (orchestrator). KB ingests 50 seed assets. Used internally by one pod for practice calls.

### Phase 1 — Single team pilot (Weeks 9–16)
One real sales team, one industry vertical. Full agent topology. CRM integration with one CRM (recommend HubSpot for pilot velocity). Daily standups with the team; weekly reviews with Sales Leadership.

### Phase 2 — Multi-team rollout (Weeks 17–28)
Expand to 3–5 teams. Add second CRM adapter if needed. Coaching recommendations go live. Content Generation agent activated.

### Phase 3 — General availability (Week 29+)
Org-wide. SLA enforcement. Customer self-serve admin. Multi-tenant if going external.

### Gate criteria between phases
Each phase has explicit go/no-go criteria. North star and quality metrics must hit targets before advancing. No advancement on time; advancement on readiness.

---

## 11. Open Questions

These need decisions before engineering kickoff:

1. **Build vs buy for transcription:** Recall.ai, Symbl, AssemblyAI, or build on Whisper? Recommendation in Architecture doc.
2. **Primary CRM for pilot:** HubSpot or Salesforce? Affects integration depth and timeline.
3. **LLM provider mix:** Single provider (Anthropic) or multi-provider (Anthropic + OpenAI + open-weights for cost control)?
4. **Tenancy model:** Single-tenant per customer, or shared multi-tenant with strict isolation?
5. **Pricing model (if external):** Per-seat, per-call, or per-AE with usage tiers?
6. **Naming:** "DC Copilot" is a placeholder. Branding and positioning is a separate workstream.

---

## 12. Appendices

- **Appendix A — Architecture diagram and system design:** see `02_Architecture.md`
- **Appendix B — Agent specifications:** see `03_Agent_Specs.md`
- **Appendix C — Glossary:** AE (Account Executive), SE (Solutions Engineer), PCL (Pre-sales Consulting / Client Lead pod), DC (Discovery Call), KB (Knowledge Base), BANT (Budget, Authority, Need, Timeline), ICP (Ideal Customer Profile), RevOps (Revenue Operations)
