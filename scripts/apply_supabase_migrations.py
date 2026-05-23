#!/usr/bin/env python3
"""Apply infra/supabase migrations to a remote Supabase Postgres database."""

from __future__ import annotations

import os
import sys
from pathlib import Path
from urllib.parse import quote_plus, urlparse

REPO_ROOT = Path(__file__).resolve().parents[1]
ENV_PATH = REPO_ROOT / "services" / "api" / ".env"
SQL_PATH = REPO_ROOT / "infra" / "supabase" / "apply_all_migrations.sql"


def load_dotenv(path: Path) -> None:
    if not path.is_file():
        return
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        os.environ.setdefault(key.strip(), value.strip())


def project_ref_from_url(url: str) -> str:
    host = urlparse(url).hostname or ""
    return host.replace(".supabase.co", "")


def connection_candidates(ref: str, password: str) -> list[str]:
    encoded = quote_plus(password)
    pools = [
        f"postgresql://postgres.{ref}:{encoded}@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres",
        f"postgresql://postgres.{ref}:{encoded}@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres",
        f"postgresql://postgres.{ref}:{encoded}@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres",
        f"postgresql://postgres.{ref}:{encoded}@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres",
        f"postgresql://postgres:{encoded}@db.{ref}.supabase.co:5432/postgres",
    ]
    if os.environ.get("DATABASE_URL"):
        pools.insert(0, os.environ["DATABASE_URL"])
    return pools


def main() -> int:
    load_dotenv(ENV_PATH)
    url = os.environ.get("SUPABASE_URL", "")
    password = os.environ.get("SUPABASE_DB_PASSWORD") or os.environ.get("POSTGRES_PASSWORD", "")
    if not url:
        print("Missing SUPABASE_URL in services/api/.env", file=sys.stderr)
        return 1
    if not password and not os.environ.get("DATABASE_URL"):
        print(
            "Missing SUPABASE_DB_PASSWORD in services/api/.env\n"
            "Get it from Supabase → Settings → Database → Database password\n"
            "Add: SUPABASE_DB_PASSWORD=your_password",
            file=sys.stderr,
        )
        return 1
    if not SQL_PATH.is_file():
        print(f"SQL file not found: {SQL_PATH}", file=sys.stderr)
        return 1

    try:
        import psycopg2
    except ImportError:
        print("Install psycopg2-binary: pip install psycopg2-binary", file=sys.stderr)
        return 1

    ref = project_ref_from_url(url)
    sql = SQL_PATH.read_text()
    last_err: Exception | None = None

    for dsn in connection_candidates(ref, password):
        try:
            conn = psycopg2.connect(dsn, connect_timeout=15)
            conn.autocommit = True
            with conn.cursor() as cur:
                cur.execute(sql)
            conn.close()
            print("Migrations applied successfully.")
            return 0
        except Exception as exc:
            last_err = exc
            print(f"Connection failed ({urlparse(dsn).hostname}): {exc}", file=sys.stderr)

    print(f"All connection attempts failed. Last error: {last_err}", file=sys.stderr)
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
