from __future__ import annotations

import uuid
from typing import Any, Dict, Optional

from dc_core.evidence import validate_envelope
from dc_core.tenancy import TenantContext

from app.agents.content_agent import generate_pre_dc_brief
from app.agents.content_generation_agent import run_studio_turn
from app.agents.coaching_agent import generate_scorecard
from app.agents.knowledge_agent import ingest_asset_metadata
from app.agents.live_call_agent import handle_transcript_segment
from app.agents.task_agent import draft_post_call_artifacts
from app.domain.calls_service import CallsService
from app.domain.dc_notes_repository import get_dc_notes_repository
from app.domain.content_studio_repository import get_content_studio_repository
from app.domain.agent_runs_repository import get_agent_runs_repository
from app.domain.memory_store import get_memory_store
from app.services.content_export_service import export_revision
from app.services.template_ingest_service import process_template_ingest


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
        self._log_run(ctx, envelope)
        return envelope.model_dump()

    def dispatch_post_call(self, ctx: TenantContext, call_id: str) -> Dict[str, Any]:
        task_env = draft_post_call_artifacts(call_id)
        coach_env = generate_scorecard(call_id)
        validate_envelope(task_env)
        validate_envelope(coach_env)
        self._log_run(ctx, task_env)
        self._log_run(ctx, coach_env)
        return {"task": task_env.model_dump(), "coaching": coach_env.model_dump()}

    def dispatch_kb_ingest(self, ctx: TenantContext, asset: Dict[str, Any]) -> Dict[str, Any]:
        env = ingest_asset_metadata(ctx.tenant_id, asset)
        validate_envelope(env)
        self._log_run(ctx, env)
        return env.model_dump()

    def dispatch_live_segment(self, ctx: TenantContext, call_id: str, text: str) -> Dict[str, Any]:
        env = handle_transcript_segment(call_id, text)
        self._log_run(ctx, env)
        return env.model_dump()

    def dispatch_studio_turn(
        self,
        ctx: TenantContext,
        project_id: str,
        user_message: str,
        template_id: Optional[str] = None,
        allow_generation: bool = False,
    ) -> Dict[str, Any]:
        repo = get_content_studio_repository()
        repo.add_message(
            ctx,
            project_id,
            role="user",
            content={"text": user_message},
        )
        envelope = run_studio_turn(
            ctx,
            project_id=project_id,
            user_message=user_message,
            template_id=template_id,
            allow_generation=allow_generation,
            repo=repo,
        )
        validate_envelope(envelope)
        repo.add_message(
            ctx,
            project_id,
            role="assistant",
            content=envelope.result,
            turn_type=envelope.result.get("turn_type"),
            trace_id=envelope.trace_id,
        )
        self._log_run(ctx, envelope)
        return envelope.model_dump()

    def dispatch_template_ingest(
        self,
        ctx: TenantContext,
        *,
        file_name: str,
        file_bytes: bytes,
        ext: str,
        name: Optional[str] = None,
        artifact_type: Optional[str] = None,
        tags: Optional[list] = None,
    ) -> Dict[str, Any]:
        repo = get_content_studio_repository()
        upload = repo.create_template_upload(
            ctx,
            file_name=file_name,
            file_bytes=file_bytes,
            ext=ext,
            name=name,
            artifact_type=artifact_type,
            tags=tags,
        )
        template_id = upload["template"]["id"]
        storage_path = upload["storagePath"]
        try:
            tpl = process_template_ingest(ctx, template_id, storage_path)
        except Exception:
            tpl = repo.get_template(ctx, template_id)
        trace = str(uuid.uuid4())
        get_agent_runs_repository().append_run(
            ctx,
            agent_id="content_generation",
            operation="template_ingest",
            trace_id=trace,
        )
        self._audit(ctx, "content_generation", "template_ingest", trace)
        return {"template": tpl, "storagePath": storage_path}

    def dispatch_studio_export(
        self,
        ctx: TenantContext,
        revision_id: str,
        fmt: str,
    ) -> Dict[str, Any]:
        result = export_revision(ctx, revision_id, fmt)
        trace = str(uuid.uuid4())
        get_agent_runs_repository().append_run(
            ctx,
            agent_id="content_generation",
            operation=f"export_{fmt}",
            trace_id=trace,
        )
        self._audit(ctx, "content_generation", f"export_{fmt}", trace)
        return result

    def _log_run(self, ctx: TenantContext, envelope: Any) -> None:
        cost = envelope.cost if isinstance(envelope.cost, dict) else {}
        get_agent_runs_repository().append_run(
            ctx,
            agent_id=envelope.agent,
            operation=envelope.operation,
            trace_id=envelope.trace_id,
            cost_usd=float(cost.get("usd", 0) or 0),
            tokens_used=int(cost.get("tokens", 0) or 0),
            model_used=str(cost.get("model", "") or ""),
        )
        self._audit(ctx, envelope.agent, envelope.operation, envelope.trace_id)

    def _audit(self, ctx: TenantContext, agent_id: str, action: str, trace_id: str) -> None:
        from datetime import datetime, timezone

        self.memory.add_audit(
            ctx.tenant_id,
            {
                "id": str(uuid.uuid4()),
                "agent": agent_id,
                "action": action,
                "trace_id": trace_id,
                "created_at": datetime.now(timezone.utc).isoformat(),
            },
        )
