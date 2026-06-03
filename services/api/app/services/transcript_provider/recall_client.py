from __future__ import annotations

from typing import Any, Dict, Iterable, Optional
from urllib.parse import urlencode, urlparse

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
    public_base_url = _validate_public_webhook_base_url(settings.public_api_base_url)
    webhook_url = _webhook_url(public_base_url, ctx, call_id)
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
    """Fetch completed transcript segments from Recall.

    Real-time transcript is delivered through Recall realtime endpoints while
    the meeting is live. Once the recording transcript artifact is done, Recall
    exposes the final transcript via `recordings[].media_shortcuts.transcript`.
    """
    settings = get_settings()
    if not settings.recall_api_key:
        return []
    base_url = _recall_base_url(settings.recall_region)
    try:
        response = httpx.get(
            f"{base_url}/api/v1/bot/{bot_id}/",
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
        data = response.json()
    except ValueError:
        return []

    # Kept for compatibility with older Recall response shapes.
    transcript = data.get("transcript")
    if isinstance(transcript, list):
        return transcript
    downloaded = _download_recording_transcript(data, settings.recall_api_key)
    if downloaded:
        return downloaded
    return []


def _missing_settings(values: Dict[str, str]) -> Iterable[str]:
    return [name for name, value in values.items() if not str(value or "").strip()]


def _recall_base_url(region: str) -> str:
    region = region.strip().rstrip("/")
    if region.startswith("http://") or region.startswith("https://"):
        return region
    return f"https://{region}.recall.ai"


def _normalize_public_webhook_base_url(public_api_base_url: str) -> str:
    raw = str(public_api_base_url or "").strip()
    parsed = urlparse(raw)
    if parsed.scheme != "https" or not parsed.netloc:
        raise RecallConfigurationError(
            "PUBLIC_API_BASE_URL must be a public HTTPS URL with a host "
            "(for example, https://your-tunnel.ngrok-free.app). "
            "This is the API webhook tunnel URL, not the meeting link."
        )
    path = parsed.path.rstrip("/")
    return f"https://{parsed.netloc}{path}".rstrip("/")


def _validate_public_webhook_base_url(public_api_base_url: str) -> str:
    base = _normalize_public_webhook_base_url(public_api_base_url)

    health_url = f"{base}/health"
    try:
        response = httpx.get(health_url, timeout=5, follow_redirects=True)
    except httpx.HTTPError as exc:
        raise RecallConfigurationError(
            f"PUBLIC_API_BASE_URL is not reachable at {health_url}. "
            "Start or update the API tunnel before launching a Recall bot."
        ) from exc
    if response.status_code >= 400:
        raise RecallConfigurationError(
            f"PUBLIC_API_BASE_URL is not reachable at {health_url} "
            f"(returned {response.status_code}). Start or update the API tunnel before launching a Recall bot."
        )
    return base


def _authorization_header(api_key: str) -> str:
    api_key = api_key.strip()
    if api_key.lower().startswith("token "):
        return api_key
    return f"Token {api_key}"


def _download_recording_transcript(bot: Dict[str, Any], api_key: str) -> list[Dict[str, Any]]:
    for recording in bot.get("recordings") or []:
        if not isinstance(recording, dict):
            continue
        shortcut = _dict_or_empty(recording.get("media_shortcuts")).get("transcript")
        transcript = _dict_or_empty(shortcut)
        data = _dict_or_empty(transcript.get("data"))
        download_url = data.get("download_url")
        if not download_url:
            continue
        segments = _fetch_transcript_download(str(download_url), api_key)
        if segments:
            return segments
    return []


def _fetch_transcript_download(download_url: str, api_key: str) -> list[Dict[str, Any]]:
    headers = {"accept": "application/json"}
    try:
        response = httpx.get(download_url, headers=headers, timeout=20, follow_redirects=True)
        if response.status_code in (401, 403) and "recall.ai" in urlparse(download_url).netloc:
            response = httpx.get(
                download_url,
                headers={**headers, "Authorization": _authorization_header(api_key)},
                timeout=20,
                follow_redirects=True,
            )
    except httpx.HTTPError:
        return []
    if response.status_code >= 400:
        return []
    try:
        payload = response.json()
    except ValueError:
        return []
    return _transcript_segments_from_download(payload)


def _transcript_segments_from_download(payload: Any) -> list[Dict[str, Any]]:
    if isinstance(payload, list):
        return [item for item in payload if isinstance(item, dict)]
    if not isinstance(payload, dict):
        return []
    for key in ("segments", "transcript", "utterances", "data"):
        value = payload.get(key)
        if isinstance(value, list):
            return [item for item in value if isinstance(item, dict)]
    return []


def _dict_or_empty(value: Any) -> Dict[str, Any]:
    return value if isinstance(value, dict) else {}


def _webhook_url(public_api_base_url: str, ctx: TenantContext, call_id: str) -> str:
    base = _normalize_public_webhook_base_url(public_api_base_url)
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
