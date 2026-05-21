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

## Runtime: “This page couldn’t load”

If the deploy **succeeds** but the site shows a generic reload/back screen:

1. Build log must show commit **`8a6bfb6` or later** (not `e03db53`).
2. Both **`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`** and **`CLERK_SECRET_KEY`** must be set (middleware needs the secret at runtime, not only at build).
3. Clerk **Domains** must include your Vercel host.
4. Open browser DevTools → Console on the failing URL and check Vercel → **Logs** for the function error.

## Backend requirement

Vercel is only building the Next.js web app. Live calls, Supabase-backed data, Recall.ai bot launch, and websockets still require the FastAPI service to be deployed at a public HTTPS host.

The FastAPI deployment needs the values from `services/api/.env.example`, especially:

```env
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
INTERNAL_SECRET=the_same_value_as_Vercel_INTERNAL_API_SECRET
OPENAI_API_KEY=...
ANTHROPIC_API_KEY=...
RECALL_API_KEY=...
RECALL_REGION=us-west-2
PUBLIC_API_BASE_URL=https://your-api-host.example.com
RECALL_WEBHOOK_SECRET=...
```

`PUBLIC_API_BASE_URL` must be reachable by Recall.ai so transcript webhooks can be delivered.

For step-by-step Recall testing on production, see **[RECALL_PRODUCTION_TESTING.md](./RECALL_PRODUCTION_TESTING.md)**.

## Local production build check

The build requires real Clerk keys, or at least a build-time Clerk publishable key:

```bash
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_... \
CLERK_SECRET_KEY=sk_test_... \
pnpm --filter @dc-copilot/web run build
```
