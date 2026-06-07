from __future__ import annotations

import logging
import os
from dataclasses import dataclass
from typing import List, Optional

logger = logging.getLogger(__name__)


@dataclass
class EmbeddingResult:
    embeddings: List[List[float]]
    model: str
    total_tokens: int


class EmbeddingClient:
    def __init__(
        self,
        api_key: Optional[str] = None,
        model: Optional[str] = None,
        dimensions: Optional[int] = None,
    ) -> None:
        self.api_key = api_key or os.environ.get("OPENAI_API_KEY", "")
        self.model = model or os.environ.get("KB_EMBEDDING_MODEL", "text-embedding-3-small")
        _dim_env = os.environ.get("KB_EMBEDDING_DIMENSIONS")
        self.dimensions = dimensions or (int(_dim_env) if _dim_env else None)

    def embed(self, texts: List[str]) -> EmbeddingResult:
        if not texts:
            return EmbeddingResult(embeddings=[], model=self.model, total_tokens=0)

        if not self.api_key:
            logger.warning(
                "EmbeddingClient: OPENAI_API_KEY is not set — using fake embeddings. "
                "KB search will not work correctly."
            )
            return EmbeddingResult(
                embeddings=[_fake_embedding(t) for t in texts],
                model=f"{self.model}-offline",
                total_tokens=0,
            )

        try:
            from openai import OpenAI

            client = OpenAI(api_key=self.api_key)
            batch_size = 100
            all_embeddings: List[List[float]] = []
            total_tokens = 0

            for i in range(0, len(texts), batch_size):
                batch = texts[i : i + batch_size]
                kwargs = {"input": batch, "model": self.model}
                if self.dimensions:
                    kwargs["dimensions"] = self.dimensions
                response = client.embeddings.create(**kwargs)
                all_embeddings.extend([item.embedding for item in response.data])
                total_tokens += getattr(response.usage, "total_tokens", 0) or 0

            return EmbeddingResult(embeddings=all_embeddings, model=self.model, total_tokens=total_tokens)
        except Exception as exc:
            logger.error(
                "EmbeddingClient: OpenAI API call failed (%s: %s) — using fake embeddings. "
                "Check OPENAI_API_KEY permissions and model access.",
                type(exc).__name__,
                exc,
            )
            return EmbeddingResult(
                embeddings=[_fake_embedding(t) for t in texts],
                model=f"{self.model}-offline",
                total_tokens=0,
            )


def embed_texts(
    texts: List[str],
    api_key: Optional[str] = None,
    model: Optional[str] = None,
    dimensions: Optional[int] = None,
) -> List[List[float]]:
    return EmbeddingClient(api_key=api_key, model=model, dimensions=dimensions).embed(texts).embeddings


def _fake_embedding(text: str, dim: int = 1536) -> List[float]:
    """Deterministic pseudo-embedding for dev without OpenAI."""
    import hashlib
    import math

    seed = hashlib.sha256(text.encode()).digest()
    out = []
    for i in range(dim):
        b = seed[i % len(seed)]
        out.append((b / 255.0) * 2 - 1)
    norm = math.sqrt(sum(x * x for x in out)) or 1.0
    return [x / norm for x in out]
