# SRS Diagrams: AIM SET 2.0 / DC Copilot

This document summarizes the Software Requirements Specification view of the project as diagrams. It focuses on what the system must support, who interacts with it, and how the main Discovery Call workflow moves through the product.

## 1. System Context

```mermaid
flowchart LR
    AE["Account Executive"]
    SE["Solutions Engineer / Designer"]
    REVOPS["Sales Leadership / RevOps"]
    ADMIN["Content Manager / Admin"]
    CUSTOMER["Customer meeting participants"]

    subgraph SYSTEM["AIM SET 2.0 / DC Copilot"]
        WEB["Next.js Web App"]
        BFF["Next.js BFF API routes"]
        API["FastAPI backend"]
        ORCH["Lead Orchestrator"]
        AGENTS["Product agents"]
        KB["Knowledge Base"]
        LIVE["Live Call Workspace"]
        STUDIO["Content Studio"]
        ANALYTICS["Analytics, Coaching, Governance"]
    end

    subgraph EXTERNAL["External Services"]
        CLERK["Clerk Auth"]
        RECALL["Recall.ai meeting bot + transcripts"]
        LLM["LLM providers"]
        SUPABASE["Supabase Postgres, Storage, pgvector"]
        CRM["CRM / Jira adapters"]
        CALENDAR["Calendar / meeting platforms"]
    end

    AE --> WEB
    SE --> WEB
    REVOPS --> WEB
    ADMIN --> WEB
    CUSTOMER --> RECALL

    WEB --> BFF
    BFF --> API
    API --> ORCH
    ORCH --> AGENTS
    AGENTS --> KB
    AGENTS --> LIVE
    AGENTS --> STUDIO
    AGENTS --> ANALYTICS

    WEB --> CLERK
    API --> CLERK
    API --> SUPABASE
    KB --> SUPABASE
    ORCH --> LLM
    RECALL --> API
    API --> CRM
    CALENDAR --> WEB
```

## 2. Functional Requirements Map

```mermaid
flowchart TB
    SRS["AIM SET 2.0 Functional Requirements"]

    SRS --> PRE["Pre-DC Preparation"]
    SRS --> LIVE["Live Call Assistance"]
    SRS --> POST["Post-DC Review"]
    SRS --> CONTENT["Content Generation"]
    SRS --> KB["Knowledge Base"]
    SRS --> LEADERSHIP["Analytics and Coaching"]
    SRS --> GOVERNANCE["Governance and Operations"]

    PRE --> PRE1["Import Pre-DC notes / lead data"]
    PRE --> PRE2["Create call records and briefs"]
    PRE --> PRE3["Generate AI summary, discovery questions, likely pains"]
    PRE --> PRE4["Recommend relevant KB assets and artifacts"]

    LIVE --> LIVE1["Start Recall bot for meeting"]
    LIVE --> LIVE2["Receive transcript segments via webhook or polling"]
    LIVE --> LIVE3["Detect intents, pains, keywords, sentiment"]
    LIVE --> LIVE4["Track BANT / discovery checklist coverage"]
    LIVE --> LIVE5["Show proactive nudges and grounded bot-chat answers"]

    POST --> POST1["Finalize live session at call end"]
    POST --> POST2["Generate post-call summary"]
    POST --> POST3["Draft follow-up email, CRM tasks, Jira ticket"]
    POST --> POST4["Create coaching and scorecard outputs"]
    POST --> POST5["Require human review before external action"]

    CONTENT --> CONTENT1["Detect content gaps"]
    CONTENT --> CONTENT2["Chat-driven Studio project creation"]
    CONTENT --> CONTENT3["Template ingest and scratch generation"]
    CONTENT --> CONTENT4["Export HTML, PDF, PNG, PPTX"]

    KB --> KB1["Upload documents, decks, templates, structured data"]
    KB --> KB2["Extract metadata and preview content"]
    KB --> KB3["Chunk and embed content for semantic retrieval"]
    KB --> KB4["Attach citations to AI outputs"]

    LEADERSHIP --> LEAD1["View calls, trends, content usage, coaching candidates"]
    LEADERSHIP --> LEAD2["Inspect agent activity and outcomes"]
    LEADERSHIP --> LEAD3["Review pipeline and discovery quality signals"]

    GOVERNANCE --> GOV1["Tenant-scoped auth and data isolation"]
    GOVERNANCE --> GOV2["Agent model policy and cost caps"]
    GOVERNANCE --> GOV3["Prompt versions and audit log"]
    GOVERNANCE --> GOV4["Runtime fallbacks and error handling"]
```

## 3. End-To-End Discovery Call Workflow

```mermaid
sequenceDiagram
    autonumber
    actor AE as Account Executive
    participant WEB as Next.js Web App
    participant BFF as Next.js BFF
    participant API as FastAPI API
    participant ORCH as Lead Orchestrator
    participant KB as Knowledge Base
    participant RECALL as Recall.ai
    participant LIVE as Live Call Workspace
    participant POST as Post-DC Agent
    participant DB as Supabase

    AE->>WEB: Import Pre-DC CSV or create lead
    WEB->>BFF: POST /api/dc-notes/ingest
    BFF->>API: Forward tenant-scoped ingest request
    API->>DB: Store notes and call records
    API->>ORCH: dispatch_pre_dc_pipeline()
    ORCH->>KB: Retrieve relevant assets and citations
    ORCH->>DB: Save pre-call brief and agent run
    WEB->>API: Fetch calls and brief
    API-->>WEB: Return Pre-DC workspace data

    AE->>WEB: Start Recall bot for meeting
    WEB->>BFF: POST /api/calls/{callId}/recall-bot
    BFF->>API: POST /api/v1/calls/{callId}/recall-bot
    API->>RECALL: Create meeting bot with webhook URL
    RECALL-->>API: Bot ID and status
    API->>DB: Link provider meeting to live session

    RECALL->>API: Transcript webhook events
    API->>ORCH: dispatch_live_segment()
    ORCH->>KB: Retrieve relevant content and definitions
    ORCH->>DB: Save transcript, signals, checklist state
    API-->>LIVE: Broadcast transcript, nudges, metrics

    AE->>LIVE: Ask bot-chat question
    LIVE->>API: Send live chat request
    API->>ORCH: dispatch_bot_chat()
    ORCH->>KB: Ground answer in transcript and KB
    ORCH-->>LIVE: Cited answer and suggested actions

    AE->>WEB: End call / run post-call
    WEB->>API: POST post-call pipeline
    API->>ORCH: dispatch_post_call()
    ORCH->>POST: Generate review artifacts
    POST->>DB: Save summary, tasks, coaching, review data
    API-->>WEB: Return Post-DC review for human approval
```

## 4. Agent and Data Flow

```mermaid
flowchart LR
    subgraph TRIGGERS["Input Triggers"]
        CSV["Pre/Post-DC CSV"]
        CHAT["Copilot or Studio message"]
        TRANSCRIPT["Recall transcript segment"]
        UPLOAD["KB upload"]
        CALLEND["Call ended"]
    end

    subgraph API["FastAPI Routers"]
        DCNOTES["dc_notes"]
        CALLS["v1_calls"]
        COPILOT["v1_copilot"]
        CONTENT["v1_content_studio"]
        KBROUTER["v1_kb"]
        WEBHOOKS["v1_webhooks"]
    end

    ORCH["Lead Orchestrator<br/>services/api/app/orchestrator/dispatcher.py"]

    subgraph AGENTS["Orchestrator-Backed Agents"]
        WORKFLOW["PRE-DC Workflow"]
        CONTENTAGENT["Content Agent"]
        LIVEAGENT["Live Call Agent"]
        CHECKLIST["Discovery Checklist Tracker"]
        POSTDC["Post-DC Agent"]
        GEN["Content Generation Agent"]
        KNOWLEDGE["Knowledge Agent"]
        SALES["Sales Copilot Agent"]
    end

    subgraph DATA["Data Stores"]
        PG["Supabase Postgres"]
        VECTOR["pgvector KB chunks"]
        STORAGE["Supabase Storage"]
        RUNS["Agent run / audit events"]
        MEMORY["Live session memory"]
    end

    CSV --> DCNOTES
    CHAT --> COPILOT
    CHAT --> CONTENT
    TRANSCRIPT --> WEBHOOKS
    UPLOAD --> KBROUTER
    CALLEND --> CALLS

    DCNOTES --> ORCH
    CALLS --> ORCH
    COPILOT --> ORCH
    CONTENT --> ORCH
    KBROUTER --> ORCH
    WEBHOOKS --> ORCH

    ORCH --> WORKFLOW
    ORCH --> CONTENTAGENT
    ORCH --> LIVEAGENT
    ORCH --> CHECKLIST
    ORCH --> POSTDC
    ORCH --> GEN
    ORCH --> KNOWLEDGE
    ORCH --> SALES

    WORKFLOW --> PG
    CONTENTAGENT --> VECTOR
    LIVEAGENT --> MEMORY
    CHECKLIST --> MEMORY
    POSTDC --> PG
    GEN --> STORAGE
    KNOWLEDGE --> VECTOR
    SALES --> RUNS
    ORCH --> RUNS
```

## 5. Non-Functional Requirements Coverage

```mermaid
flowchart TB
    NFR["Non-Functional Requirements"]

    NFR --> SECURITY["Security"]
    NFR --> PERFORMANCE["Performance"]
    NFR --> RELIABILITY["Reliability"]
    NFR --> AUDIT["Auditability"]
    NFR --> COST["Cost Governance"]
    NFR --> SCALE["Scalability"]

    SECURITY --> SEC1["Clerk auth and tenant context"]
    SECURITY --> SEC2["Tenant-scoped Supabase access"]
    SECURITY --> SEC3["Webhook secret validation for production Recall events"]

    PERFORMANCE --> PERF1["Live transcript path targets low latency"]
    PERFORMANCE --> PERF2["Cached KB retrieval and live memory"]
    PERFORMANCE --> PERF3["Async generation for heavier post-call and Studio work"]

    RELIABILITY --> REL1["Recall webhook plus transcript polling fallback"]
    RELIABILITY --> REL2["Agent fallback model policy"]
    RELIABILITY --> REL3["Graceful degraded responses for missing KB or LLM failures"]

    AUDIT --> AUD1["Agent run records"]
    AUDIT --> AUD2["Prompt version tracking"]
    AUDIT --> AUD3["Evidence and citation requirements"]

    COST --> COST1["Per-agent cost caps"]
    COST --> COST2["Model policy by agent"]
    COST --> COST3["Dashboard visibility for agent spend and runs"]

    SCALE --> SCALE1["Next.js BFF separates browser from backend"]
    SCALE --> SCALE2["FastAPI routes isolate workflow surfaces"]
    SCALE --> SCALE3["Supabase storage, Postgres, and pgvector for persistent data"]
```
