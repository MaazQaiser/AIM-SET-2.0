# SRS / Architecture Diagrams: AIM SET 2.0

This document is a combined Software Requirements Specification and Architecture diagram set for AIM SET 2.0 / DC Copilot. It maps user requirements to the implemented system layers and the main runtime flows.

## 1. SRS Context Diagram

```mermaid
flowchart LR
    AE["Account Executive"]
    POD["SE / Designer / Pod Member"]
    REVOPS["Sales Leadership / RevOps"]
    ADMIN["Content Manager / Admin"]
    CUSTOMER["Customer Meeting Participants"]

    subgraph SYSTEM["AIM SET 2.0 / DC Copilot"]
        PRE["Pre-DC Preparation"]
        LIVE["Live Call Assistance"]
        POST["Post-DC Review"]
        KB["Knowledge Base"]
        STUDIO["Content Studio"]
        ANALYTICS["Analytics and Coaching"]
        GOV["Governance and Agent Controls"]
    end

    subgraph EXT["External Systems"]
        MEETING["Zoom / Meet / Teams"]
        RECALL["Recall.ai"]
        LLM["LLM Providers"]
        CRM["CRM / Jira"]
        AUTH["Clerk Auth"]
        STORE["Supabase"]
    end

    AE --> PRE
    AE --> LIVE
    AE --> POST
    AE --> STUDIO
    POD --> LIVE
    POD --> POST
    REVOPS --> ANALYTICS
    REVOPS --> GOV
    ADMIN --> KB
    ADMIN --> STUDIO
    CUSTOMER --> MEETING

    MEETING --> RECALL
    RECALL --> LIVE
    PRE --> LLM
    LIVE --> LLM
    POST --> LLM
    STUDIO --> LLM
    POST --> CRM
    GOV --> AUTH
    PRE --> STORE
    LIVE --> STORE
    POST --> STORE
    KB --> STORE
    STUDIO --> STORE
    ANALYTICS --> STORE
```

## 2. Functional Requirements To Modules

```mermaid
flowchart TB
    REQ["SRS Functional Requirements"]

    REQ --> FR1["FR-1 Pre-DC preparation"]
    REQ --> FR2["FR-2 Live call assistance"]
    REQ --> FR3["FR-3 Post-DC artifacts"]
    REQ --> FR4["FR-4 Content generation"]
    REQ --> FR5["FR-5 Knowledge base"]
    REQ --> FR6["FR-6 Analytics and coaching"]
    REQ --> FR7["FR-7 Governance, audit, cost control"]

    subgraph UI["apps/web: Next.js UI + BFF"]
        HOME["Dashboard / Calls"]
        LIVEUI["Live Call Workspace"]
        POSTUI["Post-DC Review"]
        KBUi["Knowledge Library"]
        STUDIOUI["Content Studio"]
        AGENTUI["Agent Control Panel"]
    end

    subgraph API["services/api: FastAPI"]
        DCROUTER["dc_notes router"]
        CALLROUTER["v1_calls router"]
        WEBHOOKS["v1_webhooks router"]
        KBROUTER["v1_kb router"]
        CONTENTROUTER["v1_content_studio router"]
        AGENTROUTER["v1_agents router"]
        COPILOTROUTER["v1_copilot router"]
    end

    subgraph CORE["Backend domain and agents"]
        ORCH["Lead Orchestrator"]
        WORKFLOW["PRE-DC Workflow"]
        LIVEAGENT["Live Call Agent"]
        CHECKLIST["Discovery Checklist Tracker"]
        POSTAGENT["Post-DC Agent"]
        CONTENTAGENT["Content Agent"]
        GENAGENT["Content Generation Agent"]
        KNOWLEDGE["Knowledge Agent"]
    end

    FR1 --> HOME
    FR1 --> DCROUTER
    FR1 --> WORKFLOW

    FR2 --> LIVEUI
    FR2 --> CALLROUTER
    FR2 --> WEBHOOKS
    FR2 --> LIVEAGENT
    FR2 --> CHECKLIST

    FR3 --> POSTUI
    FR3 --> CALLROUTER
    FR3 --> POSTAGENT

    FR4 --> STUDIOUI
    FR4 --> CONTENTROUTER
    FR4 --> GENAGENT

    FR5 --> KBUi
    FR5 --> KBROUTER
    FR5 --> KNOWLEDGE
    FR5 --> CONTENTAGENT

    FR6 --> HOME
    FR6 --> AGENTROUTER
    FR6 --> ORCH

    FR7 --> AGENTUI
    FR7 --> AGENTROUTER
    FR7 --> ORCH

    DCROUTER --> ORCH
    CALLROUTER --> ORCH
    WEBHOOKS --> ORCH
    KBROUTER --> ORCH
    CONTENTROUTER --> ORCH
    COPILOTROUTER --> ORCH
    AGENTROUTER --> ORCH
```

## 3. Logical Architecture Diagram

```mermaid
flowchart TB
    subgraph CLIENT["Client Layer"]
        WEB["Next.js App Router UI"]
        BFF["Next.js BFF routes /api/*"]
        QUERY["TanStack Query state"]
        WSCLIENT["WebSocket client"]
    end

    subgraph BACKEND["API Layer"]
        FASTAPI["FastAPI app"]
        REST["REST routers"]
        WSSERVER["WebSocket router"]
        WEBHOOK["Recall webhook and transcript poll"]
        AUTHCTX["Tenant/Auth context"]
    end

    subgraph ORCHESTRATION["Orchestration Layer"]
        ORCH["Lead Orchestrator<br/>dispatcher.py"]
        RUNLOG["Agent run log"]
        POLICY["Agent config, model policy, cost caps"]
    end

    subgraph AGENTS["Agent Layer"]
        SALES["Sales Copilot Agent"]
        PRE["PRE-DC Workflow"]
        CONTENT["Content Agent"]
        LIVE["Live Call Agent"]
        CHECK["Discovery Checklist Tracker"]
        POST["Post-DC Agent"]
        GEN["Content Generation Agent"]
        KNOW["Knowledge Agent"]
    end

    subgraph SERVICES["Service and Tool Layer"]
        RETRIEVE["KB retrieval and citations"]
        EMBED["Embedding and chunking"]
        TRANSCRIPT["Transcript parsing"]
        EXPORT["PDF / PNG / PPTX export"]
        JIRA["Jira / CRM adapter"]
        LLM["LLM client"]
    end

    subgraph DATA["Data Layer"]
        PG["Supabase Postgres"]
        VECTOR["pgvector KB chunks"]
        STORAGE["Supabase Storage"]
        MEMORY["Live session memory/cache"]
        AUDIT["Audit and run events"]
    end

    subgraph EXTERNAL["External Providers"]
        CLERK["Clerk"]
        RECALL["Recall.ai"]
        MODELS["Anthropic / OpenAI"]
        CRM["CRM / Jira"]
    end

    WEB --> BFF
    WEB --> QUERY
    WSCLIENT --> WSSERVER
    BFF --> FASTAPI
    FASTAPI --> REST
    FASTAPI --> WSSERVER
    RECALL --> WEBHOOK
    REST --> AUTHCTX
    WSSERVER --> AUTHCTX
    WEBHOOK --> AUTHCTX
    AUTHCTX --> ORCH

    ORCH --> POLICY
    ORCH --> RUNLOG
    ORCH --> SALES
    ORCH --> PRE
    ORCH --> CONTENT
    ORCH --> LIVE
    ORCH --> CHECK
    ORCH --> POST
    ORCH --> GEN
    ORCH --> KNOW

    SALES --> LLM
    PRE --> RETRIEVE
    CONTENT --> RETRIEVE
    LIVE --> TRANSCRIPT
    CHECK --> TRANSCRIPT
    POST --> LLM
    GEN --> EXPORT
    KNOW --> EMBED

    RETRIEVE --> VECTOR
    EMBED --> VECTOR
    EXPORT --> STORAGE
    TRANSCRIPT --> MEMORY
    LLM --> MODELS
    JIRA --> CRM
    POLICY --> PG
    RUNLOG --> AUDIT
    FASTAPI --> PG
    WEB --> CLERK
    FASTAPI --> CLERK
```

## 4. Orchestrator And Agent Flow

```mermaid
flowchart LR
    EVENT["Incoming event<br/>CSV ingest, chat, KB upload, transcript, call end"]
    ROUTER["FastAPI router"]
    ORCH["Lead Orchestrator"]

    subgraph DECIDE["Orchestrator Responsibilities"]
        ROUTING["Route event"]
        STATE["Load call, tenant, memory state"]
        POLICY["Apply model policy and cost caps"]
        EVIDENCE["Require evidence and citations"]
        LOGGING["Write agent run / audit log"]
    end

    subgraph PRODUCT["Product Agents"]
        WORKFLOW["workflow"]
        CONTENT["content"]
        LIVE["live-call"]
        CHECKLIST["discovery-checklist"]
        POSTDC["post_dc"]
        GENERATION["content_generation"]
        COPILOT["sales-copilot"]
    end

    subgraph SUPPORT["Supporting Modules"]
        KNOWLEDGE["knowledge"]
        PLAN["content_plan"]
        COACH["coaching"]
        TASK["task"]
    end

    subgraph OUTPUT["User-Facing Outputs"]
        BRIEF["Pre-call brief"]
        NUDGE["Live nudge / bot-chat answer"]
        REVIEW["Post-call review"]
        ASSET["Generated content artifact"]
        DASH["Analytics / coaching signal"]
    end

    EVENT --> ROUTER
    ROUTER --> ORCH
    ORCH --> ROUTING
    ORCH --> STATE
    ORCH --> POLICY
    ORCH --> EVIDENCE
    ORCH --> LOGGING

    ROUTING --> WORKFLOW
    ROUTING --> CONTENT
    ROUTING --> LIVE
    ROUTING --> CHECKLIST
    ROUTING --> POSTDC
    ROUTING --> GENERATION
    ROUTING --> COPILOT
    ROUTING --> KNOWLEDGE
    ROUTING --> PLAN
    ROUTING --> COACH
    ROUTING --> TASK

    WORKFLOW --> BRIEF
    CONTENT --> BRIEF
    LIVE --> NUDGE
    CHECKLIST --> NUDGE
    POSTDC --> REVIEW
    GENERATION --> ASSET
    COPILOT --> DASH
    COACH --> DASH
    TASK --> REVIEW
```

## 5. End-To-End Runtime Sequence

```mermaid
sequenceDiagram
    autonumber
    actor AE as Account Executive
    participant WEB as Next.js Web App
    participant BFF as Next.js BFF
    participant API as FastAPI
    participant ORCH as Orchestrator
    participant KB as Knowledge Base
    participant RECALL as Recall.ai
    participant WS as WebSocket
    participant DB as Supabase

    AE->>WEB: Import Pre-DC data or create lead
    WEB->>BFF: POST /api/dc-notes/ingest
    BFF->>API: Forward ingest request
    API->>DB: Persist tenant-scoped notes and call records
    API->>ORCH: dispatch_pre_dc_pipeline()
    ORCH->>KB: Retrieve assets and citations
    ORCH->>DB: Save brief and run log
    API-->>WEB: Return call and brief data

    AE->>WEB: Start Recall bot
    WEB->>BFF: POST /api/calls/{callId}/recall-bot
    BFF->>API: Create Recall bot request
    API->>RECALL: Register bot and transcript webhook
    RECALL-->>API: Bot created
    API->>DB: Link bot ID to live session

    RECALL->>API: Transcript webhook segment
    API->>ORCH: dispatch_live_segment()
    ORCH->>KB: Find relevant content and definitions
    ORCH->>DB: Store transcript, signals, checklist state
    API->>WS: Broadcast live transcript, metrics, nudges
    WS-->>WEB: Update Live Call Workspace

    AE->>WEB: Ask bot-chat question
    WEB->>API: Send live chat message
    API->>ORCH: dispatch_bot_chat()
    ORCH->>KB: Ground answer in KB and transcript
    ORCH-->>WEB: Return cited answer

    AE->>WEB: End call / request post-call review
    WEB->>API: Trigger post-call pipeline
    API->>ORCH: dispatch_post_call()
    ORCH->>DB: Save summary, tasks, coaching, review data
    API-->>WEB: Return Post-DC review for approval
```

## 6. Deployment / Runtime Architecture

```mermaid
flowchart TB
    subgraph USERENV["User Environment"]
        BROWSER["Browser"]
    end

    subgraph VERCEL["Vercel / Web Hosting"]
        NEXT["Next.js web app"]
        BFF["Next.js BFF routes"]
        STATIC["Public assets and landing pages"]
    end

    subgraph APIHOST["API Host"]
        FASTAPI["FastAPI service"]
        WORKERS["Background / async jobs"]
        WSSERVER["WebSocket server"]
    end

    subgraph SUPABASE["Supabase"]
        POSTGRES["Postgres tables"]
        PGVECTOR["pgvector embeddings"]
        STORAGE["Object storage"]
    end

    subgraph PROVIDERS["Managed Providers"]
        CLERK["Clerk Auth"]
        RECALL["Recall.ai"]
        ANTHROPIC["Anthropic"]
        OPENAI["OpenAI"]
        JIRA["Jira / CRM"]
    end

    BROWSER --> NEXT
    NEXT --> BFF
    BFF --> FASTAPI
    BROWSER --> WSSERVER
    NEXT --> STATIC

    FASTAPI --> POSTGRES
    FASTAPI --> PGVECTOR
    FASTAPI --> STORAGE
    WORKERS --> POSTGRES
    WORKERS --> STORAGE
    WSSERVER --> POSTGRES

    BROWSER --> CLERK
    FASTAPI --> CLERK
    RECALL --> FASTAPI
    FASTAPI --> RECALL
    FASTAPI --> ANTHROPIC
    FASTAPI --> OPENAI
    FASTAPI --> JIRA
```

## 7. Traceability Summary

| Requirement group | Primary UI surface | Backend entrypoint | Main orchestrator/agent owner | Data store |
|---|---|---|---|---|
| Pre-DC preparation | Dashboard, call brief | `dc_notes`, `v1_calls` | `dispatch_pre_dc_pipeline`, `workflow`, `content` | Supabase Postgres, KB vectors |
| Live call assistance | Live Call Workspace | `v1_calls`, `v1_webhooks`, WebSocket | `dispatch_live_segment`, `live-call`, `discovery-checklist` | Live memory, transcript events |
| Post-DC review | Post-DC review pages | `v1_calls` | `dispatch_post_call`, `post_dc` | Supabase Postgres |
| Knowledge base | Knowledge library | `v1_kb` | `dispatch_kb_ingest`, `knowledge` | Supabase Storage, pgvector |
| Content Studio | Content Studio | `v1_content_studio` | `dispatch_studio_turn`, `content_generation` | Studio tables, exports bucket |
| Copilot chat | Global copilot dock / bot chat | `v1_copilot` | `dispatch_copilot_chat`, `sales-copilot` | Run log, KB, call context |
| Governance | Agent Control Panel | `v1_agents` | Agent config defaults, model policy, run log | Agent config and audit tables |
