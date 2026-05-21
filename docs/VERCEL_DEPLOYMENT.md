# Vercel Deployment

This repo is prepared for deploying the Next.js web app from the monorepo.

## Project settings

- Framework preset: Next.js
- Root directory: `apps/web`

**Important:** In the Vercel build log, confirm the clone line shows commit **`f03553e` or later** (not `e03db53`).  
Redeploying an *old* deployment reuses the old commit. Use **Deployments → Redeploy** on the latest `main` commit, or push a new commit to trigger a fresh build.
- Install command: `cd ../.. && pnpm install --frozen-lockfile`
- Build command: `cd ../.. && pnpm --filter @dc-copilot/web build`
- Output directory: `.next`

These values are also captured in `apps/web/vercel.json`.

## Required web environment variables

### Already set via `apps/web/vercel.json` (no action needed)

These public routing defaults are committed in the repo:

- `NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in`
- `NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up`
- `NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/`
- `NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/`
- `NEXT_PUBLIC_KB_SHARED=true`

### You must add in Vercel Dashboard

Vercel → your project → **Settings** → **Environment Variables**.  
Use the checklist in `apps/web/.env.vercel.template`.

**Required for build and sign-in** (from [Clerk Dashboard → API Keys](https://dashboard.clerk.com/last-active?path=api-keys)):

```env
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_xxxxxxxx
CLERK_SECRET_KEY=sk_live_xxxxxxxx
```

**Required for API routes after deploy** (your public FastAPI host):

```env
API_URL=https://your-api-host.example.com
INTERNAL_API_URL=https://your-api-host.example.com
INTERNAL_API_SECRET=the_same_value_as_services_api_INTERNAL_SECRET
NEXT_PUBLIC_API_URL=https://your-api-host.example.com
NEXT_PUBLIC_WS_URL=wss://your-api-host.example.com
```

Use real keys only — not `pk_test_...` / `pk_live_...` placeholder text from docs.

Do not enable `NEXT_PUBLIC_AUTH_BYPASS` in Vercel production.

### Clerk domain (runtime)

In [Clerk Dashboard → Domains](https://dashboard.clerk.com/), add your Vercel production URL (e.g. `https://your-app.vercel.app`) and any preview pattern you use. Without this, the app can build but fail at runtime with a blank or generic error page.

## “Auth not configured” + unable to load data

The top bar shows **Auth not configured** when Clerk env vars are missing or invalid at **runtime**. All `/api/*` BFF routes then return **401**, so lists (calls, KB, etc.) stay empty.

### Fix

1. Vercel → **Settings** → **Environment Variables** → **Production** (and Preview if you use it):
   - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` = `pk_test_...` or `pk_live_...` (from [Clerk API Keys](https://dashboard.clerk.com/last-active?path=api-keys))
   - `CLERK_SECRET_KEY` = `sk_test_...` or `sk_live_...` (same page)
   - Paste the **full** key; do not truncate (keys often end with `$` — include it).
2. **Redeploy** after saving (required: `NEXT_PUBLIC_*` is baked in at build time).
3. [Clerk Dashboard → Domains](https://dashboard.clerk.com/): add `https://aim-set-2-0-web.vercel.app` (and preview URL if needed).
4. Set `API_URL` to your **FastAPI** host (not the Vercel web URL). See [RECALL_PRODUCTION_TESTING.md](./RECALL_PRODUCTION_TESTING.md).

### Verify

- Open: `https://<your-app>/api/health/deployment`  
  → `clerkReady: true` and `apiUrlConfigured: true`
- Dashboard should show a yellow setup banner until fixed.

## Runtime: “This page couldn’t load”

If the deploy **succeeds** but the site shows a generic reload/back screen:

1. Build log must show commit **`8a6bfb6` or later** (not `e03db53`).
2. Both **`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`** and **`CLERK_SECRET_KEY`** must be set (middleware needs the secret at runtime, not only at build).
3. Clerk **Domains** must include your Vercel host.
4. Open browser DevTools → Console on the failing URL and check Vercel → **Logs** for the function error.

## Backend requirement (Supabase + KB)

Vercel is only building the Next.js web app. **All Supabase reads/writes and KB file uploads go through the FastAPI API** — not through Vercel env vars.

Deploy the API first: **[API_DEPLOYMENT.md](./API_DEPLOYMENT.md)** (Railway/Render + `Dockerfile.api`).

Do **not** point production `API_URL` at a localtunnel URL ([PATH_A_ACTIVE.md](./PATH_A_ACTIVE.md) is dev-only). Data “vanishes” when the API runs without Supabase or restarts with in-memory fallback.

### API host environment (minimum)

```env
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
INTERNAL_SECRET=the_same_value_as_Vercel_INTERNAL_API_SECRET
OPENAI_API_KEY=...
KB_INGEST_SYNC=true
KB_SHARED_MODE=true
KB_STORAGE_BUCKET=kb-assets
PUBLIC_API_BASE_URL=https://your-api-host.example.com
CORS_ALLOWED_ORIGINS=https://aim-set-2-0-web.vercel.app,http://localhost:3000
```

Optional: `ANTHROPIC_API_KEY`, `RECALL_*` for Content Studio and live calls.

### Vercel → API wiring

```env
API_URL=https://your-api-host.example.com
INTERNAL_API_URL=https://your-api-host.example.com
INTERNAL_API_SECRET=<same as API INTERNAL_SECRET>
NEXT_PUBLIC_API_URL=https://your-api-host.example.com
NEXT_PUBLIC_WS_URL=wss://your-api-host.example.com
```

**Redeploy Vercel** after changing `API_URL` or any `NEXT_PUBLIC_*` variable.

### Verify Supabase + KB end-to-end

1. **API health:** `curl https://<api-host>/health`  
   → `supabase_configured: true`, `openai_configured: true`, `kb_ingest_sync: true`
2. **Vercel health:** `https://<vercel-app>/api/health/deployment`  
   → `clerkReady: true`, `apiUrlConfigured: true`
3. **DC notes:** Import CSV on Settings → reload → data persists (check `pre_dc_records` in Supabase)
4. **KB upload:** Knowledge → Upload asset → success toast  
   → Supabase Storage `kb-assets` has a new object; `kb_assets.status` = `ready`, `chunk_count` > 0

### KB upload timeouts on Vercel

Large files run sync ingest on the API. `apps/web/vercel.json` sets `maxDuration: 60` for `/api/kb/upload`. Hobby plan caps at 10s — use Pro for 60s or smaller test files.

### Troubleshooting

| Symptom | Likely cause |
|---------|----------------|
| Empty lists after reload | `API_URL` wrong, API down, or Clerk/secret 401 |
| Upload 502/503 | Vercel cannot reach `API_URL`; tunnel dead |
| Upload OK but asset `pending` | API missing `KB_INGEST_SYNC=true` and no worker |
| Data in app, empty in Supabase | API missing `SUPABASE_*` (memory fallback) |
| Ingest failed | Missing `OPENAI_API_KEY` on API |

`PUBLIC_API_BASE_URL` must be reachable by Recall.ai for live-call webhooks. See **[RECALL_PRODUCTION_TESTING.md](./RECALL_PRODUCTION_TESTING.md)**.

## Local production build check

The build requires real Clerk keys, or at least a build-time Clerk publishable key:

```bash
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_... \
CLERK_SECRET_KEY=sk_test_... \
pnpm --filter @dc-copilot/web run build
```
