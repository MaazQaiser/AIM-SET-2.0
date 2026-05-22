from __future__ import annotations

import uuid
from typing import Any, Dict, Optional

from dc_core.evidence import AgentEnvelope, validate_envelope
from dc_core.tenancy import TenantContext

from app.agents.content_agent import generate_pre_dc_brief
from app.agents.pre_dc_agent import run_pre_dc_pipeline
from app.agents.content_generation_agent import run_studio_turn
from app.agents.coaching_agent import generate_scorecard
from app.agents.knowledge_agent import ingest_asset_metadata
from app.agents.discovery_checklist_agent import finalize_session, handle_segment, seed_checklist
from app.agents.live_call.handler import handle_call_end, handle_transcript_segment
from app.agents.task_agent import draft_post_call_artifacts
from dc_tools.bant import checklist_from_dict
from app.domain.calls_service import CallsService
from app.domain.dc_notes_repository import get_dc_notes_repository
from app.domain.content_studio_repository import get_content_studio_repository
from app.domain.agent_runs_repository import get_agent_runs_repository
from app.domain.memory_store import get_memory_store
from app.agents.live_call_agent import bot_chat_response
from app.domain.call_channel import get_call_channel
from app.services.content_export_service import export_revision
from app.services.template_ingest_service import process_template_ingest


class Orchestrator:
    def __init__(self) -> None:
        self.calls = CallsService()
        self.dc_notes = get_dc_notes_repository()
        self.memory = get_memory_store()

    def _pre_dc_fields_for_call(self, ctx: TenantContext, call_id: str) -> Dict[str, str]:
        call = self.calls.get_call(ctx, call_id)
        if not call:
            return {}
        notes = self.dc_notes.get_notes(ctx)
        account = (call.get("accountName") or "").lower()
        for row in notes["pre_dc_records"]:
            fields = row.get("fields") or {}
            company = (fields.get("Company Name-PreDC") or "").strip()
            if company and account in company.lower():
                return {str(k): str(v) for k, v in fields.items()}
        return {}

    def dispatch_pre_dc_pipeline(
        self,
        ctx: TenantContext,
        call_id: str,
        fields: Dict[str, str],
        *,
        trigger: str = "ingest",
    ) -> Dict[str, Any]:
        account_name = (fields.get("Company Name-PreDC") or "").strip()
        if not account_name:
            raise ValueError("Company Name-PreDC is required for Pre-DC pipeline")

        existing = self.calls.get_brief(ctx, call_id) or {}
        try:
            envelope = run_pre_dc_pipeline(ctx, call_id, account_name, fields, trigger=trigger)
            validate_envelope(envelope)
            merged = {**existing, **envelope.result}
            merged["callId"] = call_id
            merged["accountName"] = account_name
            merged["agentRunId"] = envelope.trace_id
            self.calls.save_brief(ctx, call_id, merged)
            self._log_run(ctx, envelope)
            return envelope.model_dump()
        except Exception:
            failed = {**existing, "agentStatus": "failed", "callId": call_id, "accountName": account_name}
            self.calls.save_brief(ctx, call_id, failed)
            raise

    def dispatch_pre_dc_brief(self, ctx: TenantContext, call_id: str) -> Dict[str, Any]:
        fields = self._pre_dc_fields_for_call(ctx, call_id)
        if fields:
            return self.dispatch_pre_dc_pipeline(ctx, call_id, fields, trigger="manual")

        call = self.calls.get_call(ctx, call_id)
        if not call:
            raise ValueError(f"Call not found: {call_id}")

        research: Dict[str, str] = {}
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
        from app.domain.kb_tenancy import resolve_kb_tenant
        from app.domain.live_call_session import clear_live_session

        _, clerk_key = resolve_kb_tenant(ctx)
        live_snapshot = clear_live_session(clerk_key, call_id)
        if live_snapshot:
            self.calls.save_live_signals(ctx, call_id, live_snapshot)

        discovery_snapshot = self._finalize_discovery_checklist(ctx, call_id)
        task_env = draft_post_call_artifacts(call_id, discovery_snapshot=discovery_snapshot)
        coach_env = generate_scorecard(call_id, discovery_snapshot=discovery_snapshot)
        validate_envelope(task_env)
        validate_envelope(coach_env)
        self._log_run(ctx, task_env)
        self._log_run(ctx, coach_env)
        out: Dict[str, Any] = {
            "task": task_env.model_dump(),
            "coaching": coach_env.model_dump(),
        }
        if discovery_snapshot:
            out["discovery"] = discovery_snapshot
        if live_snapshot:
            out["live_signals"] = live_snapshot
        return out

    def dispatch_call_end(self, ctx: TenantContext, call_id: str) -> Dict[str, Any]:
        return handle_call_end(ctx, call_id)

    def dispatch_bot_chat(
        self,
        ctx: TenantContext,
        call_id: str,
        message: str,
        *,
        mode: str = "group",
        sender_name: Optional[str] = None,
        sender_role: Optional[str] = None,
    ) -> Dict[str, Any]:
        from app.domain.live_call_repository import get_live_call_repository
        from app.orchestrator.live_broadcast import envelope_to_ws_messages

        env = bot_chat_response(
            ctx,
            call_id,
            message,
            mode=mode,
            sender_name=sender_name,
            sender_role=sender_role,
        )
        validate_envelope(env)
        self._log_run(ctx, env)
        repo = get_live_call_repository()
        sid = str(uuid.uuid4())
        repo.append_suggestion(
            ctx,
            call_id,
            operation="bot_chat_response",
            payload={**env.result, "mode": mode, "sender_name": sender_name, "sender_role": sender_role},
            trace_id=env.trace_id,
            suggestion_id=sid,
        )
        ws_messages = envelope_to_ws_messages(env, suggestion_id=sid, shown_at=None)
        if mode == "group":
            for msg in ws_messages:
                if msg.get("type") == "bot_chat":
                    payload = msg.get("payload") or {}
                    payload["message_id"] = sid
                    payload["sender_name"] = sender_name
                    payload["sender_role"] = sender_role
                get_call_channel().broadcast_sync(call_id, msg)
        return {
            "envelope": env.model_dump(),
            "content": env.result.get("answer"),
            "message_id": sid,
            "citations": [c.model_dump() for c in env.citations],
            "ws_messages": ws_messages if mode == "group" else [],
        }

    def dispatch_kb_ingest(self, ctx: TenantContext, asset: Dict[str, Any]) -> Dict[str, Any]:
        env = ingest_asset_metadata(ctx.tenant_id, asset)
        validate_envelope(env)
        self._log_run(ctx, env)
        return env.model_dump()

    def dispatch_live_segment(
        self,
        ctx: TenantContext,
        call_id: str,
        segment: Any,
        *,
        elapsed_seconds: int = 0,
    ) -> Dict[str, Any]:
        if isinstance(segment, str):
            segment = {"text": segment, "timestamp": elapsed_seconds}
        elif not isinstance(segment, dict):
            segment = {"text": str(segment), "timestamp": elapsed_seconds}

        text = (segment.get("text") or "").strip()
        # Use segment offset as elapsed_seconds if not explicitly provided
        seg_offset = int(float(segment.get("offset_seconds") or segment.get("timestamp") or 0))
        if elapsed_seconds == 0 and seg_offset > 0:
            elapsed_seconds = seg_offset
        if segment.get("timestamp") is None:
            segment["timestamp"] = elapsed_seconds

        call = self.calls.get_call(ctx, call_id) or {}
        seed_bant = call.get("bant") if isinstance(call.get("bant"), dict) else None

        stored = self.memory.get_discovery_checklist(ctx.tenant_id, call_id)
        state = checklist_from_dict(stored) if stored else None

        discovery_out = handle_segment(
            call_id,
            text,
            state=state,
            elapsed_seconds=elapsed_seconds,
            seed_bant=seed_bant,
        )
        checklist_env = discovery_out["envelope"]
        validate_envelope(checklist_env)
        self._log_run(ctx, checklist_env)

        self.memory.set_discovery_checklist(
            ctx.tenant_id,
            call_id,
            discovery_out["checklist"],
        )

        intent_out = handle_transcript_segment(ctx, call_id, segment)
        live_envelope = AgentEnvelope.model_validate(intent_out["envelope"])
        validate_envelope(live_envelope)
        self._log_run(ctx, live_envelope)
        live_result = live_envelope.result or {}
        live_nudge = live_result.get("nudge")

        # Broadcast discovery checklist update via WebSocket
        ws_messages = intent_out.get("ws_messages") or []
        checklist_data = discovery_out["checklist"]
        checklist_ws = {"type": "checklist_update", "payload": checklist_data}
        ws_messages.append(checklist_ws)
        get_call_channel().broadcast_sync(call_id, checklist_ws)

        # Broadcast BANT signals if any
        bant_signals = discovery_out.get("bant_signals") or []
        if bant_signals:
            bant_ws = {"type": "bant_signal", "payload": bant_signals}
            ws_messages.append(bant_ws)
            get_call_channel().broadcast_sync(call_id, bant_ws)

        nudge = discovery_out.get("nudge") or live_nudge
        return {
            "discovery": checklist_env.model_dump(),
            "live": live_envelope.model_dump(),
            "checklist": checklist_data,
            "nudge": nudge,
            "bant_signals": bant_signals,
            "live_nudge": live_nudge,
            "ws_messages": ws_messages,
        }

    def _finalize_discovery_checklist(
        self, ctx: TenantContext, call_id: str
    ) -> Optional[Dict[str, Any]]:
        stored = self.memory.pop_discovery_checklist(ctx.tenant_id, call_id)
        if not stored:
            call = self.calls.get_call(ctx, call_id) or {}
            seed = call.get("bant") if isinstance(call.get("bant"), dict) else None
            state = seed_checklist(call_id, seed_bant=seed)
        else:
            state = checklist_from_dict(stored)

        env = finalize_session(call_id, state)
        validate_envelope(env)
        self._log_run(ctx, env)
        snapshot = env.model_dump()
        self.memory.set_discovery_checklist(ctx.tenant_id, f"{call_id}:final", snapshot)
        return snapshot

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
