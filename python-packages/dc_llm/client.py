from __future__ import annotations

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


class LlmClient:
    """Anthropic wrapper with deterministic fallback when API key absent."""

    def __init__(self, api_key: Optional[str] = None) -> None:
        self.api_key = api_key or os.getenv("ANTHROPIC_API_KEY", "")

    def complete(
        self,
        system: str,
        user: str,
        model: str = "claude-3-5-sonnet-20241022",
        max_tokens: int = 2048,
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

        try:
            import anthropic  # type: ignore

            client = anthropic.Anthropic(api_key=self.api_key)
            msg = client.messages.create(
                model=model,
                max_tokens=max_tokens,
                system=system,
                messages=[{"role": "user", "content": user}],
            )
            text = msg.content[0].text if msg.content else ""
            usage = getattr(msg, "usage", None)
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
            return LlmCompletion(
                text=_fallback_complete(system, user),
                model="fallback-error",
                tokens_in=0,
                tokens_out=0,
                cost_usd=0.0,
                trace_id=trace_id,
            )


def _fallback_complete(system: str, user: str) -> str:
    return (
        "Synthesized brief (offline mode): prioritize discovery on stated needs, "
        "confirm BANT, and surface relevant case studies from the knowledge base. "
        f"Context length: {len(user)} chars."
    )


def _estimate_cost(model: str, tokens_in: int, tokens_out: int) -> float:
    rate_in = 3.0 if "opus" in model else 1.0 if "sonnet" in model else 0.25
    rate_out = 15.0 if "opus" in model else 5.0 if "sonnet" in model else 1.25
    return (tokens_in * rate_in + tokens_out * rate_out) / 1_000_000
