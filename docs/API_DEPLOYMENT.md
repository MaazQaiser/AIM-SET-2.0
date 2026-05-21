# FastAPI API deployment (Supabase + KB)

Vercel hosts only the Next.js app. **Supabase credentials and KB file storage go on this API service**, not on Vercel.

## Quick deploy (Railway)

1. Create a [Railway](https://railway.app) project → **Deploy from GitHub** → select this repo.
2. Railway may create **two** services (`@dc-copilot/web` and `@dc-copilot/api`). **Delete or stop `@dc-copilot/web`** — the web app stays on Vercel.
3. Open **`@dc-copilot/api`** → **Settings**:
   - **Root Directory:** `/` (repo root — **not** `services/api` or `apps/web`)
   - **Dockerfile Path:** `Dockerfile.api`
4. If the service **crashed**, check **Deployments → View logs**. Common fixes: wrong root directory, missing env vars, or port (the Dockerfile uses Railway’s `PORT`).
4. Add environment variables (see below).
5. Copy the public HTTPS URL (e.g. `https://dc-copilot-api-production.up.railway.app`).
6. Paste that URL into Vercel env vars — see [VERCEL_DEPLOYMENT.md](./VERCEL_DEPLOYMENT.md).

### Render (alternative)

- New **Web Service** → Docker → Dockerfile path: `Dockerfile.api`
- Same env vars as Railway
- Health check path: `/health`

## Required environment variables

Copy from [`services/api/.env.example`](../services/api/.env.example). Minimum for Supabase + KB on Vercel:

```env
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service_role_key>

INTERNAL_SECRET=<long_random_string>
# Must match Vercel INTERNAL_API_SECRET exactly

OPENAI_API_KEY=<sk-...>
# Required for KB chunk embeddings after upload

KB_STORAGE_BUCKET=kb-assets
KB_SHARED_MODE=true
KB_SHARED_TENANT_KEY=dc-copilot-shared
KB_INGEST_SYNC=true

PUBLIC_API_BASE_URL=https://<this-api-host>
CORS_ALLOWED_ORIGINS=https://aim-set-2-0-web.vercel.app,http://localhost:3000
```

### Why `KB_INGEST_SYNC=true`

When `false`, uploads queue `kb_ingest_jobs` but nothing processes them unless you run `python -m app.workers.kb_ingest_worker`. With `true`, parse/chunk/embed runs in the upload request (simplest single-instance production setup).

### Optional (Recall, Content Studio)

```env
ANTHROPIC_API_KEY=...
RECALL_API_KEY=...
RECALL_REGION=us-west-2
RECALL_WEBHOOK_SECRET=...
```

## Verify deployment

```bash
curl -s https://<your-api-host>/health | jq
```

Expected:

```json
{
  "status": "ok",
  "supabase_configured": true,
  "openai_configured": true,
  "kb_ingest_sync": true,
  "kb_shared_mode": true
}
```

If `supabase_configured` is `false`, DC notes and KB will use in-memory storage and **data will disappear on restart**.

## Local Docker build

```bash
docker build -f Dockerfile.api -t dc-copilot-api .
docker run --rm -p 8000:8000 --env-file services/api/.env dc-copilot-api
```

## Supabase prerequisites

- Migrations applied: `infra/supabase/migrations/` or `scripts/apply_supabase_migrations.py`
- Storage bucket `kb-assets` exists (created in migration 002)

After a KB upload from Vercel, confirm in Supabase:

- **Storage** → `kb-assets` → `{tenant_uuid}/kb-.../`
- **Table Editor** → `kb_assets` with `status` = `ready`, `chunk_count` > 0

## Wire Vercel

```env
API_URL=https://<your-api-host>
INTERNAL_API_URL=https://<your-api-host>
NEXT_PUBLIC_API_URL=https://<your-api-host>
NEXT_PUBLIC_WS_URL=wss://<your-api-host>
INTERNAL_API_SECRET=<same as INTERNAL_SECRET on API>
```

Redeploy Vercel after saving. Do **not** use localtunnel URLs in production — see [PATH_A_ACTIVE.md](./PATH_A_ACTIVE.md) (dev only).
