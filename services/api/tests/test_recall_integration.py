from __future__ import annotations

import base64
import hashlib
import hmac
from typing import Any, Dict

import pytest

from dc_core.tenancy import TenantContext

from app.config import get_settings
from app.services.transcript_provider.recall_client import (
    RecallConfigurationError,
    create_recall_live_bot,
    poll_recall_transcript,
)
from app.services.transcript_provider.recall_webhook import (
    parse_recall_payload,
    segment_to_event_dict,
    verify_recall_signature,
)


@pytest.fixture(autouse=True)
def clear_settings_cache():
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


def test_parse_recall_transcript_data_payload():
    body = {
        "event": "transcript.data",
        "data": {
            "data": {
                "words": [
                    {"text": "We", "start_timestamp": {"relative": 12.5}},
                    {"text": "need"},
                    {"text": "pricing"},
                ],
                "participant": {"id": 42, "name": "Sam Buyer", "is_host": False},
            },
            "bot": {
                "id": "bot_123",
                "metadata": {"call_id": "call-abc", "tenant_id": "tenant-1"},
            },
            "recording": {"id": "recording_123"},
        },
    }

    parsed = parse_recall_payload(body)

    assert parsed is not None
    assert parsed["kind"] == "segment"
    assert parsed["text"] == "We need pricing"
    assert parsed["speaker_id"] == "42"
    assert parsed["speaker_name"] == "Sam Buyer"
    assert parsed["speaker_role"] == "customer"
    assert parsed["offset_seconds"] == 12.5
    assert parsed["provider_meeting_id"] == "bot_123"
    assert parsed["call_id"] == "call-abc"

    event = segment_to_event_dict(parsed, "call-abc")
    assert event["id"] == event["provider_event_id"]
    assert event["speaker_id"] == "42"
    assert event["speaker_name"] == "Sam Buyer"


def test_verify_recall_webhook_signature(monkeypatch):
    key = b"recall-secret"
    monkeypatch.setenv("RECALL_WEBHOOK_SECRET", f"whsec_{base64.b64encode(key).decode('utf-8')}")
    get_settings.cache_clear()
    raw = b'{"event":"transcript.data"}'
    msg_id = "msg_123"
    timestamp = "1731705121"
    signed = f"{msg_id}.{timestamp}.{raw.decode('utf-8')}".encode("utf-8")
    signature = base64.b64encode(hmac.new(key, signed, hashlib.sha256).digest()).decode("utf-8")

    assert verify_recall_signature(
        raw,
        None,
        {
            "webhook-id": msg_id,
            "webhook-timestamp": timestamp,
            "webhook-signature": f"v1,{signature}",
        },
    )
    assert not verify_recall_signature(
        raw,
        None,
        {
            "webhook-id": msg_id,
            "webhook-timestamp": timestamp,
            "webhook-signature": "v1,invalid",
        },
    )


def test_create_recall_live_bot_posts_create_bot_payload(monkeypatch):
    monkeypatch.setenv("RECALL_API_KEY", "recall-key")
    monkeypatch.setenv("RECALL_REGION", "us-east-1")
    monkeypatch.setenv("RECALL_BOT_NAME", "Deal Copilot")
    monkeypatch.setenv("PUBLIC_API_BASE_URL", "https://api.example.com")
    monkeypatch.setenv("SUPABASE_URL", "")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "")
    get_settings.cache_clear()
    captured: Dict[str, Any] = {}

    class FakeResponse:
        status_code = 201

        def json(self) -> Dict[str, str]:
            return {"id": "bot_123", "status": "joining"}

    class FakeHealthResponse:
        status_code = 200

    def fake_post(url: str, **kwargs: Any) -> FakeResponse:
        captured["url"] = url
        captured.update(kwargs)
        return FakeResponse()

    def fake_get(url: str, **kwargs: Any) -> FakeHealthResponse:
        captured["health_url"] = url
        captured["health_kwargs"] = kwargs
        return FakeHealthResponse()

    monkeypatch.setattr("app.services.transcript_provider.recall_client.httpx.get", fake_get)
    monkeypatch.setattr("app.services.transcript_provider.recall_client.httpx.post", fake_post)

    out = create_recall_live_bot(
        TenantContext(tenant_id="tenant-1", user_id="user-1"),
        "call-abc",
        "https://meet.google.com/abc-defg-hij",
    )

    assert out["botId"] == "bot_123"
    assert captured["health_url"] == "https://api.example.com/health"
    assert captured["url"] == "https://us-east-1.recall.ai/api/v1/bot/"
    assert captured["headers"]["Authorization"] == "Token recall-key"
    payload = captured["json"]
    assert payload["bot_name"] == "Deal Copilot"
    assert payload["recording_config"]["transcript"]["provider"]["recallai_streaming"]["mode"] == "prioritize_low_latency"
    endpoint = payload["recording_config"]["realtime_endpoints"][0]
    assert endpoint["type"] == "webhook"
    assert endpoint["events"] == ["transcript.data"]
    assert endpoint["url"].startswith("https://api.example.com/api/v1/webhooks/recall/transcript?")
    assert "call_id=call-abc" in endpoint["url"]


def test_create_recall_live_bot_normalizes_public_webhook_base_url(monkeypatch):
    monkeypatch.setenv("RECALL_API_KEY", "recall-key")
    monkeypatch.setenv("RECALL_REGION", "us-east-1")
    monkeypatch.setenv("PUBLIC_API_BASE_URL", "https://api.example.com/")
    monkeypatch.setenv("SUPABASE_URL", "")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "")
    get_settings.cache_clear()
    captured: Dict[str, Any] = {}

    class FakeResponse:
        status_code = 201

        def json(self) -> Dict[str, str]:
            return {"id": "bot_123", "status": "joining"}

    class FakeHealthResponse:
        status_code = 200

    def fake_post(url: str, **kwargs: Any) -> FakeResponse:
        captured["url"] = url
        captured.update(kwargs)
        return FakeResponse()

    def fake_get(url: str, **kwargs: Any) -> FakeHealthResponse:
        captured["health_url"] = url
        captured["health_kwargs"] = kwargs
        return FakeHealthResponse()

    monkeypatch.setattr("app.services.transcript_provider.recall_client.httpx.get", fake_get)
    monkeypatch.setattr("app.services.transcript_provider.recall_client.httpx.post", fake_post)

    create_recall_live_bot(
        TenantContext(tenant_id="tenant-1", user_id="user-1"),
        "call-abc",
        "https://meet.google.com/abc-defg-hij",
    )

    endpoint = captured["json"]["recording_config"]["realtime_endpoints"][0]
    assert captured["health_url"] == "https://api.example.com/health"
    assert endpoint["url"].startswith("https://api.example.com/api/v1/webhooks/recall/transcript?")


def test_create_recall_live_bot_rejects_public_webhook_base_url_without_host(monkeypatch):
    monkeypatch.setenv("RECALL_API_KEY", "recall-key")
    monkeypatch.setenv("RECALL_REGION", "us-east-1")
    monkeypatch.setenv("PUBLIC_API_BASE_URL", "https://")
    monkeypatch.setenv("SUPABASE_URL", "")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "")
    get_settings.cache_clear()
    called_health = False

    def fake_get(*_args: Any, **_kwargs: Any) -> None:
        nonlocal called_health
        called_health = True

    monkeypatch.setattr("app.services.transcript_provider.recall_client.httpx.get", fake_get)

    with pytest.raises(RecallConfigurationError, match="public HTTPS URL with a host"):
        create_recall_live_bot(
            TenantContext(tenant_id="tenant-1", user_id="user-1"),
            "call-abc",
            "https://meet.google.com/abc-defg-hij",
        )
    assert called_health is False


def test_create_recall_live_bot_rejects_unreachable_webhook_url(monkeypatch):
    monkeypatch.setenv("RECALL_API_KEY", "recall-key")
    monkeypatch.setenv("RECALL_REGION", "us-east-1")
    monkeypatch.setenv("PUBLIC_API_BASE_URL", "https://dead-tunnel.example.com")
    monkeypatch.setenv("SUPABASE_URL", "")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "")
    get_settings.cache_clear()

    class FakeHealthResponse:
        status_code = 503

    monkeypatch.setattr(
        "app.services.transcript_provider.recall_client.httpx.get",
        lambda *_args, **_kwargs: FakeHealthResponse(),
    )

    with pytest.raises(RecallConfigurationError, match="PUBLIC_API_BASE_URL is not reachable"):
        create_recall_live_bot(
            TenantContext(tenant_id="tenant-1", user_id="user-1"),
            "call-abc",
            "https://meet.google.com/abc-defg-hij",
        )


def test_poll_recall_transcript_downloads_completed_recording_transcript(monkeypatch):
    monkeypatch.setenv("RECALL_API_KEY", "recall-key")
    monkeypatch.setenv("RECALL_REGION", "us-east-1")
    get_settings.cache_clear()

    download_url = "https://us-east-1.recall.ai/api/v1/download/transcript/?id=transcript-1"
    calls: list[str] = []

    class FakeResponse:
        def __init__(self, status_code: int, payload: Any) -> None:
            self.status_code = status_code
            self._payload = payload

        def json(self) -> Any:
            return self._payload

    def fake_get(url: str, **_kwargs: Any) -> FakeResponse:
        calls.append(url)
        if url.endswith("/api/v1/bot/bot_123/"):
            return FakeResponse(
                200,
                {
                    "recordings": [
                        {
                            "media_shortcuts": {
                                "transcript": {
                                    "status": {"code": "done"},
                                    "data": {"download_url": download_url},
                                }
                            }
                        }
                    ]
                },
            )
        if url == download_url:
            return FakeResponse(
                200,
                [
                    {
                        "participant": {"id": 42, "name": "Sam Buyer", "is_host": False},
                        "words": [
                            {"text": "Need", "start_timestamp": {"relative": 8.2}},
                            {"text": "pricing"},
                        ],
                    }
                ],
            )
        return FakeResponse(404, {})

    monkeypatch.setattr("app.services.transcript_provider.recall_client.httpx.get", fake_get)

    segments = poll_recall_transcript("bot_123")

    assert calls == ["https://us-east-1.recall.ai/api/v1/bot/bot_123/", download_url]
    assert segments[0]["participant"]["name"] == "Sam Buyer"
    assert segments[0]["words"][0]["text"] == "Need"
