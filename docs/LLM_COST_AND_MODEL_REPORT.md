# FullSphere LLM Usage and Cost Report

Prepared for leadership review on 2026-06-08.

## Executive summary

FullSphere is currently designed around a low-cost AI stack:

- Primary generation model: OpenAI `gpt-5.4-mini`.
- Knowledge base embeddings: OpenAI `text-embedding-3-small`.
- Meeting capture/transcription: Recall.ai Meeting Bot API with Recall built-in transcription.
- Claude usage: configured for some agent policies and template vision workflows, but most active product flows route through OpenAI. Discovery Checklist currently runs rule-based despite having a Claude model policy.

The main financial conclusion is that Recall meeting capture is the largest variable cost in live calls. For a one-hour live call, Recall costs about `$0.65/hour` using meeting bot recording plus built-in transcription. The expected LLM analysis layer on top is about `$0.07/hour`, making the expected one-hour live-call AI/provider cost about `$0.72`.

For generated content, model cost is small. A 10-slide generated deck is expected to cost about `$0.05-$0.10` in LLM tokens before normal app infrastructure cost. Exporting HTML to PPTX/PDF/PNG is deterministic application work and has no LLM token charge unless the user asks the agent to revise the content.

The biggest implementation risk is not raw cost. It is measurement accuracy. The code records tokens and model names through most agent envelopes, but the internal OpenAI cost estimator is stale for `gpt-5.4-mini`, and a few direct streaming/tool paths record tokens without USD. This should be fixed before production pilots so finance can trust per-tenant and per-feature reporting.

## Pricing basis

These estimates use public list pricing checked on 2026-06-08. They exclude normal cloud hosting, database, storage, authentication, observability, and team labor.

| Provider item | Current list price used | Source |
| --- | ---: | --- |
| OpenAI `gpt-5.4-mini`, Standard tier | `$0.75 / 1M` input tokens, `$0.075 / 1M` cached input tokens, `$4.50 / 1M` output tokens | [OpenAI API pricing](https://platform.openai.com/docs/pricing/) |
| OpenAI `text-embedding-3-small` | `$0.02 / 1M` embedding input tokens, `$0.01 / 1M` batch | [OpenAI model page](https://platform.openai.com/docs/models/text-embedding-3-small) |
| Anthropic Claude Sonnet 4.6 | `$3 / 1M` input tokens, `$15 / 1M` output tokens | [Claude pricing](https://platform.claude.com/docs/en/about-claude/pricing) |
| Anthropic Claude Haiku 4.5 | `$1 / 1M` input tokens, `$5 / 1M` output tokens | [Claude pricing](https://platform.claude.com/docs/en/about-claude/pricing) |
| Recall.ai Meeting Bot API recording | `$0.50/hour`, prorated to the second | [Recall pricing](https://www.recall.ai/pricing) |
| Recall.ai built-in transcription | `$0.15/hour` | [Recall pricing](https://www.recall.ai/pricing) |
| Recall.ai recording storage | 7 days free, then `$0.05/hour` of recording retained for 30 days | [Recall pricing](https://www.recall.ai/pricing) |

Cost formula:

```text
LLM cost = (input_tokens * input_price_per_1M + output_tokens * output_price_per_1M) / 1,000,000
```

Unless noted otherwise, estimates assume OpenAI Standard tier, no batch discount, no regional data-residency uplift, and no prompt caching discount.

## Feature to model inventory

| Product feature | Active backend path | Current model/version | Typical LLM calls | Notes |
| --- | --- | --- | ---: | --- |
| Landing page and auth journey | Next.js landing/auth routes | None | 0 | No LLM usage. |
| Knowledge base ingestion | `python-packages/dc_embeddings/client.py`, `services/api/app/services/kb_ingest_service.py` | OpenAI `text-embedding-3-small` | Embedding batch per upload | Used to embed extracted document chunks. Cost is negligible for normal document sizes. |
| Knowledge search/retrieval | KB search helpers and retrieval tools | OpenAI `text-embedding-3-small` where vector query embedding is enabled | 1 embedding per query | Used by live call, pre-DC, post-DC, and content workflows to find relevant assets. |
| Pre-DC Workflow | `services/api/app/agents/pre_dc_agent.py` | OpenAI `gpt-5.4-mini` | Up to 3 | Summary, artifact plan, artifact fulfillment. Falls back to heuristic logic if OpenAI is not configured. |
| Pre-DC Brief / Content Agent | `services/api/app/agents/content_agent.py` | OpenAI `gpt-5.4-mini` | 1 | Creates account/call brief from CRM fields and KB hits. |
| Daily dashboard briefing | `services/api/app/agents/briefing_agent.py` | OpenAI `gpt-5.4-mini` through workflow model policy | 1 | Short max-token call, fallback template if unavailable. |
| Content plan suggestions | `services/api/app/agents/content_plan_agent.py` | OpenAI `gpt-5.4-mini` | 0-1 | Rule-based plan first, optionally refined by LLM when OpenAI is configured. |
| Content Studio chat | `services/api/app/agents/content_generation_agent.py` | OpenAI `gpt-5.4-mini` | 1 per assistant turn | Streaming chat path uses OpenAI directly. |
| 10-slide deck generation | `services/api/app/agents/content_generation_agent.py` | OpenAI `gpt-5.4-mini` | Usually 1 generation call, sometimes preceded by chat/plan call | Generates HTML slide sections. PPTX export itself is non-LLM. |
| Template-preserving deck generation | `services/api/app/agents/content_generation_agent.py` | OpenAI `gpt-5.4-mini` | 1 | Generates compact slide JSON, then injects content into template HTML. |
| Slide edit / revision | `services/api/app/agents/content_generation_agent.py` | OpenAI `gpt-5.4-mini` | 1 per slide edit | Direct OpenAI call; token count is not currently converted to USD in that path. |
| Template ingestion from PPT/PDF/image | `services/api/app/services/template_ingest_service.py`, `python-packages/dc_llm/client.py` | Anthropic vision wrapper, should be configured to Claude Sonnet 4.6 for production | 1 per slide image | Current runtime passes the content-generation policy, which defaults to OpenAI, so this path needs a production configuration check before relying on visual template ingestion. |
| Live Call Agent nudges and intent | `services/api/app/agents/live_call_agent.py` | OpenAI `gpt-5.4-mini` | 0-2 per qualifying segment | Cheap rules run first. LLM is invoked only for priority triggers such as objections, competitor, budget, timeline, or multiple signals. |
| Live Call Bot chat | `services/api/app/agents/live_call_agent.py` | OpenAI `gpt-5.4-mini` | 1 per user message | Uses transcript window, brief, and KB hits. |
| Recall meeting bot and transcript | `services/api/app/services/transcript_provider/recall_client.py`, `services/api/app/routers/v1_webhooks.py` | Recall.ai, not an LLM | N/A | External meeting bot records/transcribes, then webhooks feed live analysis. |
| Discovery Checklist | `services/api/app/agents/discovery_checklist_agent.py` | No active LLM call today | 0 | Config default has Claude Haiku policy, but implementation is rule-based BANT state tracking. |
| Post-DC Agent | `services/api/app/agents/post_dc_agent.py` | OpenAI `gpt-5.4-mini` | Up to 3 | Summary, follow-up email, coaching/scorecard. |
| Sales Copilot tool chat | `services/api/app/agents/sales_copilot_agent.py` | OpenAI `gpt-5.4-mini` | 1 or more | Tool-calling loop can make multiple OpenAI calls. Current first-path USD is returned as `0.0`, so production cost reporting needs correction. |

## Current model policy facts from the repo

The central LLM wrapper defaults to `gpt-5.4-mini` in `python-packages/dc_llm/client.py`. It maps legacy Claude policy IDs as follows:

| Configured model ID | Runtime model ID |
| --- | --- |
| `claude-3-haiku-20240307` | `claude-haiku-4-5-20251001` |
| `claude-sonnet-4-20250514` | `claude-sonnet-4-6` |

Agent model policies in `services/api/app/domain/agent_config_defaults.py` currently resolve like this:

| Agent | Configured primary | Configured fallback | Active usage notes |
| --- | --- | --- | --- |
| `live-call` | `gpt-5.4-mini` | `gpt-5.4-mini` | Active for live nudges, objections, intent, and live chat. |
| `content` | `gpt-5.4-mini` | `gpt-5.4-mini` | Active for pre-DC brief. |
| `content_generation` | `gpt-5.4-mini` | `gpt-5.4-mini` | Active for Studio chat, deck generation, slide content, slide edits. |
| `workflow` | `gpt-5.4-mini` | `gpt-5.4-mini` | Active for pre-DC pipeline and daily briefing. |
| `post_dc` | `gpt-5.4-mini` | `gpt-5.4-mini` | Active for post-call review, email, coaching. |
| `discovery-checklist` | `claude-3-haiku-20240307` | `claude-sonnet-4-20250514` | Policy exists, but current code does not call an LLM. |

## Scenario estimates

### 1. Generate a 10-slide PPT

Current flow:

1. User chats with Content Studio.
2. The agent either generates slide HTML directly or generates structured slide content for an existing template.
3. The app exports the resulting revision to PPTX/PDF/PNG without another LLM call.

Expected 10-slide deck cost using `gpt-5.4-mini`:

| Scenario | Estimated input tokens | Estimated output tokens | Estimated LLM cost |
| --- | ---: | ---: | ---: |
| Low complexity | 8,000 | 8,000 | `$0.042` |
| Expected | 14,000 | 12,000 | `$0.065` |
| High complexity | 25,000 | 18,000 | `$0.100` |

Practical planning number: budget `$0.10` per generated 10-slide deck, plus `$0.02-$0.07` per additional revision/chat turn depending on context size.

Time expectation:

- LLM generation: usually 10-45 seconds depending on prompt size, model latency, and output length.
- PPTX export: usually seconds to tens of seconds depending on renderer, slide count, images, and server resources.
- Leadership budget recommendation: cap first draft generation at `$0.15` and total project generation at `$1.50`, which already matches the existing content-generation project ceiling.

Important distinction: uploading and converting a new visual template is different from generating content into an existing template. Template ingestion uses a vision workflow that can call Claude once per slide image. A 10-slide visual template ingestion could reasonably cost about `$0.20-$0.50` if Claude Sonnet vision processes every slide. That is a setup/conversion cost, not a cost for every generated deck.

### 2. Recall AI bot in a one-hour call

Provider cost:

| Item | One-hour cost |
| --- | ---: |
| Recall meeting bot recording | `$0.50` |
| Recall built-in transcription | `$0.15` |
| Recall storage beyond 7 days | `$0.00` if deleted inside free window, otherwise incremental |
| Base Recall cost | `$0.65` |

LLM layer on top:

The live-call agent does not send every transcript line to the LLM. It first runs cheap keyword/rule checks, and invokes the LLM only for qualifying triggers. Current throttle defaults allow up to 3 nudges per 5-minute window, so a one-hour call has a practical ceiling around 36 nudge opportunities before implementation-specific conditions.

| LLM load profile | Example activity | Estimated tokens | Estimated LLM cost |
| --- | --- | ---: | ---: |
| Light | 10 qualifying calls/hour | 15k input, 3k output | `$0.025` |
| Expected | 20 qualifying calls/hour | 40k input, 8k output | `$0.066` |
| Heavy | 36 qualifying calls/hour | 108k input, 21.6k output | `$0.178` |

Knowledge search embeddings during the live call are negligible. Even 30k-50k embedding tokens/hour cost about `$0.001` or less with `text-embedding-3-small`.

Expected all-in provider cost for a one-hour Recall-backed live call:

| Profile | Recall | LLM analysis | Embeddings | Estimated total |
| --- | ---: | ---: | ---: | ---: |
| Light | `$0.65` | `$0.025` | `<$0.001` | `$0.68` |
| Expected | `$0.65` | `$0.066` | `<$0.001` | `$0.72` |
| Heavy | `$0.65` | `$0.178` | `<$0.001` | `$0.83` |

Practical planning number: use `$0.75` per one-hour live call for normal usage, and `$0.85` per one-hour call for heavier analysis. If recordings are retained beyond the free 7-day window, add Recall storage.

### 3. Pre-DC workflow per account/call

Current Pre-DC Workflow can make up to three `gpt-5.4-mini` calls:

1. Account summary.
2. Artifact plan.
3. Artifact fulfillment.

| Scenario | Estimated input tokens | Estimated output tokens | Estimated LLM cost |
| --- | ---: | ---: | ---: |
| Expected | 10,000 | 4,000 | `$0.026` |
| High | 25,000 | 9,000 | `$0.059` |

Practical planning number: `$0.03-$0.06` per Pre-DC run.

### 4. Post-DC review per completed call

Current Post-DC Agent can make up to three `gpt-5.4-mini` calls:

1. Call summary.
2. Client follow-up email.
3. Coaching/scorecard.

| Scenario | Estimated input tokens | Estimated output tokens | Estimated LLM cost |
| --- | ---: | ---: | ---: |
| Expected | 20,000 | 6,000 | `$0.042` |
| High | 60,000 | 18,000 | `$0.126` |

Practical planning number: `$0.05-$0.13` per completed call, depending on transcript length and how much context is included.

### 5. Other common usage

| Feature | Expected model cost |
| --- | ---: |
| Pre-DC brief | About `$0.011` per call/account brief |
| Dashboard daily briefing | About `$0.003` per briefing |
| Sales Copilot chat turn | About `$0.003-$0.015` per normal turn, higher if many tools are called |
| KB ingestion for 100 pages of text, about 50k tokens | About `$0.001` |
| KB query embedding | Less than `$0.0001` per query |

## Unit economics examples

These examples combine the scenario estimates above.

| Usage pattern | Estimated provider AI cost |
| --- | ---: |
| One full sales call: Pre-DC + one-hour live call + Post-DC | About `$0.80-$1.00` |
| One full sales call plus one 10-slide generated deck | About `$0.90-$1.10` |
| 100 one-hour calls/month, no generated decks | About `$72-$85/month` in Recall + LLM provider cost |
| 100 one-hour calls/month plus 100 generated 10-slide decks | About `$78-$95/month` incremental provider AI cost |

The generated deck cost is not the main cost driver. Live meeting capture is.

## Observability and cost-control assessment

What is already strong:

- Agent envelopes generally include token count, USD, model, and trace ID.
- `agent_runs` exists for run-level reporting with `cost_usd`, `tokens_used`, and `model_used`.
- Content Generation has per-run and per-project cost caps. Current defaults are `$0.05` per run and `$1.50` per project.
- Live-call nudges are throttled, which bounds worst-case hourly LLM usage.

Gaps to fix before production:

1. Update `_estimate_openai_cost` in `python-packages/dc_llm/client.py`. It currently treats any `mini` OpenAI model as `$0.15` input and `$0.60` output per 1M tokens. That underestimates current `gpt-5.4-mini` Standard pricing of `$0.75` input and `$4.50` output.
2. Add USD calculation to direct OpenAI paths in Sales Copilot tool chat and Content Studio streaming/slide edit calls. Some paths count tokens but return USD as `0.0`.
3. Normalize all model IDs in persisted telemetry, especially legacy Claude IDs that are remapped at runtime.
4. Create a small admin dashboard or CSV export grouped by tenant, feature, model, tokens, and cost.
5. Add explicit model configuration for template vision. The code path is Anthropic vision, but the content-generation policy defaults to OpenAI. This should be made intentional before relying on template ingestion in production.
6. Track Recall hours separately from LLM tokens. Recall is the dominant live-call cost and cannot be inferred from token telemetry.

## Recommendation

The product is financially feasible from an AI/provider-cost perspective. The expected marginal cost of a complete sales-call journey, including Pre-DC, one hour of Recall-backed live assistance, Post-DC, and one generated 10-slide deck, is roughly `$1` per call journey before normal cloud/application infrastructure.

Leadership should approve a controlled pilot if the following are completed first:

- Fix cost-estimation accuracy for `gpt-5.4-mini`.
- Persist cost for every direct OpenAI path, not just wrapper-based calls.
- Add Recall-hours reporting by tenant/call.
- Decide and configure the production vision model for template ingestion.
- Run a 20-call pilot and compare actual telemetry against the estimates in this report.

With those controls in place, the cost profile is low enough for production experimentation, and the risk shifts from provider spend to product quality, adoption, and operational reliability.
