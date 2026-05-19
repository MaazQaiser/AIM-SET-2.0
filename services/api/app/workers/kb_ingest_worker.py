from __future__ import annotations

import os
import sys
import time
from pathlib import Path

_REPO_ROOT = Path(__file__).resolve().parents[4]
sys.path.insert(0, str(_REPO_ROOT / "python-packages"))
sys.path.insert(0, str(_REPO_ROOT / "services" / "api"))

from dotenv import load_dotenv

load_dotenv(_REPO_ROOT / "services" / "api" / ".env")

from app.config import get_settings
from app.domain.kb_repository import get_kb_repository
from app.services.kb_ingest_service import process_ingest_job


def run_worker(poll_ms: int | None = None) -> None:
    settings = get_settings()
    interval = (poll_ms or settings.kb_worker_poll_interval_ms) / 1000.0
    repo = get_kb_repository()
    worker_id = os.environ.get("KB_WORKER_ID", "worker-1")

    print(f"KB ingest worker started (poll={interval}s, id={worker_id})")
    while True:
        job = repo.claim_job(worker_id)
        if not job:
            time.sleep(interval)
            continue
        print(f"Processing job {job['id']} asset={job['asset_id']}")
        try:
            process_ingest_job(job, repo)
            print(f"Job {job['id']} done")
        except Exception as exc:
            print(f"Job {job['id']} failed: {exc}")
        time.sleep(0.1)


if __name__ == "__main__":
    run_worker()
