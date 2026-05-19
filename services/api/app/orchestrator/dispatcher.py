from __future__ import annotations

import uuid
from typing import Any, Dict

from dc_core.evidence import validate_envelope
from dc_core.tenancy import TenantContext

from app.agents.content_agent import generate_pre_dc_brief
from app.agents.coaching_agent import generate_scorecard
from app.agents.knowledge_agent import ingest_asset_metadata
from app.agents.live_call_agent import handle_transcript_segment
from app.agents.task_agent import draft_post_call_artifacts
from app.domain.calls_service import CallsService
from app.domain.dc_notes_repository import get_dc_notes_repository
from app.domain.memory_store import get_memory_store


class Orchestrator:
    def __init__(self) -> None:
        self.calls = CallsService()
        self.dc_notes = get_dc_notes_repository()
        self.memory = get_memory_store()

    def dispatch_pre_dc_brief(self, ctx: TenantContext, call_id: str) -> Dict[str, Any]:
        call = self.calls.get_call(ctx, call_id)
        if not call:
            raise ValueError(f"Call not found: {call_id}")

        notes = self.dc_notes.get_notes(ctx)
        research: Dict[str, str] = {}
        for row in notes["pre_dc_records"]:
            fields = row.get("fields") or {}
            if call["accountName"].lower() in (fields.get("Company Name-PreDC") or "").lower():
                research = {
                    "needs": fields.get("Have they described their needs", ""),
                    "company_description": fields.get("Company Description", ""),
                    "deal_stage": fields.get("Company Stage", "Discovery"),
                    "other": fields.get("Other Information", ""),
                }
                break

        envelope = generate_pre_dc_brief(
            ctx.tenant_id,
            call_id,
            call["accountName"],
            research,
            clerk_tenant_key=ctx.tenant_id,
        )
        validate_envelope(envelope)
        self.calls.save_brief(ctx, call_id, envelope.result)
        self._log_run(ctx, envelope.agent, envelope.operation, envelope.trace_id, envelope.cost.get("usd", 0))
        return envelope.model_dump()

    def dispatch_post_call(self, ctx: TenantContext, call_id: str) -> Dict[str, Any]:
        task_env = draft_post_call_artifacts(call_id)
        coach_env = generate_scorecard(call_id)
        validate_envelope(task_env)
        validate_envelope(coach_env)
        return {"task": task_env.model_dump(), "coaching": coach_env.model_dump()}

    def dispatch_kb_ingest(self, ctx: TenantContext, asset: Dict[str, Any]) -> Dict[str, Any]:
        env = ingest_asset_metadata(ctx.tenant_id, asset)
        validate_envelope(env)
        return env.model_dump()

    def dispatch_live_segment(self, ctx: TenantContext, call_id: str, text: str) -> Dict[str, Any]:
        env = handle_transcript_segment(call_id, text)
        return env.model_dump()

    def _log_run(self, ctx: TenantContext, agent_id: str, operation: str, trace_id: str, cost: float) -> None:
        self.memory.add_agent_run(
            ctx.tenant_id,
            {
                "id": str(uuid.uuid4()),
                "agent_id": agent_id,
                "operation": operation,
                "trace_id": trace_id,
                "status": "success",
                "cost_usd": cost,
            },
        )
        self.memory.add_audit(
            ctx.tenant_id,
            {
                "actor_id": ctx.user_id,
                "action": operation,
                "agent": agent_id,
                "trace_id": trace_id,
            },
        )
