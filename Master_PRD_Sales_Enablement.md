# Master PRD: AI-Native Sales Enablement Platform

**Document Type:** Master Product Requirements Document
**Status:** Draft v1.0
**Last Updated:** May 2026
**Authors:** Ahmad (Principal Product Designer), Mars (Collaborator)
**Audience:** Engineering, Design, Leadership, Stakeholders

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Problem Statement](#2-problem-statement)
3. [Product Vision & Goals](#3-product-vision--goals)
4. [Target Users & Personas](#4-target-users--personas)
5. [Success Metrics](#5-success-metrics)
6. [Product Scope](#6-product-scope)
7. [System Architecture](#7-system-architecture)
8. [The Five Phases](#8-the-five-phases)
9. [Orchestrator Agent](#9-orchestrator-agent)
10. [Global Floating Assistant](#10-global-floating-assistant)
11. [Feedback Loops](#11-feedback-loops)
12. [Cross-Cutting Concerns](#12-cross-cutting-concerns)
13. [Knowledge Base Architecture](#13-knowledge-base-architecture)
14. [Data Flow & Integrations](#14-data-flow--integrations)
15. [Tech Stack](#15-tech-stack)
16. [User Experience Principles](#16-user-experience-principles)
17. [Security, Compliance & Governance](#17-security-compliance--governance)
18. [Cost Governance](#18-cost-governance)
19. [Rollout Strategy](#19-rollout-strategy)
20. [Risks & Mitigations](#20-risks--mitigations)
21. [Glossary](#21-glossary)
22. [Appendix](#22-appendix)

---

## 1. Executive Summary

The AI-Native Sales Enablement Platform is a proactive, multi-agent system that supports Account Executives (AEs) and pre-sales teams across the entire Discovery Call (DC) lifecycle. It eliminates the prep gap, surfaces real-time intelligence during calls, automates post-call artifacts, and continuously improves both sellers and content based on what actually wins deals.

The platform operates in **five phases** orchestrated by a central coordination agent: Pre-DC preparation, live DC Call assistance, Post-DC artifact generation, Analytics, and Coaching. Each phase has dedicated agents with a phase-level QA agent that validates outputs before handoff. Two feedback loops ensure the system gets smarter over time: coaching insights flow back into Pre-DC briefings, and win/loss patterns evolve the knowledge base.

This document is the master spec. Individual agent PRDs will follow this one and reference shared decisions made here.

### What makes this product different

- **AI-native, not AI-bolted-on.** Every screen and workflow is built around agent reasoning, not retrofitted onto a traditional CRM.
- **Proactive, not reactive.** The system surfaces what the AE needs before they ask. Briefings appear before calls. Suggestions appear during. Tasks appear after.
- **Evidence-backed.** Every recommendation, score, and next step links to source data (transcript timestamps, KB documents, prior call patterns).
- **Self-improving.** The Training Loop and AI Reasoning agents close the loop between what AI suggested, what the AE actually did, and what the outcome was.
- **Multi-agent by design.** No monolithic prompt. Each agent has a narrow scope, its own QA validator, and well-defined inputs and outputs.

---

## 2. Problem Statement

### Today's pain points for IT services sales teams

**Pre-DC prep is inconsistent.** AEs walk into discovery calls under-prepared because briefing prep is manual, scattered across CRM notes, LinkedIn tabs, prior email threads, and tribal knowledge. Senior AEs do it well. Junior AEs do it poorly. The variance kills win rate.

**Live calls are unaided.** AEs juggle the customer conversation, note-taking, mental BANT tracking, objection responses, and recalling the right case study, all in real time. Important signals get missed. Buzzwords go undefined. Buying signals go unrecognized.

**Post-call admin is a tax.** Writing follow-up emails, creating Jira tickets, updating CRM, generating internal recap, and qualifying the lead burns 30 to 60 minutes per call. Most AEs cut corners. Pipeline data degrades.

**Analytics are descriptive, not prescriptive.** Sales dashboards tell leadership what happened, not why or what to do next. Win/loss reviews happen quarterly. Patterns get missed. The same losses repeat.

**Coaching is anecdotal.** Sales managers coach based on memory and instinct. Specific behaviors that correlate with closed-won deals are not captured. Improvement plans are generic.

**Content gets stale.** Battlecards, case studies, and playbooks are built once and rarely updated based on what is actually winning deals in the field.

### Why now

Three forces converge in 2026 to make this product timely:

1. **LLM reasoning is good enough** to handle nuanced sales conversations, surface relevant context in real time, and generate quality artifacts from transcripts.
2. **Multi-agent orchestration is mature enough** to build reliable systems with narrow-scoped agents instead of fragile single-prompt apps.
3. **AE expectations have shifted.** AEs trained on AI tooling expect proactive assistance, not just AI-generated summaries after the fact.

---

## 3. Product Vision & Goals

### Vision

Every Account Executive walks into every discovery call as prepared as the company's top performer, executes the call with a coach in their ear, leaves the call with all follow-up work already drafted, and improves measurably every month.

### Strategic Goals

| Goal | Description | Time horizon |
|------|-------------|--------------|
| **G1: Win rate lift** | Improve DC-to-closed-won conversion by 15 to 25 percent | 6 to 12 months post-launch |
| **G2: Shorter sales cycle** | Reduce average time from DC to closed-won by 20 to 30 percent through better qualification, faster follow-up, and stronger post-DC momentum | 6 to 12 months post-launch |
| **G3: AE productivity** | Reduce time per call (prep + execution + post-work) by 40 percent | 3 months post-launch |
| **G4: Ramp time** | Cut new AE time-to-productivity from 6 months to 3 months | 6 months post-launch |
| **G5: Data quality** | Achieve 95 percent CRM data completeness on every discovery call | 3 months post-launch |
| **G6: Self-improvement** | Demonstrate measurable model and KB improvement from feedback loops | Ongoing, measured quarterly |

### Non-Goals (out of scope for v1)

- Lead generation, enrichment, ICP definition (handled upstream by existing tools)
- Outbound outreach automation
- Contract negotiation or proposal drafting
- Post-sale account management or customer success
- Mobile-first experience (web-first for v1)
- Multi-language support (English only for v1)

---

## 4. Target Users & Personas

The platform serves four primary personas. Each has distinct workflows, distinct screens, and distinct success metrics. Every agent's output is designed for at least one of these personas.

### Persona 1: Sales Director

**Profile.** Owns a sales team of 5 to 20 AEs and pre-sales contributors. Owns team quota. Reports to VP Sales or CRO.

**Day-to-day.** Runs pipeline reviews. Coaches AEs one-on-one. Forecasts to leadership. Approves deal exceptions (discounts, custom terms). Reviews win/loss patterns. Builds and refines the sales process.

**Goals.**
- See real, evidence-backed performance across the team
- Spot at-risk deals early enough to intervene
- Identify which AEs need coaching on what specifically
- Build winning playbooks from top performer patterns
- Forecast accurately to leadership

**Frustrations.**
- CRM dashboards tell what happened, not why
- Coaching is anecdotal, based on memory of one or two calls
- Win/loss reviews happen quarterly, too late to change anything
- No visibility into actual AE behavior during calls
- Forecast accuracy is unreliable

**Primary platform surfaces.**
- Analytics dashboard (Phase 4 outputs)
- Coaching oversight (Phase 5 outputs, plans for each AE)
- Pipeline view with deal scores and risk flags
- Team leaderboard and benchmarking
- Win/loss post-mortem feed

**Tech comfort.** Medium to high. Wants insight, not raw data.

---

### Persona 2: Account Executive (AE)

**Profile.** Mid-level sales professional, 2 to 8 years experience. Runs 8 to 20 discovery calls per week. Carries a quota. Owns the relationship from DC through closed-won.

**Day-to-day.** Prepares for upcoming DCs. Runs DCs (often back-to-back). Updates CRM after every call. Writes follow-up emails. Coordinates with pre-sales team for technical depth. Hits quota.

**Goals.**
- Walk into every call as prepared as the team's best performer
- Run great calls without juggling 6 browser tabs
- Cover BANT without it feeling like an interrogation
- Leave the call with all follow-up work already drafted
- Close more deals faster

**Frustrations.**
- Manual prep is inconsistent and time-consuming
- CRM data entry is a tax on every call
- Forgetting to ask budget or timeline questions costs deals
- Writing similar follow-up emails 40 times a month
- Coaching is generic, not specific to deals they actually ran

**Primary platform surfaces.**
- Pre-DC briefing (Phase 1 output)
- Live call workspace with AI assistant (Phase 2)
- Post-call artifact review and edit (Phase 3 output)
- Personal coaching plan (Phase 5 output for them)
- Their own performance trends

**Tech comfort.** High. Comfortable with AI tools, expects proactive assistance.

---

### Persona 3: Pre-Sales Team

The pre-sales team joins discovery calls alongside the AE to provide specialized depth. Three sub-roles, shared platform behavior:

#### 3a. Solution Architect

**Profile.** Senior technical lead. Joins DCs when prospects need architecture conversations, integration depth, or technical feasibility validation.

**Goals.** Understand prospect's technical stack and constraints before joining. Surface the right reference architectures and integration patterns during the call. Avoid duplicating discovery questions the AE already asked.

**Frustrations.** Joining calls cold. Repeating context-gathering. AE not relaying technical signals correctly. No quick access to relevant past architectures.

#### 3b. Designer

**Profile.** UX or product design lead. Joins DCs when the deal involves design work, UX consulting, or design system engagements.

**Goals.** Understand the design problem before joining. Pull relevant design case studies and portfolio work that match prospect industry. Demonstrate design thinking quickly.

**Frustrations.** Generic case studies that don't match the prospect's vertical. No quick way to find the right portfolio piece mid-call.

#### 3c. QA Engineer

**Profile.** Quality assurance engineer. Joins DCs when prospects ask about testing strategy, QA processes, test automation maturity, or quality engineering capabilities.

**Goals.** Understand the prospect's current testing maturity before joining. Surface relevant QA case studies, automation frameworks, and process recommendations. Position QA as a deal differentiator, not an afterthought.

**Frustrations.** QA conversations often happen late or get rushed. Hard to demonstrate testing depth without prepared examples. Reusing the same generic QA slide deck regardless of prospect context.

#### Shared pre-sales platform surfaces

- Pre-DC briefing with role-specific section (architecture context for SA, design context for Designer, testing context for QA)
- Live call workspace with **role-specific guidance** in the AI assistant
- Personal KB of past role-specific engagements
- Post-call notes capture for technical commitments made
- Domain-specific case studies pulled by Content Manager Agent

**Tech comfort.** High. Technical practitioners by default.

---

### Persona 4: Content Manager (Internal Admin)

**Profile.** Internal admin who owns the knowledge base. Does not join customer calls. Sits in Sales Enablement, Marketing, or RevOps depending on org structure.

**Day-to-day.** Adds new case studies as deals close. Updates battlecards when competitors move. Refreshes playbooks based on what's winning. Audits the KB for stale or contradictory content. Ingests new company collateral. Reviews flagged content from Feedback Loop 2.

**Goals.**
- Keep the KB fresh, accurate, and high-signal
- Know which assets are winning and which are stale
- Quickly publish new case studies from closed-won deals
- Ensure version control and authoritative sources
- Respond to flags from the Analytics phase (asset X correlates with losses, asset Y with wins)

**Frustrations.**
- No visibility into which assets actually get used in calls
- Stale content lingers because no one flags it
- Case studies sit in someone's email instead of the KB
- Battlecards out of date the moment they ship
- Manual tagging and metadata work

**Primary platform surfaces.**
- KB management console (the Content Manager Agent's admin UI)
- Content performance dashboard (usage frequency, win correlation, AE feedback)
- Flagged-for-review queue (from Feedback Loop 2)
- Bulk ingestion tools (upload, tag, version)
- Approval workflow for AI-suggested content updates

**Tech comfort.** Medium. Wants efficient admin tools, not raw data structures.

---

### Persona Summary Matrix

| Persona | In-call? | Owns calls? | Primary phases | Daily user? |
|---------|----------|-------------|----------------|-------------|
| Sales Director | No | No | Phase 4, Phase 5 | Yes |
| Account Executive | Yes | Yes | All 5 phases | Yes |
| Pre-Sales (SA / Designer / QA) | Yes | No | Phase 1, Phase 2 | Variable (per deal) |
| Content Manager | No | No | Phase 1 (Content Manager Agent admin) | Yes |

---

## 5. Success Metrics

### North Star Metric

**Discovery-Call-to-Closed-Won Conversion Rate.** This single metric captures whether the platform actually moves the needle. Target: 15 to 25 percent improvement within 12 months.

### Tier 1: Outcome Metrics (measure quarterly)

| Metric | Baseline | Target | How measured |
|--------|----------|--------|--------------|
| DC-to-Closed-Won % | Establish in month 1 | +15 to 25% | CRM stage progression |
| Average sales cycle length | Establish in month 1 | -20 to -30% | CRM timestamps |
| Average deal size | Establish in month 1 | +10% | CRM revenue |
| AE quota attainment | Current % | +15 percentage points | Sales ops report |

### Tier 2: Behavior Metrics (measure monthly)

| Metric | Target | How measured |
|--------|--------|--------------|
| AE platform daily active usage | 85% of AEs | Auth logs |
| Pre-DC briefing read rate | 90% of upcoming calls | Briefing open events |
| Live AI suggestion acceptance rate | 60% | AE click-through on suggestions |
| Post-DC artifact acceptance rate | 75% | AE edits vs accepts on generated drafts |
| BANT completeness per call | 90% | Discovery Checklist Tracker output |

### Tier 3: System Health Metrics (measure weekly)

| Metric | Target | How measured |
|--------|--------|--------------|
| Agent QA pass rate | >95% | QA agent logs |
| Hallucination flag rate | <2% | QA Agent flags |
| Mean time to first suggestion (live call) | <8 seconds | Latency telemetry |
| End-to-end call cost (LLM spend per call) | <$X (TBD) | Token usage logs |
| System uptime | 99.5% | Infrastructure monitoring |

### Tier 4: Continuous Improvement Metrics (measure quarterly)

| Metric | Target | How measured |
|--------|--------|--------------|
| AI suggestion-to-action delta improvement | Trending toward 0 | AI Reasoning Agent |
| Win pattern recognition accuracy | >80% | Backtested against historical wins |
| KB content freshness (% updated per quarter) | >40% of active assets | Content Manager logs |
| Personalized coaching plan completion rate | >70% of AEs | Coaching Agent tracking |

---

## 6. Product Scope

### In Scope for v1

**Phase 1: Pre-DC**
- Automated briefing generation from CSV upload, CRM context, and KB pull
- Custom presentation deck generation per prospect
- Central content management for battlecards, case studies, playbooks
- Contact and company knowledge base

**Phase 2: DC Call (Live)**
- Live transcript ingestion (Fireflies, Otter, Zoom integration)
- Real-time AI suggestions surfaced in-call
- Live keyword highlighting with definitions on click
- Real-time intent and pain point detection
- Live sentiment analysis with disengagement alerts
- BANT discovery checklist tracking
- Real-time web lookup for KB gaps
- In-call objection detection and counter-suggestions
- Role-specific guidance (AE, Solution Architect, Designer, QA Engineer)
- **DC Call Workspace with Individual + Group chat modes (toggleable)**
- **Parallel running summary generated during the call**

**Phase 3: Post-DC**
- Auto-generated follow-up email draft
- Auto-generated Jira ticket draft
- Auto-generated follow-up tasks
- Deal scoring (hot, nurture, dead) with BANT signals
- Lead qualification update (ICP bucket, company stage)

**Phase 4: Analytics**
- Win/loss correlation analysis
- AI reasoning audit (suggestions vs actions vs outcomes)
- KPI tracking dashboard
- Post-mortem analysis on every closed deal

**Phase 5: Coaching**
- Personalized AE improvement plans
- Specific deal-level coaching insights
- Winning playbook synthesis from top performers
- Training loop feeding insights back to Pre-DC

**Cross-cutting**
- Multi-agent orchestration layer
- Per-phase QA agents
- **Global Floating Assistant (full-version in-app agent, available on every screen except live DC Call)**
- Cost governance and rate limiting
- Audit logging
- Role-based access control

### Out of Scope for v1 (deferred or never)

| Feature | Why deferred | Reconsider |
|---------|--------------|------------|
| Mobile app | Web-first focus; AEs run calls on desktop | v2 |
| Multi-language support | English-only customer base initially | v2 |
| Voice-to-voice AI coaching during call | Latency and UX complexity | v3 |
| Custom agent creation by end users | Governance risk | v3 |
| Outbound sequencing | Handled by existing tools | Never |
| Lead enrichment | Handled by existing tools | Never |
| Contract generation | Different problem space | Never |
| Customer success post-sale | Out of scope | Never |

### Future Roadmap (post-v1 candidates)

These are features and agent enablements we have committed to evaluate post-v1. Each is a meaningful expansion of the platform's capabilities, not core to first release. Detailed descriptions in [Appendix F](#21-appendix).

**Integrations**
1. CRM 2-way data sync (full bidirectional, beyond v1's CRM read + drafts-back model)
2. Multi-channel call support (Microsoft Teams, Google Meet, Webex)
3. Slack / Teams as alternate UI surface
4. Mobile app for AEs (briefing review, post-call edits on the go)
5. Multi-language support

**AI & Agents**
6. Visual AI bots for video sentiment analysis (facial cues, body language)
7. Voice-to-voice AI coaching during live calls (real-time whisper)
8. Competitor displacement playbook agent
9. Stakeholder mapping agent (decision-maker / influencer / blocker mapping)
10. Compete intel auto-refresh agent (KB self-updating from public competitor moves)
11. Pricing intelligence agent (historical pricing vs win/loss optimization)
12. AI roleplay coach (pre-DC rehearsal with simulated prospect)
13. Email reply intelligence (incoming prospect emails analyzed for shifts)

**Workflow & Artifacts**
14. Runtime presentation creation during live DC (deck built live from prospect signals)
15. Proposal generation from discussion + templates
16. Project Charter creation on closed-won
17. Deal velocity nudge engine (proactive pings for stalled deals)
18. Sales meeting prep agent (extends beyond DCs to QBRs, demos, technical reviews)

---

## 7. System Architecture

### High-Level Architecture

The platform is structured as a **multi-agent orchestrated system** with five functional phases, a central orchestrator, two feedback loops, and a shared knowledge base.

```
┌─────────────────────────────────────────────────────────────────┐
│                    ORCHESTRATOR AGENT                            │
│           Routes tasks, manages handoffs, coordinates data        │
└────────┬────────┬────────┬────────┬────────┬───────────────────┘
         │        │        │        │        │
    ┌────▼───┐ ┌─▼──┐ ┌──▼────┐ ┌──▼────┐ ┌▼──────┐
    │PRE-DC  │ │DC  │ │POST-DC│ │ANALYT.│ │COACH. │
    │Agents  │ │Call│ │Agents │ │Agents │ │Agents │
    └────┬───┘ └─┬──┘ └───┬───┘ └───┬───┘ └───┬───┘
         │       │        │         │         │
         └───────┴────────┴─────────┴─────────┘
                          │
                  ┌───────▼────────┐
                  │ KNOWLEDGE BASE │
                  │ + DATA STORES  │
                  └────────────────┘
```

### Agent Inventory

The platform comprises **17 agents** total:

| # | Agent | Phase | Type |
|---|-------|-------|------|
| 0 | Orchestrator Agent | Cross-cutting | Coordination |
| 0.5 | Global Assistant Agent | Cross-cutting | Production |
| 1 | Pre-DC Prep Agent | Pre-DC | Production |
| 2 | Presentation Gen Agent | Pre-DC | Production |
| 3 | Content Manager Agent | Pre-DC (cross-cutting) | Production |
| 4 | Pre-DC QA Agent | Pre-DC | Validation |
| 5 | Call Assistant Agent | DC Call | Production |
| 6 | Intent Detection Agent | DC Call | Production |
| 7 | Discovery Checklist Tracker | DC Call | Production |
| 8 | DC Call QA Agent | DC Call | Validation |
| 9 | Task-Gen Agent | Post-DC | Production |
| 10 | Deal Scoring Agent | Post-DC | Production |
| 11 | Post-DC QA Agent | Post-DC | Validation |
| 12 | Win/Loss Analysis Agent | Analytics | Production |
| 13 | AI Reasoning Agent | Analytics | Production |
| 14 | KPI Tracking Agent | Analytics | Production |
| 15 | Analytics QA Agent | Analytics | Validation |
| 16 | AE Coaching Agent | Coaching | Production |
| 17 | Training Loop Agent | Coaching | Production |
| 18 | Coaching QA Agent | Coaching | Validation |

### Agent Design Principles

1. **Narrow scope.** Each agent does one thing well. No god-agents.
2. **Explicit contracts.** Every agent has typed inputs and outputs. No ambiguous interfaces.
3. **QA-validated outputs.** Every phase has a dedicated QA agent that validates outputs before they reach the user or the next phase.
4. **Stateless where possible.** Agents pull state from shared stores, not from each other's memory.
5. **Observable.** Every agent action is logged with inputs, outputs, latency, tokens, and cost.
6. **Replaceable.** Any agent can be swapped (different model, different prompt, different vendor) without rewriting others.

---

## 8. The Five Phases

### Phase 1: Pre-DC

**Purpose.** Eliminate the prep gap. Every AE walks into every call with a complete, accurate, prospect-specific briefing.

**Triggered by.** Scheduled DC call within next 24 hours (configurable).

**Inputs.**
- Calendar event (prospect name, company, attendees, time)
- CSV upload (lead data from upstream tools)
- CRM record (prior interactions, ICP match, BANT signals so far)
- Knowledge base (battlecards, case studies, company decks)
- Public web (prospect company news, LinkedIn, recent announcements)

**Agents involved.**
- Pre-DC Prep Agent
- Presentation Gen Agent
- Content Manager Agent
- Pre-DC QA Agent

**Outputs.**
- AE briefing document (single-page, scannable)
- Custom presentation deck (tailored to prospect industry and use case)
- Discovery question recommendations
- Competitive intel flags
- KB asset bundle linked from briefing

**Success criteria.**
- Briefing ready 4+ hours before call (target: 24 hours)
- AE briefing read rate >90%
- Deck customization completed without manual edits in >70% of cases

### Phase 2: DC Call (Live)

**Purpose.** Augment the AE and pre-sales team in real time without overwhelming them. Surface signal, suppress noise, track coverage, keep everyone aligned.

**Triggered by.** Call start (detected via calendar + transcript provider webhook).

**Inputs.**
- Live transcript stream (Fireflies, Otter, or Zoom)
- AE's open briefing context from Phase 1
- Pre-sales briefing context (role-specific) from Phase 1
- KB on demand
- Real-time web access for unknown terms
- Prior calls with this prospect (if any)

**Agents involved.**
- Call Assistant Agent
- Intent Detection Agent
- Discovery Checklist Tracker
- DC Call QA Agent

**The DC Call Workspace (key UX surface).**

The DC Call workspace is a real-time collaboration layer where the AE and pre-sales attendees (Solution Architect, Designer, QA Engineer) work together with AI during the call. The workspace supports two chat modes with a quick toggle to switch between them:

**Individual Chat Mode.**
- Each participant has a private AI assistant pane
- AI delivers role-specific suggestions (AE sees AE-relevant suggestions, SA sees architecture context, Designer sees design case studies, QA sees testing recommendations)
- Private questions to AI do not surface to teammates
- Useful when a participant needs to think privately or look something up without distracting the group

**Group Chat Mode.**
- All participants share a single workspace
- AI acts as a participant alongside humans, posting:
  - Focus areas of the call (what the prospect is emphasizing)
  - Detected intents and pain points
  - Suggestions for the team collectively
  - Running summary generated in parallel with the call
- Team members can chat with each other and with AI in the same space
- Useful for staying aligned, handing off conversation threads, and shared note-taking

**Mode switching.** Single-click toggle in the workspace UI. State persists per call. Default mode is configurable per user (recommended default: Group).

**Outputs (live, streamed to participants).**
- In-call suggestion cards (role-aware in Individual mode, team-aware in Group mode)
- Highlighted keywords with click-to-define
- Live pain point and intent stream
- BANT/qualification coverage indicator
- Sentiment shift alerts
- Objection detection with counter-suggestion
- Unanswered question flags
- **Parallel running summary** (continuously generated, available to all in Group mode)

**UX constraints.**
- Suggestions must appear within 8 seconds of trigger
- One active suggestion card on screen at a time per participant
- Suggestions are dismissible without penalty
- Group chat does not auto-scroll past participant attention
- Visual style is calm, peripheral, not distracting
- Mode switch is one click, no confirmation required

**Success criteria.**
- AI suggestion latency <8s p95
- Suggestion acceptance rate >60%
- AE-reported "distracting" rating <10%
- Group chat used in >50% of multi-participant calls
- Running summary accuracy >85% (validated against full transcript)

### Phase 3: Post-DC

**Purpose.** Eliminate post-call admin tax. Generate every artifact the AE would manually produce, with the AE as final editor.

**Triggered by.** Call end (transcript marked complete by provider).

**Inputs.**
- Full call transcript
- All Phase 2 agent outputs (intents, BANT tracking, sentiment trend, suggestions accepted/rejected)
- Pre-DC briefing context
- CRM record
- Email template library
- Jira project context

**Agents involved.**
- Task-Gen Agent
- Deal Scoring Agent
- Post-DC QA Agent

**Outputs.**
- Follow-up email draft (subject + body, ready to edit and send)
- Jira ticket draft (formatted for the relevant project)
- Follow-up task list with owners and dates
- Deal score with explanation (hot, nurture, dead)
- Updated ICP bucket and company stage
- BANT qualification summary

**Success criteria.**
- All post-DC artifacts generated within 10 minutes of call end
- AE acceptance rate (artifacts sent with <10% edits) >75%
- CRM update accuracy >95%

### Phase 4: Analytics

**Purpose.** Turn descriptive reporting into prescriptive insight. Identify what wins, what loses, what to change.

**Triggered by.** Continuous (KPI Tracking) + deal close event (Win/Loss + AI Reasoning).

**Inputs.**
- All historical call transcripts and outputs
- CRM deal outcomes
- AE behavior logs
- AI suggestion logs
- Time-series KPIs

**Agents involved.**
- Win/Loss Analysis Agent
- AI Reasoning Agent
- KPI Tracking Agent
- Analytics QA Agent

**Outputs.**
- Win/loss correlation reports (per AE, per vertical, per deal size)
- Preventable loss flags with evidence
- AI suggestion vs action vs outcome deltas
- KPI dashboard (sales cycle, velocity, conversion, leaderboard)
- Post-mortem on every closed deal
- Statistical anomaly flags

**Success criteria.**
- Win pattern recognition accuracy >80% (backtested)
- Post-mortem generated within 24 hours of deal close
- Data integrity validated by Analytics QA on every report

### Phase 5: Coaching

**Purpose.** Make every AE measurably better every month. Make winning patterns institutional, not tribal.

**Triggered by.** Weekly cadence (improvement plans) + analytics events (specific deal callouts).

**Inputs.**
- All Phase 4 analytics outputs
- AE behavior history
- Top performer behavior patterns
- AE-defined goals (optional)

**Agents involved.**
- AE Coaching Agent
- Training Loop Agent
- Coaching QA Agent

**Outputs.**
- Personalized AE improvement plan
- Specific deal-level coaching notes ("you lost 3 deals where you skipped pricing justification")
- Skill development recommendations
- Winning playbook updates from top rep patterns
- Feedback to Pre-DC (this AE's briefings should emphasize X)
- Feedback to Content Manager (this asset wins, this one doesn't)

**Success criteria.**
- 70%+ of AEs follow personalized improvement plan
- Measurable performance improvement on coached metrics within 60 days
- Coaching fairness validation passes (no demographic bias)

---

## 9. Orchestrator Agent

The Orchestrator is the central nervous system. It is the only agent that holds the cross-phase view.

### Responsibilities

- **Routing.** Decide which agent handles which task based on phase, context, and priority.
- **Handoff management.** Ensure outputs from one agent are correctly formatted and delivered as inputs to the next.
- **State coordination.** Maintain the cross-phase context object that travels with each deal.
- **Conflict resolution.** When two agents produce conflicting outputs, decide which wins or escalate to the AE.
- **Failure handling.** Detect agent failures and route around them (fallback to simpler agent, surface error to user, retry with backoff).
- **Cost throttling.** Enforce per-call, per-AE, and per-org cost caps. Defer non-critical work when caps are approached.
- **Audit trail.** Log every routing decision for replay and debugging.

### Orchestrator decision examples

| Scenario | Orchestrator action |
|----------|---------------------|
| AE opens platform 6 hours before call | Trigger Pre-DC Prep Agent if not already run |
| Live transcript shows prospect mentioned competitor name | Route to Call Assistant Agent with KB battlecard pull |
| BANT tracking shows budget unanswered at 30-min mark | Surface nudge via Discovery Checklist Tracker |
| Call ends | Trigger Post-DC sequence in order: Task-Gen → Deal Scoring → QA |
| AI Reasoning detects suggestion-action gap | Forward to Training Loop Agent |
| Cost cap approached mid-call | Reduce suggestion frequency, prioritize BANT tracking over keyword highlighting |

### Orchestrator is NOT

- A monolithic prompt that handles everything.
- A workflow engine with hardcoded rules (it reasons about routing).
- The agent that talks to the user (the phase-specific agents do that).

---

## 10. Global Floating Assistant

The Global Floating Assistant is a persistent in-app agent accessible from every screen in the platform **except the live DC Call workspace** (which has its own dedicated chat surface, see Phase 2).

It is the user's universal entry point for asking anything, finding anything, and triggering anything inside the platform without navigating.

### What it is

A floating search/chat bar pinned to the user's view, expandable into a fuller conversational panel. Available globally to all four personas (Sales Director, AE, Pre-Sales, Content Manager) with role-appropriate scope.

### Capabilities (full version, v1)

**1. Universal search.**
- Indexed across KB, deals, contacts, accounts, past calls, transcripts, emails, tasks, coaching plans, analytics outputs
- Returns ranked results as the user types
- Filters by entity type, date, owner, deal stage

**2. Natural language Q&A.**
- "How did my Q3 deals close?"
- "Show me all calls where pricing was the main objection"
- "What's the win rate for FinTech deals over 200k?"
- "Which case studies should I use for healthcare prospects?"
- Returns answers grounded in platform data with source links

**3. Action triggering.**
- "Draft an email to John about the pricing discussion"
- "Create a follow-up task for the Acme deal"
- "Show me my coaching plan for this week"
- "Update the deal stage for Acme to Proposal"
- All actions produce drafts/previews; nothing executes without user confirmation

**4. Cross-screen navigation.**
- "Take me to the Acme account"
- "Open the FinTech case study"
- Acts as a keyboard-driven navigation layer over the UI

### Where it lives

| Screen / Phase | Floating Assistant available? | Notes |
|----------------|------------------------------|-------|
| Pre-DC briefing view | Yes | Useful for pulling extra context, related deals |
| **Live DC Call workspace** | **No** | Conflicts with dedicated DC Call chat (Phase 2) |
| Post-DC artifact review | Yes | Useful for "find a similar prior email," "show related cases" |
| Analytics dashboards | Yes | Power-user querying |
| Coaching views | Yes | "Why did I lose this deal?" |
| Content Manager admin console | Yes | "Find stale battlecards," "show usage of asset X" |
| Sales Director pipeline view | Yes | "Which deals are at risk this week?" |

### Why excluded from live DC Call

The live DC Call workspace already has a dedicated AI chat surface (Individual + Group modes) optimized for in-call use. Adding the Global Floating Assistant there would:
- Compete for screen real estate during a high-attention moment
- Create UX confusion (two chat surfaces side by side)
- Risk distracting the AE from the call

The Phase 2 chat *is* the AI surface during calls.

### Agent backing it

The **Global Assistant Agent** powers this surface. It is a cross-cutting agent owned by the Orchestrator. Behavior:

- Receives free-form input from the user
- Determines intent (search, question, action, navigation)
- Routes to the appropriate specialist agent or data store
- For searches: queries vector + structured stores, ranks results
- For questions: performs RAG over relevant data, generates grounded answer
- For actions: invokes the relevant production agent (Task-Gen, Deal Scoring, etc.) to produce a draft
- For navigation: returns a deep link to the requested screen
- Logs every interaction for audit and learning

### UX principles

- **Always one keystroke away.** Keyboard shortcut (e.g., Cmd+K) opens it from any screen.
- **Fast.** First search results appear within 300ms; full natural-language answers within 3 seconds.
- **Scoped to user permissions.** Sales Director sees team-wide data; AE sees their own. Content Manager sees KB-wide. Role-based filtering is enforced at the agent level.
- **Trustworthy.** Every answer cites its source (deal, transcript timestamp, KB document).
- **Non-destructive by default.** Actions produce drafts. Nothing sends/deletes/modifies without explicit confirmation.

### Success criteria

- 70% of users use the Global Assistant at least once per week
- Average query latency <3 seconds (p95)
- Action draft acceptance rate >70%
- Search-to-click rate >60% (user finds what they were looking for)

---

## 11. Feedback Loops

Two closed-loop systems make the platform self-improving.

### Feedback Loop 1: Coaching → Pre-DC

**Path.** Training Loop Agent (Phase 5) → Pre-DC Prep Agent (Phase 1)

**Mechanism.** When the Training Loop Agent identifies that a specific AE consistently struggles with a specific scenario (e.g., pricing objections, technical depth, multi-stakeholder navigation), it writes a personalization rule that the Pre-DC Prep Agent reads when generating that AE's next briefing.

**Example.** AE consistently loses deals in the healthcare vertical. Training Loop Agent writes: "For AE_Ahmad, healthcare prospects, emphasize HIPAA case studies and overweight the regulatory section of the briefing." Next healthcare briefing for Ahmad gets that emphasis.

**Validation.** Coaching QA Agent + Pre-DC QA Agent both check that personalizations remain factually accurate and don't drift into bias.

### Feedback Loop 2: Analytics → Content Manager

**Path.** AI Reasoning Agent + Win/Loss Analysis Agent (Phase 4) → Content Manager Agent (Phase 1, cross-cutting)

**Mechanism.** When Analytics identifies that specific content assets correlate with wins (or losses), the Content Manager Agent flags assets for promotion, deprecation, or update. A human content owner approves changes before they go live.

**Example.** Win/Loss Analysis Agent detects that the "FinTech Modernization" case study appears in 80% of closed-won FinTech deals but the "Legacy Banking" case study correlates with closed-lost. Content Manager flags Legacy Banking for review and promotes FinTech Modernization to top of recommendations.

**Validation.** Analytics QA confirms statistical significance. Human approves the recommendation before content changes take effect.

### Why two loops, not one

A single loop conflates two distinct improvement vectors: human behavior (coaching loop) and content quality (analytics loop). Separating them lets each loop optimize independently and lets humans review each independently.

---

## 12. Cross-Cutting Concerns

These concerns apply across all phases and agents.

### 11.1 Sentiment Analysis

Sentiment is tracked continuously during DC Calls by the Intent Detection Agent. It is:

- **Multi-dimensional.** Not just positive/negative, but engaged/disengaged, confident/uncertain, frustrated/satisfied.
- **Participant-specific.** Tracked per speaker, not just aggregate.
- **Trend-aware.** Shifts matter more than absolute values. A drop from positive to neutral is a stronger signal than steady neutral.
- **Action-triggering.** Significant negative shifts alert the AE in real time via the Call Assistant Agent.

### 11.2 Task Engine

A unified task engine handles every action item generated across the platform:

- Tasks generated by Task-Gen Agent (Post-DC)
- Coaching action items from AE Coaching Agent
- Content review tasks from Content Manager Agent
- BANT follow-up tasks flagged during call

The engine has a single schema, integrates with Jira and the platform's native task UI, and supports owner assignment, deadlines, dependencies, and status tracking.

### 11.3 Evidence with Next Steps

Every AI-generated recommendation must include:

- **What.** The recommendation itself.
- **Why.** The evidence (transcript timestamp, KB source, historical pattern, similar deal).
- **What next.** The concrete next step the AE should take.

Recommendations without all three are blocked by the relevant QA Agent.

### 11.4 Continuous Tracking

The platform never operates in "snapshot" mode. State is continuous:

- Deal context persists across calls
- AE behavior is tracked across all interactions
- KB asset performance is tracked across all uses
- AI suggestion outcomes are tracked from suggestion through deal close

### 11.5 Completeness Checks

Before any artifact ships to the AE or to a downstream system, a completeness check runs:

- Briefing has all required sections populated
- Email draft has subject, greeting, body, signature, CTA
- Jira ticket has title, description, project, priority, assignee
- Deal score has score, rationale, evidence, and BANT breakdown

Missing fields trigger either auto-fill (where confidence is high) or escalation to the AE.

### 11.6 Proactive AI Behavior

The platform leans heavily on **proactive** rather than reactive AI. The AE does not have to ask for help. The system anticipates and offers. Key proactive behaviors:

- Briefing appears before AE asks
- Live suggestions surface without prompting
- Post-call drafts wait in the AE's inbox at call end
- Coaching nudges arrive when behavior patterns trigger them
- Content updates surface when win patterns shift

Proactivity is governed by user preference. AEs can dial down frequency.

---

## 13. Knowledge Base Architecture

The Knowledge Base (KB) is the single source of truth for all content the platform reasons over. The Content Manager Agent owns it.

### KB Structure

| Layer | Content | Owner | Update cadence |
|-------|---------|-------|----------------|
| **Company** | Company decks, mission, positioning | Marketing | Quarterly |
| **Product/Service** | Service offerings, capabilities, tech stack | Product Marketing | Monthly |
| **Battlecards** | Competitive intel per major competitor | Sales Enablement | Continuous |
| **Case Studies** | Closed-won deal stories, segmented by industry/use case | Sales Enablement | Per deal |
| **Playbooks** | Discovery scripts, objection handling, BANT scripts | Sales Leadership | Quarterly |
| **Templates** | Email templates, deck templates, Jira templates | Sales Ops | As needed |
| **Contact Context** | Per-prospect enriched data | Auto from CRM | Continuous |
| **Company Context** | Per-prospect-company enriched data | Auto from CRM + web | Continuous |

### KB Quality Principles

- **Versioned.** Every asset has versions. Old versions remain retrievable.
- **Tagged.** Every asset has structured metadata (industry, use case, deal size, competitor, persona).
- **Performance-tracked.** Every asset has a track record (used in N calls, correlated with X close rate).
- **QA-validated.** New and updated assets pass Content Manager QA before going live.
- **Searchable.** Vector search + structured filters. Agents pull by semantic relevance and structured criteria.

---

## 14. Data Flow & Integrations

### Inbound Integrations

| Source | Data | Used by |
|--------|------|---------|
| Google Calendar / Outlook | Upcoming calls, attendees | Orchestrator, Pre-DC Prep Agent |
| Salesforce / HubSpot CRM | Deal records, contacts, accounts, history | All phases |
| Fireflies / Otter / Zoom | Live and post-call transcripts | DC Call agents, Post-DC agents |
| LinkedIn (public data) | Prospect professional context | Pre-DC Prep Agent |
| Company website (prospect's) | Recent news, announcements | Pre-DC Prep Agent |
| CSV upload | Bulk lead data | Pre-DC Prep Agent |
| Existing content libraries (SharePoint, Google Drive, Notion) | Decks, case studies, playbooks | Content Manager Agent |

### Outbound Integrations

| Destination | Data sent | Sent by |
|-------------|-----------|---------|
| Salesforce / HubSpot CRM | Updated deal stage, BANT, scores, notes | Deal Scoring Agent, Task-Gen Agent |
| Jira | Generated tickets | Task-Gen Agent |
| Gmail / Outlook | Drafted follow-up emails (drafts, not auto-sent) | Task-Gen Agent |
| Slack | Coaching nudges, alert notifications | Orchestrator, AE Coaching Agent |
| Internal task UI | All generated tasks | Task Engine |

### Data Flow Example: A Single Discovery Call

```
T-24h: Calendar event detected
       → Orchestrator triggers Pre-DC Prep Agent
       → Pre-DC Prep Agent reads CRM, KB, web
       → Generates briefing
       → Presentation Gen Agent builds custom deck
       → Pre-DC QA Agent validates
       → AE receives briefing notification

T-0:   Call starts
       → Transcript provider webhook fires
       → Orchestrator routes to DC Call agents
       → Call Assistant Agent streams suggestions
       → Intent Detection Agent tracks signals
       → Discovery Checklist Tracker tracks BANT
       → DC Call QA Agent validates each output before display

T+0:   Call ends
       → Transcript marked complete
       → Orchestrator triggers Post-DC sequence
       → Task-Gen Agent drafts email, Jira ticket, tasks
       → Deal Scoring Agent computes score, updates CRM
       → Post-DC QA Agent validates
       → AE receives "your post-call artifacts are ready"

T+24h: AE sends email, updates CRM, marks tasks complete
       → Behavior logged

T+N days: Deal closes (won or lost)
       → Analytics phase agents run
       → AI Reasoning Agent compares suggestions to actions to outcome
       → Win/Loss Analysis Agent finds patterns
       → Training Loop Agent updates Pre-DC personalization for this AE
       → Content Manager Agent flags assets for review based on outcome
```

---

## 15. Tech Stack

### Core AI Layer

- **Primary LLM.** Claude (Anthropic API), model selection per agent based on complexity and cost (Opus for reasoning-heavy agents like AI Reasoning and Win/Loss, Sonnet for production agents, Haiku for high-frequency lightweight tasks)
- **Orchestration.** Custom orchestrator service (Python or TypeScript) with tool-use patterns
- **Vector store.** Pinecone, Weaviate, or pgvector for KB semantic search
- **Structured store.** PostgreSQL for deal records, agent logs, KPIs

### Application Layer

- **Frontend.** React (web app)
- **Backend.** Node.js or Python service layer
- **Real-time.** WebSocket for live suggestion streaming during calls
- **Task queue.** Redis + worker pool for async agent jobs

### Integration Layer

- **Transcript providers.** Fireflies API, Otter API, Zoom Webhooks
- **CRM.** Salesforce REST API, HubSpot API
- **Calendar.** Google Calendar API, Microsoft Graph API
- **Email.** Gmail API, Outlook API (drafts only, never auto-send)
- **Jira.** Atlassian REST API
- **Slack.** Slack Web API

### Observability

- **Logging.** Structured logs per agent action (input, output, latency, tokens, cost)
- **Tracing.** Distributed tracing across orchestrator → agents → tools
- **Metrics.** Time-series KPIs in Grafana or equivalent
- **Cost tracking.** Per-call, per-AE, per-org token spend dashboards

---

## 16. User Experience Principles

### Principle 1: AI is the interface, not a feature

The product is not a CRM with AI bolted on. Every screen is built around agent outputs. The AE's primary surface is a unified workspace where briefings, live suggestions, and post-call artifacts flow naturally.

### Principle 2: Calm by default

Live call interfaces are intentionally minimal. One suggestion at a time. Peripheral visual placement. No popups, no flashing, no urgent badges unless genuinely urgent.

### Principle 3: Trust through evidence

Every recommendation links to its source. The AE can click any suggestion to see why the agent suggested it (transcript timestamp, KB document, historical pattern). No black-box AI.

### Principle 4: AE is always in control

Every AI-generated artifact is editable. Nothing is auto-sent without AE review. The AE can dismiss any suggestion, override any score, and edit any draft.

### Principle 5: Proactive but not pushy

The system offers, the AE accepts. Proactive does not mean intrusive. AEs can configure frequency and channel for proactive nudges.

### Principle 6: Mobile-aware, desktop-first

V1 is desktop-first because that is where DCs happen. Briefings and post-call artifacts are mobile-readable for reviews on the go.

### Principle 7: Speed matters

Live suggestions must arrive within 8 seconds. Briefings must generate within 60 seconds. Post-call artifacts within 10 minutes. Slow AI is unused AI.

---

## 17. Security, Compliance & Governance

### Data Security

- **Encryption at rest.** AES-256 for all stored data.
- **Encryption in transit.** TLS 1.3 minimum.
- **PII handling.** Prospect PII (names, emails, phones) is treated as sensitive. Transcripts redact non-essential PII before long-term storage.
- **Access control.** Role-based access (AE, Manager, Admin, Ops). Field-level redaction for sensitive deal data.

### AI Safety & Governance

- **No autonomous actions.** No agent sends an email, updates CRM, or creates a Jira ticket without AE confirmation in v1. Drafts only.
- **Hallucination detection.** Every QA agent checks outputs against source data and flags low-confidence or unsourced claims.
- **Prompt injection defense.** Transcripts and KB content are treated as untrusted data. Instructions inside transcripts cannot override agent behavior.
- **Audit log.** Every agent decision is logged with full traceability.
- **Human-in-the-loop checkpoints.** Coaching plans, content updates, and deal score changes require human review for high-impact actions.

### Compliance

- **GDPR.** Right to access, right to deletion, data portability supported for prospect and customer records.
- **CCPA.** Same.
- **SOC 2 Type II.** Roadmap target within first 12 months.
- **Recording consent.** Transcripts only ingested for calls where consent is documented (provider-side).
- **Industry-specific.** Where customer industry requires (healthcare, finance), additional controls apply (HIPAA business associate agreements, financial data segregation).

### Bias & Fairness

- **Coaching fairness.** Coaching QA Agent specifically validates that improvement plans do not show demographic bias.
- **Suggestion fairness.** AI Reasoning Agent monitors whether suggestions correlate with AE demographics in ways unrelated to outcomes.
- **Periodic audits.** Quarterly external review of model outputs for systematic bias.

---

## 18. Cost Governance

LLM costs scale linearly with usage. Without governance, costs balloon.

### Cost Controls

| Layer | Mechanism |
|-------|-----------|
| Per-agent | Model selection (Haiku for high-frequency, Sonnet for standard, Opus for reasoning-heavy) |
| Per-call | Hard cap on tokens per call (configurable, default 100k tokens total across all agents) |
| Per-AE | Daily cap on agent invocations (configurable per role) |
| Per-org | Monthly spend cap with alerts at 70%, 85%, 95% |
| Per-feature | Real-time suggestion frequency throttled when cost ceiling approaches |

### Cost Optimization Strategies

- **Caching.** Common KB retrievals, frequent queries, and recurring patterns cached aggressively.
- **Batching.** Non-urgent agent jobs batched.
- **Model routing.** Orchestrator routes simple tasks to cheaper models, complex reasoning to expensive models.
- **Prompt efficiency.** Standardized, optimized prompts reviewed quarterly.
- **Retrieval before generation.** KB retrieval before LLM call wherever possible (don't generate what you can retrieve).

### Cost Transparency

Per-AE and per-deal cost is visible to managers. ROI dashboard shows cost vs revenue attribution.

---

## 19. Rollout Strategy

### Phase 0: Internal Alpha (Month 1 to 2)

- 3 to 5 internal AEs use the platform on real calls
- Pre-DC and Post-DC features only
- Goal: Validate briefing quality, post-call artifact quality, and integration stability

### Phase 1: Internal Beta (Month 3 to 4)

- 15 to 20 internal AEs
- Add DC Call live features
- Goal: Validate latency, suggestion acceptance, and live UX

### Phase 2: Internal GA (Month 5 to 6)

- All internal AEs
- Add Analytics and Coaching phases
- Goal: Validate full feedback loops and measure outcome metrics

### Phase 3: External Customer Beta (Month 7 to 9)

- 3 to 5 design-partner customers
- Tight feedback loops, weekly check-ins
- Goal: Validate cross-company generalization, pricing model, support load

### Phase 4: External GA (Month 10+)

- Open availability
- Pricing finalized
- Self-service onboarding for KB ingestion

---

## 20. Risks & Mitigations

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Live latency exceeds 8s | Medium | High | Aggressive caching, lighter model for live phase, pre-fetched context |
| AE rejects proactive suggestions as noisy | Medium | High | Configurable frequency, one-at-a-time rule, dismiss without penalty, calm UX |
| Hallucinated content reaches AE | Medium | High | QA agents on every phase, evidence-with-next-steps requirement, low-confidence flagging |
| Cost overruns | High | Medium | Multi-layer caps, model routing, per-deal cost visibility |
| Prospect privacy concerns | Medium | High | Consent-only transcript ingestion, PII redaction, compliance roadmap |
| Transcript provider integration breaks | Medium | High | Multi-provider support (Fireflies + Otter + Zoom), graceful degradation |
| KB content quality degrades over time | High | Medium | Content Manager Agent flags stale assets, Feedback Loop 2 evolves content |
| Coaching plans introduce bias | Low | High | Coaching QA Agent fairness checks, quarterly external audits |
| AE adoption stalls | Medium | High | Phase 0/1 with engaged internal users, fast feedback iteration, change management |
| Model regression on prompt updates | Medium | Medium | Versioned prompts, golden test suite per agent, staged rollout of prompt changes |

---

## 21. Glossary

| Term | Definition |
|------|------------|
| **AE** | Account Executive. Sales professional who owns and runs discovery calls. |
| **Agent** | A scoped AI component that performs a specific function within the system. |
| **BANT** | Budget, Authority, Need, Timeline. Qualification framework for early-stage deals. |
| **Content Manager** | Internal admin persona who owns the knowledge base. Does not join calls. |
| **DC** | Discovery Call. The initial deep-context call between AE and prospect. |
| **DC Call Workspace** | The real-time collaboration surface used by AE and pre-sales during a live call. Supports Individual and Group chat modes. |
| **Discovery Checklist** | Real-time tracking of BANT coverage during a call. |
| **Global Assistant** | A persistent in-app floating assistant accessible from every screen except the live DC Call. Supports search, Q&A, action triggering, and navigation. |
| **Group Chat (DC)** | Mode of the DC Call Workspace where all participants share one space and AI posts to the group. |
| **ICP** | Ideal Customer Profile. The defined target segment for a company. |
| **Individual Chat (DC)** | Mode of the DC Call Workspace where each participant has a private AI assistant pane. |
| **KB** | Knowledge Base. The platform's central content store. |
| **Orchestrator** | The central coordination agent that routes tasks across phases. |
| **Phase** | One of five logical groupings of agents (Pre-DC, DC Call, Post-DC, Analytics, Coaching). |
| **Pre-DC** | The preparation phase before a discovery call. |
| **Pre-Sales Team** | Specialists (Solution Architect, Designer, QA Engineer) who join DCs alongside the AE for technical depth. |
| **Post-DC** | The artifact-generation phase after a discovery call. |
| **QA Agent** | A validation agent that checks production agent outputs before they reach users or downstream agents. |
| **Sales Director** | Persona who manages a team of AEs and pre-sales contributors, owns team quota. |
| **Suggestion** | A real-time recommendation surfaced to the AE during a live call. |
| **Win/Loss** | Analysis of why deals closed-won or closed-lost. |

---

## 22. Appendix

### A. Open Questions

These need decisions before agent PRDs are finalized.

1. **Transcript provider priority.** Which provider is the default (Fireflies, Otter, Zoom)? Affects integration depth and latency profile.
2. **CRM as primary or secondary.** Is CRM the system of record, or is the platform's own data store? Affects sync strategy.
3. **Pricing model.** Per-seat, per-call, per-deal-closed? Affects which metrics matter most.
4. **Initial vertical focus.** Generic across all verticals, or launch with one (e.g., FinTech, Healthcare)? Affects KB seeding.
5. **Self-hosted KB or cloud-only.** Some enterprise customers will require self-hosted. Affects architecture.
6. **Mobile experience priority.** Confirmed deferred to v2, but is read-only mobile in v1 a yes or no?

### B. Decisions Made (locked)

| Decision | Rationale |
|----------|-----------|
| 5 phases, not 6 | Content Manager folds into Pre-DC as cross-cutting agent; simpler model |
| BANT only (not MEDDIC) for v1 | Single qualification framework reduces complexity; MEDDIC deferred |
| Generic across verticals (not vertical-specific) | Per Ahmad's instruction; reduces v1 scope ambiguity |
| Markdown-first PRDs | Per Ahmad's preference; easier iteration |
| English only for v1 | Reduces complexity, expands in v2 |
| No autonomous actions in v1 | All artifacts are drafts; AE confirms before send |

### C. Reference: Phase-to-Agent Mapping

```
Phase 1: Pre-DC
├── Pre-DC Prep Agent
├── Presentation Gen Agent
├── Content Manager Agent (cross-cutting, hosted here)
└── Pre-DC QA Agent

Phase 2: DC Call
├── Call Assistant Agent
├── Intent Detection Agent
├── Discovery Checklist Tracker
└── DC Call QA Agent

Phase 3: Post-DC
├── Task-Gen Agent
├── Deal Scoring Agent
└── Post-DC QA Agent

Phase 4: Analytics
├── Win/Loss Analysis Agent
├── AI Reasoning Agent
├── KPI Tracking Agent
└── Analytics QA Agent

Phase 5: Coaching
├── AE Coaching Agent
├── Training Loop Agent
└── Coaching QA Agent

Cross-cutting:
├── Orchestrator Agent
└── Global Assistant Agent
```

### D. Reference: Feedback Loop Diagram

```
Phase 5 (Coaching) ─── Training Loop Agent ───┐
                                              │
                                              ▼
                                       Phase 1 (Pre-DC)
                                       Pre-DC Prep Agent
                                              ▲
                                              │
Phase 4 (Analytics) ── AI Reasoning + ────────┘
                       Win/Loss Analysis
                                              │
                                              ▼
                                       Content Manager Agent
                                       (Phase 1, cross-cutting)
```

### E. Next Steps

1. Review and lock Master PRD
2. Resolve Open Questions (Appendix A)
3. Draft agent-specific PRDs in this order:
   - Orchestrator Agent (foundation)
   - Global Assistant Agent (cross-cutting foundation)
   - Phase 1 agents (4 PRDs)
   - Phase 2 agents (4 PRDs)
   - Phase 3 agents (3 PRDs)
   - Phase 4 agents (4 PRDs)
   - Phase 5 agents (3 PRDs)
4. Tech design review per phase
5. Begin Phase 0 alpha build

### F. Future Roadmap (detailed)

Detailed descriptions of post-v1 candidates listed in Section 6. Each entry covers the feature, the problem it solves, and the likely enabling agents or systems. These are not committed deliverables; they are evaluation targets for v2 and beyond.

#### Integrations

**1. CRM 2-way data sync.** v1 reads from CRM and writes drafts back for AE confirmation. The future state is full bidirectional sync where CRM changes (e.g., a manager updating a deal stage manually) flow back into the platform's internal state automatically, and platform-derived insights (deal scores, behavioral signals, AI-confidence flags) become first-class CRM fields. Enables CRM-native users to benefit from the platform without leaving Salesforce or HubSpot.

**2. Multi-channel call support.** Beyond Fireflies, Otter, and Zoom, the platform expands to ingest Microsoft Teams, Google Meet, and Webex recordings and live transcripts. Especially important for enterprise customers standardized on Microsoft or Google ecosystems.

**3. Slack / Teams as alternate UI surface.** Lets AEs interact with the platform from inside their primary communication tool. Pre-DC briefings delivered via Slack DM, post-call artifacts reviewed in Teams, coaching nudges in channel. Reduces context switching.

**4. Mobile app for AEs.** Native iOS / Android app for briefing review, post-call edits, deal score checks on the go. v1 web product is mobile-readable but not mobile-optimized; this is the full mobile experience.

**5. Multi-language support.** Extends transcript ingestion, agent reasoning, and artifact generation beyond English. Phase 1 candidate languages: Spanish, French, German, Portuguese, Arabic, Mandarin. Each language adds non-trivial complexity to LLM prompts, KB content, and QA agent validation.

#### AI & Agents

**6. Visual AI bots for video sentiment analysis.** Current sentiment analysis is transcript-based (text). The future state adds video analysis: facial expression cues, micro-expressions, body language, posture shifts, attention drift. Significantly improves disengagement detection but introduces ethical, privacy, and bias considerations that require careful design.

**7. Voice-to-voice AI coaching during live calls.** A real-time AI whisper layer that speaks suggestions into the AE's ear (via earpiece or low-volume audio channel) without disrupting the prospect-facing conversation. Currently in v3 due to latency, UX, and accuracy challenges. Removes the need to read suggestion cards mid-conversation.

**8. Competitor displacement playbook agent.** Detects in real time when a prospect mentions a current vendor (Salesforce, SAP, ServiceNow, etc.) and auto-generates the switching narrative: differentiation points, migration approach, common objections from incumbents, customer reference stories. Integrates with the Call Assistant Agent.

**9. Stakeholder mapping agent.** Builds and maintains an account-level org chart from transcript mentions, email threads, and meeting attendees. Identifies who decides, who influences, who blocks, who champions. Surfaces gaps ("you haven't engaged the CFO and budget is unresolved").

**10. Compete intel auto-refresh agent.** A background agent that monitors competitor public moves (pricing pages, product launches, leadership changes, funding events, customer announcements) and auto-suggests battlecard updates to the Content Manager. Reduces the latency between competitor moves and field readiness from weeks to hours.

**11. Pricing intelligence agent.** Analyzes historical pricing vs win/loss by segment, deal size, vertical, and competitor presence to recommend optimal pricing posture per deal. Provides AE with a recommended range and the rationale ("for FinTech deals over 300k with two competitors in the mix, your historical win rate is highest in the 220-260k range").

**12. AI roleplay coach.** Pre-DC practice mode where the AE rehearses the upcoming call with a simulated prospect persona generated from the actual prospect's profile, industry, and known pain points. AI plays the prospect; the AE practices discovery, objection handling, and pricing conversations. Replay and feedback included.

**13. Email reply intelligence.** Incoming prospect emails get auto-analyzed for sentiment shifts (positive → neutral → negative), intent changes (interested → hesitant → cooling), urgency signals, and stakeholder changes (new person CC'd, decision-maker added or removed). Surfaces these as proactive alerts to the AE.

#### Workflow & Artifacts

**14. Runtime presentation creation during live DC.** During the call, as the prospect reveals priorities and pain points, the platform builds a custom slide deck in parallel — pulling relevant case studies, capability slides, ROI calculators, and architecture diagrams from the KB. By call end, the AE has a tailored deck ready to share as the leave-behind. Extends the Presentation Gen Agent into the live phase.

**15. Proposal generation from discussion + templates.** Post-DC, the platform generates a draft proposal by combining the call's discovery findings with proposal templates from the KB. Includes scope, timeline, pricing range, key assumptions, and risk callouts. AE and pre-sales review and finalize. Reduces proposal turnaround from days to hours.

**16. Project Charter creation on closed-won.** When a deal closes-won, the platform auto-generates a project charter for the delivery team: project scope, stakeholders, success criteria, dependencies, technical context, and key commitments made during the sales process. Bridges the sales-to-delivery handoff that today is informal and lossy. Highly valuable for IT services firms.

**17. Deal velocity nudge engine.** Proactively detects stalled deals based on engagement signals (no activity for N days, missed follow-up dates, sentiment cooling) and pings the AE with specific recovery suggestions: "Acme deal has been quiet for 14 days. Last call showed concern about migration timeline. Suggested next step: send the migration playbook case study and propose a technical deep-dive."

**18. Sales meeting prep agent.** Extends the platform's prep capabilities beyond Discovery Calls to other sales meetings: QBRs, technical deep-dives, demos, executive briefings, renewal conversations. Each meeting type gets its own prep template and agent reasoning profile.

---

**End of Master PRD**
