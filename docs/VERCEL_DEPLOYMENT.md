# Vercel Deployment

This repo is prepared for deploying the Next.js web app from the monorepo.

## Project settings

- Framework preset: Next.js
- Root directory: `apps/web`
- Install command: `cd ../.. && pnpm install --frozen-lockfile`
- Build command: `cd ../.. && pnpm --filter @dc-copilot/web build`
- Output directory: `.next`

These values are also captured in `apps/web/vercel.json`.

## Required web environment variables

Set these in Vercel for Production, Preview, and Development as needed:

```env
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...
CLERK_SECRET_KEY=sk_live_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/

API_URL=https://your-api-host.example.com
INTERNAL_API_URL=https://your-api-host.example.com
INTERNAL_API_SECRET=the_same_value_as_services_api_INTERNAL_SECRET
NEXT_PUBLIC_API_URL=https://your-api-host.example.com
NEXT_PUBLIC_WS_URL=wss://your-api-host.example.com
NEXT_PUBLIC_KB_SHARED=true
```

Use the full Clerk keys from Clerk Dashboard -> API Keys. The `pk_live_...` and `sk_live_...` values above are placeholders; pasting those exact placeholder strings will fail the build.

Do not enable `NEXT_PUBLIC_AUTH_BYPASS` in Vercel production.

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

## Local production build check

The build requires real Clerk keys, or at least a build-time Clerk publishable key:

```bash
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_... \
CLERK_SECRET_KEY=sk_test_... \
pnpm --filter @dc-copilot/web run build
```
