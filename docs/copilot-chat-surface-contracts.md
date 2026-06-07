# Copilot Chat Surface Contracts

These contracts define what non-live Copilot chat should do before any LLM phrasing is allowed.

## Home

Purpose: prioritize the AE's day from real call data.

Expected evidence:
- call list
- call status
- schedule
- brief readiness

Output structure:
- Snapshot
- Needs attention
- Next

Must not invent calls, risks, or missing briefs. If no calls exist, say so.

Core test prompts:
- Today's priorities
- Missing briefs
- What needs attention today?

## Pre-DC

Purpose: prepare the pod for a specific upcoming discovery call.

Expected evidence:
- active call record
- pre-call brief
- BANT state
- approved company knowledge when proof points are requested

Output structure:
- Prep snapshot
- Gaps to close
- Recommended talk track

Must not invent pains, stakeholders, competitors, or proof points. If the brief is missing, say what can still be inferred from call data.

Core test prompts:
- BANT gaps
- Opening talk track
- Objection prep

## Post-DC

Purpose: turn the completed call into next steps, follow-up, and handoff clarity.

Expected evidence:
- post-call review
- call record
- pre-call brief when available
- transcript summary when available

Output structure:
- Outcome
- Open risks
- Follow-up path

Must use the post-call review as the primary source and avoid unsupported client-facing claims. If the review is missing, say it is not available yet.

Core test prompts:
- Follow-up email
- Open risks
- Jira handoff
