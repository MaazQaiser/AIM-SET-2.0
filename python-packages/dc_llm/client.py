from __future__ import annotations

import base64
import os
import uuid
from dataclasses import dataclass
from typing import Any, Dict, List, Optional


@dataclass
class LlmCompletion:
    text: str
    model: str
    tokens_in: int
    tokens_out: int
    cost_usd: float
    trace_id: str


def resolve_openai_model(model: str) -> str:
    """Map legacy Claude model ids from agent config to OpenAI models."""
    if model.startswith("gpt-"):
        return model
    lower = model.lower()
    if "haiku" in lower:
        return "gpt-4o-mini"
    if "opus" in lower or "sonnet" in lower:
        return "gpt-4o"
    return "gpt-4o-mini"


class LlmClient:
    """OpenAI wrapper with deterministic fallback when API key absent."""

    def __init__(self, api_key: Optional[str] = None) -> None:
        self.api_key = api_key or os.getenv("OPENAI_API_KEY", "")

    def complete(
        self,
        system: str,
        user: str,
        model: str = "gpt-4o-mini",
        max_tokens: int = 2048,
        fallback_model: Optional[str] = None,
    ) -> LlmCompletion:
        trace_id = str(uuid.uuid4())
        if not self.api_key:
            return LlmCompletion(
                text=_fallback_complete(system, user),
                model="fallback-local",
                tokens_in=len(user) // 4,
                tokens_out=256,
                cost_usd=0.0,
                trace_id=trace_id,
            )

        resolved = resolve_openai_model(model)
        result = self._call_openai(
            system=system,
            user=user,
            model=resolved,
            max_tokens=max_tokens,
            trace_id=trace_id,
        )
        if result is not None:
            return result

        if fallback_model and resolve_openai_model(fallback_model) != resolved:
            result = self._call_openai(
                system=system,
                user=user,
                model=resolve_openai_model(fallback_model),
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

            client = OpenAI(api_key=self.api_key, timeout=120.0)
            response = client.chat.completions.create(
                model=model,
                max_tokens=max_tokens,
                messages=[
                    {"role": "system", "content": system},
                    {"role": "user", "content": user},
                ],
            )
            choice = response.choices[0] if response.choices else None
            text = (choice.message.content or "") if choice and choice.message else ""
            usage = getattr(response, "usage", None)
            tokens_in = getattr(usage, "prompt_tokens", 0) if usage else 0
            tokens_out = getattr(usage, "completion_tokens", 0) if usage else 0
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
        model: str = "gpt-4o",
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

        resolved = resolve_openai_model(model)
        if resolved == "gpt-4o-mini":
            resolved = "gpt-4o"
        result = self._call_openai_vision(
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
            fb = resolve_openai_model(fallback_model)
            if fb == "gpt-4o-mini":
                fb = "gpt-4o"
            if fb != resolved:
                result = self._call_openai_vision(
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

    def _call_openai_vision(
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
            from openai import OpenAI

            client = OpenAI(api_key=self.api_key, timeout=120.0)
            response = client.chat.completions.create(
                model=model,
                max_tokens=max_tokens,
                messages=[
                    {"role": "system", "content": system},
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "image_url",
                                "image_url": {"url": f"data:image/png;base64,{b64}"},
                            },
                            {"type": "text", "text": user_text},
                        ],
                    },
                ],
            )
            choice = response.choices[0] if response.choices else None
            text = (choice.message.content or "") if choice and choice.message else ""
            usage = getattr(response, "usage", None)
            tokens_in = getattr(usage, "prompt_tokens", 0) if usage else 0
            tokens_out = getattr(usage, "completion_tokens", 0) if usage else 0
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


def _fallback_complete(system: str, user: str) -> str:
    return (
        "Synthesized brief (offline mode): prioritize discovery on stated needs, "
        "confirm BANT, and surface relevant case studies from the knowledge base. "
        f"Context length: {len(user)} chars."
    )


def _estimate_cost(model: str, tokens_in: int, tokens_out: int) -> float:
    lower = model.lower()
    if "gpt-4o" in lower and "mini" not in lower:
        rate_in, rate_out = 2.5, 10.0
    elif "gpt-4" in lower:
        rate_in, rate_out = 10.0, 30.0
    else:
        rate_in, rate_out = 0.15, 0.6
    return (tokens_in * rate_in + tokens_out * rate_out) / 1_000_000
