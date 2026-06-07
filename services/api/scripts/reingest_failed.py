#!/usr/bin/env python3
"""
Reingest all KB assets that are in 'failed' or 'pending' status.
Run from the services/api directory with the project venv:
    .venv/bin/python scripts/reingest_failed.py
"""
from __future__ import annotations

import sys
import os
import logging

# Make sure the app package is importable
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
logger = logging.getLogger("reingest_failed")


def main() -> None:
    from app.config import get_settings
    from app.deps import get_supabase
    from app.domain.kb_repository import get_kb_repository
    from app.domain.kb_tenancy import kb_context_for_user
    from app.services.kb_ingest_service import process_ingest_job

    settings = get_settings()

    if not settings.supabase_configured:
        logger.error("Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env")
        sys.exit(1)

    if not settings.openai_configured:
        logger.warning(
            "OPENAI_API_KEY is not set — embeddings will use fake vectors. "
            "Set the key in .env before reingesting for real semantic search."
        )

    logger.info("Connecting to Supabase: %s", settings.supabase_url)
    sb = get_supabase()

    # Fetch all assets with status 'failed' or 'pending' (never processed)
    rows = (
        sb.table("kb_assets")
        .select("id, tenant_id, status, ingest_error, file_name, title, storage_path")
        .in_("status", ["failed", "pending"])
        .order("uploaded_at")
        .execute()
        .data
        or []
    )

    if not rows:
        logger.info("No failed or pending assets found — nothing to reingest.")
        return

    logger.info("Found %d asset(s) to reingest:", len(rows))
    for r in rows:
        err = r.get("ingest_error") or "-"
        logger.info(
            "  [%s] status=%-8s file=%-40s error=%s",
            r["id"],
            r.get("status"),
            r.get("file_name") or r.get("title") or "(unknown)",
            err[:80],
        )

    repo = get_kb_repository()

    # Build tenant_uuid → clerk_org_id map for correct TenantContext construction
    tenant_map: dict[str, str] = {}
    tenant_rows = sb.table("tenants").select("id,clerk_org_id").execute().data or []
    for t in tenant_rows:
        tenant_map[str(t["id"])] = str(t["clerk_org_id"])

    ok: list[str] = []
    failed: dict[str, str] = {}

    for row in rows:
        asset_id = str(row["id"])
        asset_tenant = str(row["tenant_id"])
        clerk_org = tenant_map.get(asset_tenant, asset_tenant)
        fname = row.get("file_name") or row.get("title") or asset_id

        logger.info("Reingesting: %s (%s) tenant=%s (%s)", fname, asset_id, clerk_org, asset_tenant)

        # Build TenantContext with the correct clerk_org_id so tenant resolution works
        from dc_core.tenancy import TenantContext as TC

        ctx = TC(tenant_id=clerk_org, user_id="reingest-script", clerk_org_id=clerk_org)

        try:
            import uuid as _uuid

            # Try the normal path first (works when asset is under the shared tenant)
            job = repo.requeue_asset(ctx, asset_id)

            if not job:
                # Asset is under a non-shared (legacy) tenant — bypass requeue_asset
                # and build the job directly using the actual tenant_id from Supabase.
                logger.info(
                    "  Shared-mode requeue failed; using direct tenant bypass for legacy asset"
                )
                # Reset asset to processing state directly
                sb.table("kb_assets").update({"status": "processing", "ingest_error": None}).eq(
                    "id", asset_id
                ).eq("tenant_id", asset_tenant).execute()
                job_id = str(_uuid.uuid4())
                job_row = {
                    "id": job_id,
                    "tenant_id": asset_tenant,
                    "asset_id": asset_id,
                    "status": "queued",
                    "stage": "uploaded",
                    "progress_pct": 0,
                }
                sb.table("kb_ingest_jobs").insert(job_row).execute()
                job = {"id": job_id}

            # Run the ingest synchronously so we can see errors immediately
            process_ingest_job(
                {
                    "id": job["id"],
                    "tenant_id": asset_tenant,
                    "asset_id": asset_id,
                    "_clerk_key": asset_tenant,
                },
                repo,
            )

            # Check resulting status directly from Supabase (bypasses shared-mode scope)
            asset_rows = (
                sb.table("kb_assets")
                .select("status,ingest_error,chunk_count")
                .eq("id", asset_id)
                .eq("tenant_id", asset_tenant)
                .limit(1)
                .execute()
                .data
                or []
            )
            asset_row = asset_rows[0] if asset_rows else {}
            final_status = asset_row.get("status", "unknown")
            if final_status == "ready":
                chunk_count = asset_row.get("chunk_count") or 0
                logger.info("  OK  — status=ready, chunks=%d", chunk_count)
                ok.append(asset_id)
            else:
                ingest_err = asset_row.get("ingest_error") or "unknown error"
                logger.error("  FAIL — status=%s, error=%s", final_status, ingest_err)
                failed[asset_id] = ingest_err
        except Exception as exc:
            logger.error("  EXCEPTION — %s: %s", type(exc).__name__, exc)
            failed[asset_id] = str(exc)

    print()
    print("=" * 60)
    print(f"Reingest complete: {len(ok)} succeeded, {len(failed)} failed")
    if ok:
        print(f"  Succeeded: {ok}")
    if failed:
        print("  Failed:")
        for aid, err in failed.items():
            print(f"    {aid}: {err}")
    print("=" * 60)


if __name__ == "__main__":
    main()
