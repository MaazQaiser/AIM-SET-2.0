#!/usr/bin/env python3
"""Apply KB preview migration and backfill PDF previews for existing PPTX/PPT assets."""

from __future__ import annotations

import argparse
import logging
import os
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
ENV_PATH = REPO_ROOT / "services" / "api" / ".env"
MIGRATION_PATHS = [
    REPO_ROOT / "infra" / "supabase" / "migrations" / "007_kb_preview.sql",
    REPO_ROOT / "infra" / "supabase" / "migrations" / "008_kb_slide_preview.sql",
]

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


def apply_migration() -> bool:
    missing = [p for p in MIGRATION_PATHS if not p.is_file()]
    if missing:
        print(f"Migration not found: {missing[0]}", file=sys.stderr)
        return False

    url = os.environ.get("SUPABASE_URL", "")
    password = os.environ.get("SUPABASE_DB_PASSWORD") or os.environ.get("POSTGRES_PASSWORD", "")
    if not url or not password:
        print("Skipping migration (SUPABASE_URL or SUPABASE_DB_PASSWORD missing).")
        return True

    try:
        import psycopg2
        from urllib.parse import quote_plus, urlparse
    except ImportError:
        print("Install psycopg2-binary to apply migration: pip install psycopg2-binary", file=sys.stderr)
        return False

    ref = (urlparse(url).hostname or "").replace(".supabase.co", "")
    encoded = quote_plus(password)
    regions = [
        "aws-1-ap-northeast-1",
        "aws-0-ap-northeast-1",
        "aws-0-us-west-1",
        "aws-0-us-east-1",
        "aws-0-eu-central-1",
    ]
    candidates = [f"postgresql://postgres:{encoded}@db.{ref}.supabase.co:5432/postgres"]
    for region in regions:
        candidates.append(
            f"postgresql://postgres.{ref}:{encoded}@{region}.pooler.supabase.com:6543/postgres"
        )
        candidates.append(
            f"postgresql://postgres.{ref}:{encoded}@{region}.pooler.supabase.com:5432/postgres"
        )
    sql = "\n".join(path.read_text() for path in MIGRATION_PATHS)
    last_err: Exception | None = None

    for dsn in candidates:
        try:
            conn = psycopg2.connect(dsn, connect_timeout=15)
            conn.autocommit = True
            with conn.cursor() as cur:
                cur.execute(sql)
            conn.close()
            print("Applied KB preview migrations")
            return True
        except Exception as exc:
            last_err = exc

    print(f"Migration failed: {last_err}", file=sys.stderr)
    return False


def main() -> int:
    parser = argparse.ArgumentParser(description="Backfill KB presentation PDF previews")
    parser.add_argument("--force", action="store_true", help="Regenerate previews even when one exists")
    parser.add_argument("--skip-migration", action="store_true", help="Skip DB migration step")
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    load_dotenv(ENV_PATH)

    if not args.skip_migration:
        if not apply_migration():
            return 1

    from app.services.kb_ingest_service import backfill_presentation_previews

    result = backfill_presentation_previews(force=args.force)
    print(f"Tenant: {result['tenantId']}")
    print(f"Previews generated: {result['processed']}")
    print(f"Skipped: {result['skipped']}")
    if result["failed"]:
        print("Failed:")
        for asset_id, err in result["failed"].items():
            print(f"  {asset_id}: {err}")
        return 1

    if result["assetIds"]:
        print("Updated assets:")
        for asset_id in result["assetIds"]:
            print(f"  {asset_id}")
    else:
        print("No presentation assets needed preview backfill.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
