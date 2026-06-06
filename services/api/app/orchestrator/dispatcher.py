from __future__ import annotations

import uuid
import logging
import re
from typing import Any, Dict, List, Optional

from dc_core.evidence import AgentEnvelope, validate_envelope
from dc_core.tenancy import TenantContext

from app.agents.content_agent import generate_pre_dc_brief
from app.agents.pre_dc_agent import run_pre_dc_pipeline, research_from_fields
from app.agents.relevant_content import build_relevant_content
from app.agents.content_generation_agent import run_studio_bootstrap, run_studio_turn
from app.agents.knowledge_agent import ingest_asset_metadata
from app.agents.discovery_checklist_agent import finalize_session, handle_segment, seed_checklist
from app.agents.live_call.handler import handle_call_end, handle_transcript_segment
from app.agents.post_dc_agent import run_post_dc_pipeline
from dc_tools.bant import build_next_actions, checklist_from_dict, update_checklist_from_segment
from app.domain.calls_service import CallsService, call_id_aliases
from app.domain.dc_notes_repository import get_dc_notes_repository
from app.domain.content_studio_repository import get_content_studio_repository
from app.domain.agent_runs_repository import get_agent_runs_repository
from app.domain.live_call_repository import get_live_call_repository
from app.domain.memory_store import get_memory_store
from app.agents.live_call_agent import bot_chat_response, build_call_agent_handoff
from app.agents.sales_copilot_agent import copilot_chat_response
from app.services.content_export_service import export_revision
from app.services.template_ingest_service import process_template_ingest

_logger = logging.getLogger(__name__)


def _float_or_zero(value: Any) -> float:
    try:
        return float(value or 0)
    except (TypeError, ValueError):
        return 0.0


CUSTOMER_LIKE_ROLES = {"customer", "prospect", "buyer", "guest", ""}

BANT_REPLAY_CUE_RE = re.compile(
    r"(\$|\b\d+(?:\.\d+)?\s*(?:k|m|b|thousand|million|billion)\b|"
    r"\b(?:budget|pricing|spend|investment|funding|deadline|timeline|eta|go-live|go live|"
    r"launch|pilot|rollout|cfo|ceo|cto|coo|board|decision|approve|approval|need|needs|"
    r"critical|priority|pain|problem|challenge|manual|bottleneck|must have)\b)",
    re.I,
)

REP_QUESTION_RE = re.compile(
    r"\b(?:what|who|when|where|why|how|can|could|would|do|does|did|is|are)\b.+\?",
    re.I,
)


def _discovery_context_text(
    events: List[Dict[str, Any]],
    fallback: str,
    *,
    strict_roles: bool = True,
) -> str:
    if not events:
        return fallback

    latest = events[-1]
    latest_role = str(latest.get("speaker_role") or "").lower()
    if strict_roles and latest_role not in CUSTOMER_LIKE_ROLES:
        return fallback

    latest_offset = _float_or_zero(latest.get("offset_seconds"))
    latest_speaker = str(latest.get("speaker_id") or latest.get("speaker_name") or "")
    fallback_text = fallback.strip()
    parts: List[str] = [fallback_text] if fallback_text else []

    for event in events[-8:]:
        role = str(event.get("speaker_role") or "").lower()
        if strict_roles and role not in CUSTOMER_LIKE_ROLES:
            continue
        if latest_offset and latest_offset - _float_or_zero(event.get("offset_seconds")) > 14:
            continue
        speaker = str(event.get("speaker_id") or event.get("speaker_name") or "")
        if latest_speaker and speaker and speaker != latest_speaker:
            continue
        text = str(event.get("text") or "").strip()
        if text and text != fallback_text:
            parts.append(text)

    context = " ".join(parts).strip()
    return context[:360] if context else fallback


def _event_offset_seconds(event: Dict[str, Any]) -> float:
    return _float_or_zero(event.get("offset_seconds") or event.get("timestamp"))


def _event_speaker_role(event: Dict[str, Any]) -> str:
    return str(event.get("speaker_role") or event.get("speakerRole") or "").lower()


def _event_text(event: Dict[str, Any]) -> str:
    return str(event.get("text") or "").strip()


def _is_customer_like_event(event: Dict[str, Any]) -> bool:
    return _event_speaker_role(event) in CUSTOMER_LIKE_ROLES


def _is_bant_replay_candidate(event: Dict[str, Any]) -> bool:
    text = _event_text(event)
    if not text:
        return False
    if REP_QUESTION_RE.search(text):
        return False
    return bool(BANT_REPLAY_CUE_RE.search(text))


def _replay_discovery_from_transcript(state: Any, transcript_events: List[Dict[str, Any]]) -> Any:
    """Repair missed live BANT signals at wrap-up from the completed transcript."""
    if not transcript_events:
        return state

    replayed = state
    ordered = sorted(transcript_events, key=_event_offset_seconds)
    has_customer_like_events = any(_is_customer_like_event(event) for event in ordered)
    for index, event in enumerate(ordered):
        text = _event_text(event)
        if not text:
            continue
        strict_roles = has_customer_like_events
        if strict_roles and not _is_customer_like_event(event):
            continue
        if not strict_roles and not _is_bant_replay_candidate(event):
            continue
        context_text = _discovery_context_text(
            ordered[: index + 1],
            text,
            strict_roles=strict_roles,
        )
        replayed, _, _ = update_checklist_from_segment(
            replayed,
            context_text,
            transcript_offset_seconds=_event_offset_seconds(event),
            sentiment=event.get("sentiment"),
            speaker_role=event.get("speaker_role") or event.get("speakerRole"),
            signal_type=event.get("signal_type") or event.get("signalType"),
        )
    return replayed


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

    def _post_dc_record_for_call(self, ctx: TenantContext, call_id: str) -> Optional[Dict[str, Any]]:
        aliases = set(call_id_aliases(call_id))
        notes = self.dc_notes.get_notes(ctx)
        for row in notes["post_dc_records"]:
            matched = row.get("matched_call_id") or row.get("matchedCallId")
            if matched and str(matched) in aliases:
                return row
        return None

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
            from app.services.content_gaps_service import sync_gaps_from_brief

            sync_gaps_from_brief(ctx, call_id, merged)
            return envelope.model_dump()
        except Exception:
            failed = {**existing, "agentStatus": "failed", "callId": call_id, "accountName": account_name}
            self.calls.save_brief(ctx, call_id, failed)
            raise

    def dispatch_relevant_content(self, ctx: TenantContext, call_id: str) -> Dict[str, Any]:
        fields = self._pre_dc_fields_for_call(ctx, call_id)
        call = self.calls.get_call(ctx, call_id)
        account_name = (fields.get("Company Name-PreDC") or (call or {}).get("accountName") or "").strip()
        if not account_name:
            raise ValueError("Account name required to load relevant content")

        research = research_from_fields(fields) if fields else {}
        relevant = build_relevant_content(ctx, account_name, research)

        existing = self.calls.get_brief(ctx, call_id) or {}
        merged = {
            **existing,
            "callId": call_id,
            "accountName": account_name,
            **relevant,
        }
        self.calls.save_brief(ctx, call_id, merged)
        return {**relevant, "cached": False}

    def get_relevant_content(self, ctx: TenantContext, call_id: str, *, refresh: bool = False) -> Dict[str, Any]:
        if not refresh:
            existing = self.calls.get_brief(ctx, call_id) or {}
            documents = existing.get("relevantDocuments") or []
            projects = existing.get("relevantProjects") or []
            deck = existing.get("recommendedDeck")
            if documents or projects or deck:
                return {
                    "relevantDocuments": documents,
                    "relevantProjects": projects,
                    "recommendedDeck": deck,
                    "cached": True,
                }
        return self.dispatch_relevant_content(ctx, call_id)

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
        from app.domain.live_call_repository import get_live_call_repository

        _, clerk_key = resolve_kb_tenant(ctx)
        live_snapshot = clear_live_session(clerk_key, call_id)
        if live_snapshot:
            self.calls.save_live_signals(ctx, call_id, live_snapshot)

        call = self.calls.get_call(ctx, call_id) or {}
        brief = self.calls.get_brief(ctx, call_id) or {}
        pre_dc_fields = self._pre_dc_fields_for_call(ctx, call_id)
        post_dc_record = self._post_dc_record_for_call(ctx, call_id)
        live_repo = get_live_call_repository()
        transcript_events = live_repo.list_transcript_events(ctx, call_id, limit=500)
        discovery_snapshot = self._finalize_discovery_checklist(
            ctx,
            call_id,
            transcript_events=transcript_events,
        )
        live_suggestions = live_repo.list_suggestions(ctx, call_id, limit=200)
        call_agent_handoff = build_call_agent_handoff(
            ctx,
            call_id,
            discovery_snapshot=discovery_snapshot,
            live_snapshot=live_snapshot,
            live_suggestions=live_suggestions,
            transcript_events=transcript_events,
        )
        live_repo.end_session(ctx, call_id, call_agent_handoff)
        post_env = run_post_dc_pipeline(
            ctx,
            call_id,
            call=call,
            pre_dc_fields=pre_dc_fields,
            call_brief=brief,
            discovery_snapshot=discovery_snapshot,
            live_snapshot=live_snapshot,
            live_suggestions=live_suggestions,
            transcript_events=transcript_events,
            call_agent_handoff=call_agent_handoff,
            post_dc_record=post_dc_record,
        )
        validate_envelope(post_env)
        self.calls.save_post_review(ctx, call_id, post_env.result)
        self._log_run(ctx, post_env)
        self._maybe_pregenerate_landing_page(ctx, call_id, post_env.result)
        from app.services.content_gaps_service import sync_gaps_from_post_call

        sync_gaps_from_post_call(ctx, call_id, post_env.result)
        out: Dict[str, Any] = {
            **post_env.result,
            "envelope": post_env.model_dump(),
        }
        if discovery_snapshot:
            out["discovery"] = discovery_snapshot
        if live_snapshot:
            out["live_signals"] = live_snapshot
        out["call_agent_outputs"] = call_agent_handoff
        return out

    def _maybe_pregenerate_landing_page(
        self, ctx: TenantContext, call_id: str, post_result: Dict[str, Any]
    ) -> None:
        from app.domain.clp_service import _landing_page_eligible, get_clp_service

        review = post_result.get("review")
        if not _landing_page_eligible(review if isinstance(review, dict) else None):
            return
        try:
            svc = get_clp_service()
            if svc.get(ctx, call_id):
                return
            svc.generate_draft(ctx, call_id)
        except Exception:
            _logger.exception("Landing page pre-generate failed for call %s", call_id)

    def dispatch_call_end(self, ctx: TenantContext, call_id: str) -> Dict[str, Any]:
        return handle_call_end(ctx, call_id)

    def dispatch_copilot_chat(
        self,
        ctx: TenantContext,
        message: str,
        history: Optional[List[Dict[str, str]]] = None,
        *,
        call_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        env = copilot_chat_response(
            ctx,
            message,
            history,
            call_id=call_id,
            orchestrator=self,
        )
        validate_envelope(env)
        self._log_run(ctx, env)
        sid = str(uuid.uuid4())
        return {
            "envelope": env.model_dump(),
            "answer": env.result.get("answer"),
            "message_id": sid,
            "citations": [c.model_dump() for c in env.citations],
            "actions_taken": env.result.get("actions_taken") or [],
            "call_exports": env.result.get("call_exports") or [],
        }

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

        intent_out = handle_transcript_segment(ctx, call_id, segment)
        live_envelope = AgentEnvelope.model_validate(intent_out["envelope"])
        validate_envelope(live_envelope)
        self._log_run(ctx, live_envelope)
        live_result = live_envelope.result or {}
        live_nudge = live_result.get("nudge")

        # Collect live WS messages first so transcript enrichment and sentiment
        # are not blocked by checklist/call lookup failures.
        ws_messages = intent_out.get("ws_messages") or []
        discovery_out: Dict[str, Any] = {}
        checklist_env: AgentEnvelope | None = None
        checklist_data: Dict[str, Any] = {}
        bant_signals = []
        try:
            try:
                call = self.calls.get_call(ctx, call_id) or {}
            except Exception:
                _logger.exception("call lookup failed during live checklist update call_id=%s", call_id)
                call = {}
            seed_bant = call.get("bant") if isinstance(call.get("bant"), dict) else None
            transcript_analysis = (
                live_result.get("transcript") if isinstance(live_result.get("transcript"), dict) else {}
            )

            stored = self.memory.get_discovery_checklist(ctx.tenant_id, call_id)
            state = checklist_from_dict(stored) if stored else None
            recent_events = get_live_call_repository().list_transcript_events(ctx, call_id, limit=8)
            discovery_text = _discovery_context_text(recent_events, text)

            discovery_out = handle_segment(
                call_id,
                discovery_text,
                state=state,
                elapsed_seconds=elapsed_seconds,
                seed_bant=seed_bant,
                sentiment=transcript_analysis.get("sentiment"),
                speaker_role=segment.get("speakerRole") or segment.get("speaker_role"),
                signal_type=transcript_analysis.get("signalType") or transcript_analysis.get("signal_type"),
            )
            checklist_env = discovery_out["envelope"]
            validate_envelope(checklist_env)
            self._log_run(ctx, checklist_env)

            self.memory.set_discovery_checklist(
                ctx.tenant_id,
                call_id,
                discovery_out["checklist"],
            )
            checklist_data = discovery_out["checklist"]
        except Exception:
            _logger.exception("discovery checklist update failed call_id=%s", call_id)

        if checklist_data:
            for msg in ws_messages:
                if msg.get("type") != "intent_update":
                    continue
                payload = msg.get("payload") or {}
                intent_label = (payload.get("intent") or {}).get("label")
                payload["next_actions"] = build_next_actions(
                    checklist_data, intent_label=intent_label
                )
            discovery_nudge = discovery_out.get("nudge")
            if discovery_nudge:
                ws_messages.append({"type": "nudge", "payload": discovery_nudge})
            ws_messages.append({"type": "checklist_update", "payload": checklist_data})

            bant_signals = discovery_out.get("bant_signals") or []
            if bant_signals:
                ws_messages.append({"type": "bant_signal", "payload": bant_signals})

        nudge = discovery_out.get("nudge") or live_nudge
        return {
            "discovery": checklist_env.model_dump() if checklist_env else None,
            "live": live_envelope.model_dump(),
            "checklist": checklist_data,
            "nudge": nudge,
            "bant_signals": bant_signals,
            "live_nudge": live_nudge,
            "ws_messages": ws_messages,
        }

    def _finalize_discovery_checklist(
        self,
        ctx: TenantContext,
        call_id: str,
        *,
        transcript_events: Optional[List[Dict[str, Any]]] = None,
    ) -> Optional[Dict[str, Any]]:
        stored = self.memory.pop_discovery_checklist(ctx.tenant_id, call_id)
        if not stored:
            call = self.calls.get_call(ctx, call_id) or {}
            seed = call.get("bant") if isinstance(call.get("bant"), dict) else None
            state = seed_checklist(call_id, seed_bant=seed)
        else:
            state = checklist_from_dict(stored)

        state = _replay_discovery_from_transcript(state, transcript_events or [])

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

    def dispatch_studio_bootstrap(
        self,
        ctx: TenantContext,
        project_id: str,
    ) -> Dict[str, Any]:
        repo = get_content_studio_repository()
        messages = repo.list_messages(ctx, project_id)
        if messages:
            project = repo.get_project(ctx, project_id)
            if not project:
                raise ValueError(f"Project not found: {project_id}")
            return {
                "agent": "content_generation",
                "operation": "studio_bootstrap_skipped",
                "result": {
                    "project_id": project_id,
                    "turn_type": "outline",
                    "message": "Project already has chat history.",
                },
                "citations": [],
                "confidence": 1.0,
                "cost": {"tokens": 0, "usd": 0.0, "model": "noop"},
                "trace_id": str(uuid.uuid4()),
                "creative": False,
            }

        envelope = run_studio_bootstrap(ctx, project_id=project_id, repo=repo)
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
        process: bool = True,
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
        if process:
            tpl = self.complete_template_ingest(ctx, template_id, storage_path)
        else:
            repo.update_template_progress(
                ctx,
                template_id,
                progress=8,
                stage="queued",
                message="Queued for PowerPoint extraction",
            )
            tpl = repo.get_template(ctx, template_id) or upload["template"]
        return {"template": tpl, "storagePath": storage_path}

    def complete_template_ingest(self, ctx: TenantContext, template_id: str, storage_path: str) -> Dict[str, Any]:
        repo = get_content_studio_repository()
        try:
            tpl = process_template_ingest(ctx, template_id, storage_path)
        except Exception as exc:
            repo.update_template_progress(
                ctx,
                template_id,
                progress=100,
                stage="failed",
                message=str(exc)[:180] or "Template extraction failed",
            )
            tpl = repo.get_template(ctx, template_id)
        trace = str(uuid.uuid4())
        get_agent_runs_repository().append_run(
            ctx,
            agent_id="content_generation",
            operation="template_ingest",
            trace_id=trace,
        )
        self._audit(ctx, "content_generation", "template_ingest", trace)
        return tpl or {"id": template_id, "status": "failed"}

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
        try:
            get_agent_runs_repository().append_run(
                ctx,
                agent_id=envelope.agent,
                operation=envelope.operation,
                trace_id=envelope.trace_id,
                cost_usd=float(cost.get("usd", 0) or 0),
                tokens_used=int(cost.get("tokens", 0) or 0),
                model_used=str(cost.get("model", "") or ""),
            )
        except Exception:
            _logger.exception(
                "agent run log failed agent=%s operation=%s trace_id=%s",
                envelope.agent,
                envelope.operation,
                envelope.trace_id,
            )
        try:
            self._audit(ctx, envelope.agent, envelope.operation, envelope.trace_id)
        except Exception:
            _logger.exception(
                "agent audit log failed agent=%s operation=%s trace_id=%s",
                envelope.agent,
                envelope.operation,
                envelope.trace_id,
            )

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
