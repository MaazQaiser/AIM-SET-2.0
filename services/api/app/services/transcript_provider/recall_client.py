from __future__ import annotations

from typing import Any, Dict, Iterable, Optional
from urllib.parse import urlencode

import httpx

from dc_core.tenancy import TenantContext

from app.config import get_settings
from app.domain.live_call_repository import get_live_call_repository


class RecallConfigurationError(RuntimeError):
    pass


class RecallAPIError(RuntimeError):
    pass


def create_recall_live_bot(
    ctx: TenantContext,
    call_id: str,
    meeting_url: str,
) -> Dict[str, Any]:
    settings = get_settings()
    missing = _missing_settings(
        {
            "RECALL_API_KEY": settings.recall_api_key,
            "RECALL_REGION": settings.recall_region,
            "PUBLIC_API_BASE_URL": settings.public_api_base_url,
        }
    )
    if missing:
        raise RecallConfigurationError(
            f"Recall is not configured. Set {', '.join(missing)} in services/api/.env."
        )

    base_url = _recall_base_url(settings.recall_region)
    webhook_url = _webhook_url(settings.public_api_base_url, ctx, call_id)
    payload = _create_bot_payload(settings.recall_bot_name, meeting_url, webhook_url, ctx, call_id)

    try:
        response = httpx.post(
            f"{base_url}/api/v1/bot/",
            headers={
                "Authorization": _authorization_header(settings.recall_api_key),
                "accept": "application/json",
                "content-type": "application/json",
            },
            json=payload,
            timeout=20,
        )
    except httpx.HTTPError as exc:
        raise RecallAPIError(f"Recall API request failed: {exc}") from exc

    if response.status_code >= 400:
        raise RecallAPIError(
            f"Recall bot creation failed ({response.status_code}): {_response_error(response)}"
        )

    try:
        data = response.json()
    except ValueError as exc:
        raise RecallAPIError("Recall bot creation returned invalid JSON.") from exc

    bot_id = _extract_bot_id(data)
    if not bot_id:
        raise RecallAPIError("Recall bot creation succeeded but did not return a bot id.")

    session = get_live_call_repository().link_provider_meeting(
        ctx,
        call_id,
        bot_id,
        provider="recall",
    )

    return {
        "ok": True,
        "callId": call_id,
        "botId": bot_id,
        "status": data.get("status"),
        "webhookUrl": webhook_url,
        "session": session,
    }


def poll_recall_transcript(bot_id: str) -> list[Dict[str, Any]]:
    """Fetch transcript directly from Recall API (polling fallback when webhooks fail)."""
    settings = get_settings()
    if not settings.recall_api_key:
        return []
    base_url = _recall_base_url(settings.recall_region)
    try:
        response = httpx.get(
            f"{base_url}/api/v1/bot/{bot_id}/transcript/",
            headers={
                "Authorization": _authorization_header(settings.recall_api_key),
                "accept": "application/json",
            },
            timeout=10,
        )
    except httpx.HTTPError:
        return []
    if response.status_code >= 400:
        return []
    try:
        return response.json() if isinstance(response.json(), list) else []
    except ValueError:
        return []


def _missing_settings(values: Dict[str, str]) -> Iterable[str]:
    return [name for name, value in values.items() if not str(value or "").strip()]


def _recall_base_url(region: str) -> str:
    region = region.strip().rstrip("/")
    if region.startswith("http://") or region.startswith("https://"):
        return region
    return f"https://{region}.recall.ai"


def _authorization_header(api_key: str) -> str:
    api_key = api_key.strip()
    if api_key.lower().startswith("token "):
        return api_key
    return f"Token {api_key}"


def _webhook_url(public_api_base_url: str, ctx: TenantContext, call_id: str) -> str:
    base = public_api_base_url.strip().rstrip("/")
    query = urlencode(
        {
            "call_id": call_id,
            "tenant_id": ctx.tenant_id,
            "user_id": ctx.user_id,
        }
    )
    return f"{base}/api/v1/webhooks/recall/transcript?{query}"


def _create_bot_payload(
    bot_name: str,
    meeting_url: str,
    webhook_url: str,
    ctx: TenantContext,
    call_id: str,
) -> Dict[str, Any]:
    return {
        "meeting_url": meeting_url,
        "bot_name": (bot_name or "DC Copilot Live Agent")[:100],
        "recording_config": {
            "transcript": {
                "provider": {
                    "recallai_streaming": {
                        "mode": "prioritize_low_latency",
                        "language_code": "en",
                    }
                },
                "diarization": {
                    "use_separate_streams_when_available": True,
                },
            },
            "realtime_endpoints": [
                {
                    "type": "webhook",
                    "url": webhook_url,
                    "events": ["transcript.data"],
                }
            ],
        },
        "metadata": {
            "call_id": call_id,
            "tenant_id": ctx.tenant_id,
            "user_id": ctx.user_id,
        },
    }


def _extract_bot_id(data: Dict[str, Any]) -> Optional[str]:
    direct = data.get("id") or data.get("bot_id")
    if direct:
        return str(direct)
    nested = data.get("bot")
    if isinstance(nested, dict) and nested.get("id"):
        return str(nested["id"])
    return None


def _response_error(response: httpx.Response) -> str:
    try:
        data = response.json()
    except ValueError:
        return response.text[:500] or "No response body"
    if isinstance(data, dict):
        detail = data.get("detail") or data.get("error") or data.get("message")
        if detail:
            return str(detail)
    return str(data)[:500]
