from __future__ import annotations

import base64
import os
import uuid
from dataclasses import dataclass
from typing import Any, Dict, List, Optional

_LEGACY_MODEL_MAP = {
    "claude-3-haiku-20240307": "claude-haiku-4-5-20251001",
    "claude-sonnet-4-20250514": "claude-sonnet-4-6",
}

DEFAULT_CHAT_MODEL = "gpt-5.4-mini"
DEFAULT_CHAT_FALLBACK_MODEL = "gpt-5.4-mini"


@dataclass
class LlmCompletion:
    text: str
    model: str
    tokens_in: int
    tokens_out: int
    cost_usd: float
    trace_id: str


def _is_openai_model(model: str) -> bool:
    lower = model.lower()
    return lower.startswith("gpt-") or lower.startswith("o1") or lower.startswith("o3")


def openai_completion_token_kwargs(model: str, max_tokens: int) -> Dict[str, int]:
    """Newer OpenAI models use max_completion_tokens instead of max_tokens."""
    lower = model.lower()
    if lower.startswith("gpt-5") or lower.startswith("o1") or lower.startswith("o3"):
        return {"max_completion_tokens": max_tokens}
    return {"max_tokens": max_tokens}


def resolve_llm_model(model: str) -> str:
    """Map legacy agent model ids to current provider model ids."""
    if _is_openai_model(model):
        return model
    return _LEGACY_MODEL_MAP.get(model, model)


def resolve_openai_model(model: str) -> str:
    """Resolve a model id for OpenAI chat/completions."""
    if _is_openai_model(model):
        return model
    return DEFAULT_CHAT_MODEL


class LlmClient:
    """Anthropic + OpenAI wrapper with deterministic fallback when API key absent."""

    def __init__(
        self,
        api_key: Optional[str] = None,
        *,
        openai_api_key: Optional[str] = None,
    ) -> None:
        self.api_key = api_key or os.getenv("ANTHROPIC_API_KEY", "")
        self.openai_api_key = openai_api_key or os.getenv("OPENAI_API_KEY", "")

    def complete(
        self,
        system: str,
        user: str,
        model: str = DEFAULT_CHAT_MODEL,
        max_tokens: int = 2048,
        fallback_model: Optional[str] = None,
    ) -> LlmCompletion:
        trace_id = str(uuid.uuid4())
        resolved = resolve_llm_model(model)
        if _is_openai_model(resolved):
            if not self.openai_api_key:
                return LlmCompletion(
                    text=_fallback_complete(system, user),
                    model="fallback-local",
                    tokens_in=len(user) // 4,
                    tokens_out=256,
                    cost_usd=0.0,
                    trace_id=trace_id,
                )
            result = self._call_openai(
                system=system,
                user=user,
                model=resolved,
                max_tokens=max_tokens,
                trace_id=trace_id,
            )
            if result is not None:
                return result
            if fallback_model:
                fb = resolve_llm_model(fallback_model)
                if fb != resolved:
                    result = self._call_openai(
                        system=system,
                        user=user,
                        model=fb,
                        max_tokens=max_tokens,
                        trace_id=trace_id,
                    )
                    if result is not None:
                        return result
            return LlmCompletion(
                text=_fallback_complete(system, user),
                model="fallback-error",
                tokens_in=0,
                tokens_out=0,
                cost_usd=0.0,
                trace_id=trace_id,
            )

        if not self.api_key:
            return LlmCompletion(
                text=_fallback_complete(system, user),
                model="fallback-local",
                tokens_in=len(user) // 4,
                tokens_out=256,
                cost_usd=0.0,
                trace_id=trace_id,
            )

        result = self._call_anthropic(
            system=system,
            user=user,
            model=resolved,
            max_tokens=max_tokens,
            trace_id=trace_id,
        )
        if result is not None:
            return result

        if fallback_model and resolve_llm_model(fallback_model) != resolved:
            fb = resolve_llm_model(fallback_model)
            if _is_openai_model(fb):
                result = self._call_openai(
                    system=system,
                    user=user,
                    model=fb,
                    max_tokens=max_tokens,
                    trace_id=trace_id,
                )
            else:
                result = self._call_anthropic(
                    system=system,
                    user=user,
                    model=fb,
                    max_tokens=max_tokens,
                    trace_id=trace_id,
                )
            if result is not None:
                return result

        return LlmCompletion(
            text=_fallback_complete(system, user),
            model="fallback-error",
            tokens_in=0,
            tokens_out=0,
            cost_usd=0.0,
            trace_id=trace_id,
        )

    def _call_openai(
        self,
        *,
        system: str,
        user: str,
        model: str,
        max_tokens: int,
        trace_id: str,
    ) -> Optional[LlmCompletion]:
        try:
            from openai import OpenAI

            client = OpenAI(api_key=self.openai_api_key, timeout=120.0)
            response = client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": system},
                    {"role": "user", "content": user},
                ],
                **openai_completion_token_kwargs(model, max_tokens),
            )
            choice = response.choices[0]
            text = choice.message.content or ""
            usage = getattr(response, "usage", None)
            tokens_in = getattr(usage, "prompt_tokens", 0) if usage else 0
            tokens_out = getattr(usage, "completion_tokens", 0) if usage else 0
            return LlmCompletion(
                text=text,
                model=model,
                tokens_in=tokens_in,
                tokens_out=tokens_out,
                cost_usd=_estimate_openai_cost(model, tokens_in, tokens_out),
                trace_id=trace_id,
            )
        except Exception:
            return None

    def _call_anthropic(
        self,
        *,
        system: str,
        user: str,
        model: str,
        max_tokens: int,
        trace_id: str,
    ) -> Optional[LlmCompletion]:
        try:
            from anthropic import Anthropic

            client = Anthropic(api_key=self.api_key, timeout=120.0)
            response = client.messages.create(
                model=model,
                max_tokens=max_tokens,
                system=system,
                messages=[{"role": "user", "content": user}],
            )
            text = "".join(
                block.text for block in response.content if getattr(block, "type", None) == "text"
            )
            usage = getattr(response, "usage", None)
            tokens_in = getattr(usage, "input_tokens", 0) if usage else 0
            tokens_out = getattr(usage, "output_tokens", 0) if usage else 0
            return LlmCompletion(
                text=text,
                model=model,
                tokens_in=tokens_in,
                tokens_out=tokens_out,
                cost_usd=_estimate_cost(model, tokens_in, tokens_out),
                trace_id=trace_id,
            )
        except Exception:
            return None

    def complete_vision(
        self,
        system: str,
        image_png_bytes: bytes,
        user_text: str = "Convert this slide to HTML/CSS.",
        model: str = "claude-sonnet-4-6",
        max_tokens: int = 4096,
        fallback_model: Optional[str] = None,
    ) -> LlmCompletion:
        trace_id = str(uuid.uuid4())
        b64 = base64.standard_b64encode(image_png_bytes).decode("ascii")
        if not self.api_key:
            return LlmCompletion(
                text='<section class="slide" data-slide="1"><style scoped>:root{--brand:#1a1a2e;--accent:#e94560;--bg:#fff;--text:#333}</style><div class="placeholder" data-role="hero"></div></section>',
                model="fallback-local",
                tokens_in=100,
                tokens_out=200,
                cost_usd=0.0,
                trace_id=trace_id,
            )

        resolved = resolve_llm_model(model)
        if "haiku" in resolved.lower():
            resolved = "claude-sonnet-4-6"
        result = self._call_anthropic_vision(
            system=system,
            b64=b64,
            user_text=user_text,
            model=resolved,
            max_tokens=max_tokens,
            trace_id=trace_id,
        )
        if result is not None:
            return result

        if fallback_model:
            fb = resolve_llm_model(fallback_model)
            if "haiku" in fb.lower():
                fb = "claude-sonnet-4-6"
            if fb != resolved:
                result = self._call_anthropic_vision(
                    system=system,
                    b64=b64,
                    user_text=user_text,
                    model=fb,
                    max_tokens=max_tokens,
                    trace_id=trace_id,
                )
                if result is not None:
                    return result

        return LlmCompletion(
            text='<section class="slide" data-slide="1"><p>Template slide (vision fallback)</p></section>',
            model="fallback-error",
            tokens_in=0,
            tokens_out=0,
            cost_usd=0.0,
            trace_id=trace_id,
        )

    def _call_anthropic_vision(
        self,
        *,
        system: str,
        b64: str,
        user_text: str,
        model: str,
        max_tokens: int,
        trace_id: str,
    ) -> Optional[LlmCompletion]:
        try:
            from anthropic import Anthropic

            client = Anthropic(api_key=self.api_key, timeout=120.0)
            response = client.messages.create(
                model=model,
                max_tokens=max_tokens,
                system=system,
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "image",
                                "source": {
                                    "type": "base64",
                                    "media_type": "image/png",
                                    "data": b64,
                                },
                            },
                            {"type": "text", "text": user_text},
                        ],
                    }
                ],
            )
            text = "".join(
                block.text for block in response.content if getattr(block, "type", None) == "text"
            )
            usage = getattr(response, "usage", None)
            tokens_in = getattr(usage, "input_tokens", 0) if usage else 0
            tokens_out = getattr(usage, "output_tokens", 0) if usage else 0
            return LlmCompletion(
                text=text,
                model=model,
                tokens_in=tokens_in,
                tokens_out=tokens_out,
                cost_usd=_estimate_cost(model, tokens_in, tokens_out),
                trace_id=trace_id,
            )
        except Exception:
            return None


def anthropic_tools_to_openai(tools: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    return [
        {
            "type": "function",
            "function": {
                "name": tool["name"],
                "description": tool.get("description", ""),
                "parameters": tool.get("input_schema") or {"type": "object", "properties": {}},
            },
        }
        for tool in tools
    ]


def _fallback_complete(system: str, user: str) -> str:
    return (
        "Synthesized brief (offline mode): prioritize discovery on stated needs, "
        "confirm BANT, and surface relevant case studies from the knowledge base. "
        f"Context length: {len(user)} chars."
    )


def _estimate_cost(model: str, tokens_in: int, tokens_out: int) -> float:
    lower = model.lower()
    if "opus" in lower:
        rate_in, rate_out = 15.0, 75.0
    elif "sonnet" in lower:
        rate_in, rate_out = 3.0, 15.0
    else:
        rate_in, rate_out = 0.8, 4.0
    return (tokens_in * rate_in + tokens_out * rate_out) / 1_000_000


def _estimate_openai_cost(model: str, tokens_in: int, tokens_out: int) -> float:
    lower = model.lower()
    if "mini" in lower:
        rate_in, rate_out = 0.15, 0.6
    elif "gpt-5" in lower or "gpt-4" in lower:
        rate_in, rate_out = 2.5, 10.0
    else:
        rate_in, rate_out = 0.5, 1.5
    return (tokens_in * rate_in + tokens_out * rate_out) / 1_000_000
