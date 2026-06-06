#!/usr/bin/env python3
"""Re-run template vision ingest on existing uploaded templates.

Use the API virtualenv so Anthropic vision calls work:

  services/api/.venv/bin/python3 scripts/reprocess_templates.py
"""

from __future__ import annotations

import argparse
import logging
import os
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional

REPO_ROOT = Path(__file__).resolve().parents[1]
ENV_PATH = REPO_ROOT / "services" / "api" / ".env"

sys.path.insert(0, str(REPO_ROOT / "python-packages"))
sys.path.insert(0, str(REPO_ROOT / "services" / "api"))


def load_dotenv(path: Path) -> None:
    if not path.is_file():
        return
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        os.environ.setdefault(key.strip(), value.strip())


def _ctx_for_row(row: Dict[str, Any]):
    from dc_core.tenancy import TenantContext

    tenant_id = str(row.get("tenant_id") or "dc-copilot-shared")
    created_by = str(row.get("created_by") or "template-reprocess")
    return TenantContext(tenant_id=tenant_id, user_id=created_by, clerk_org_id=tenant_id)


def _list_template_rows(*, template_id: Optional[str] = None) -> List[Dict[str, Any]]:
    from app.config import get_settings
    from app.domain.content_studio_repository import get_content_studio_repository
    from app.domain.memory_store import get_memory_store

    settings = get_settings()
    rows: List[Dict[str, Any]] = []

    if settings.supabase_configured:
        try:
            from app.deps import get_supabase

            q = get_supabase().table("content_templates").select("*").order("created_at", desc=True)
            if template_id:
                q = q.eq("id", template_id)
            rows = q.execute().data or []
        except Exception as exc:
            logging.warning("Supabase template query failed: %s", exc)

    if not rows:
        repo = get_content_studio_repository()
        store = get_memory_store()
        for clerk_key, template in repo._all_memory_templates():  # noqa: SLF001
            if template_id and template.get("id") != template_id:
                continue
            rows.append(
                {
                    "id": template.get("id"),
                    "tenant_id": clerk_key,
                    "name": template.get("name"),
                    "status": template.get("status"),
                    "source_storage_path": template.get("sourceStoragePath") or template.get("source_storage_path"),
                    "source_file_name": template.get("sourceFileName") or template.get("source_file_name"),
                    "created_by": "template-reprocess",
                }
            )
        if not rows and not settings.supabase_configured:
            logging.info("Memory store templates: %s", len(store.content_templates))

    return [row for row in rows if row.get("source_storage_path")]


def reprocess_templates(*, template_id: Optional[str] = None, dry_run: bool = False) -> Dict[str, Any]:
    from app.domain.content_studio_repository import get_content_studio_repository
    from app.services.template_ingest_service import process_template_ingest

    rows = _list_template_rows(template_id=template_id)
    if not rows:
        return {"processed": 0, "failed": {}, "templates": []}

    repo = get_content_studio_repository()
    processed: List[str] = []
    failed: Dict[str, str] = {}

    for row in rows:
        tid = str(row["id"])
        storage_path = str(row["source_storage_path"])
        name = str(row.get("name") or tid)
        ctx = _ctx_for_row(row)

        logging.info("Reprocessing template %s (%s)", name, tid)
        if dry_run:
            processed.append(tid)
            continue

        repo.update_template_progress(
            ctx,
            tid,
            progress=5,
            stage="queued",
            message="Queued for HTML/CSS regeneration",
        )
        try:
            result = process_template_ingest(ctx, tid, storage_path)
            processed.append(tid)
            logging.info(
                "Done %s — pages=%s status=%s html_len=%s",
                name,
                result.get("pageCount") or result.get("page_count"),
                result.get("status"),
                len(str(result.get("html") or "")),
            )
        except Exception as exc:
            failed[tid] = str(exc)[:500]
            logging.exception("Failed to reprocess %s (%s)", name, tid)

    return {"processed": len(processed), "failed": failed, "templates": processed}


def main() -> int:
    parser = argparse.ArgumentParser(description="Re-run template vision ingest for existing templates")
    parser.add_argument("--template-id", help="Reprocess one template by id")
    parser.add_argument("--dry-run", action="store_true", help="List templates only; do not regenerate")
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    load_dotenv(ENV_PATH)

    try:
        import anthropic  # noqa: F401
    except ImportError:
        print(
            "anthropic package not found. Run with the API venv:\n"
            "  services/api/.venv/bin/python3 scripts/reprocess_templates.py",
            file=sys.stderr,
        )
        return 1

    result = reprocess_templates(template_id=args.template_id, dry_run=args.dry_run)
    print(f"Processed: {result['processed']}")
    if result["templates"]:
        print("Templates:")
        for tid in result["templates"]:
            print(f"  {tid}")
    if result["failed"]:
        print("Failed:")
        for tid, err in result["failed"].items():
            print(f"  {tid}: {err}")
        return 1
    if result["processed"] == 0:
        print("No templates with source files found.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
