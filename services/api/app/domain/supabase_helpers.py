from __future__ import annotations

import concurrent.futures
from typing import Callable, Optional, TypeVar

T = TypeVar("T")

DEFAULT_TIMEOUT_SEC = 4.0


def run_with_timeout(
    fn: Callable[[], T],
    *,
    timeout_sec: float = DEFAULT_TIMEOUT_SEC,
    default: Optional[T] = None,
) -> Optional[T]:
    """Run a blocking Supabase call with a timeout so API routes do not hang."""
    with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
        fut = pool.submit(fn)
        try:
            return fut.result(timeout=timeout_sec)
        except Exception:
            return default
