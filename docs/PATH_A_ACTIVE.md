# Path A — local API tunnel (development only)

> **Do not use this for Vercel Production.** Tunnel URLs change on every restart and your laptop must stay online. Production needs a deployed API — see **[API_DEPLOYMENT.md](./API_DEPLOYMENT.md)**.

**Generated:** 2026-05-21  
**Tunnel:** localtunnel (ngrok needs your authtoken — see below)

## Your public API URL (local dev only)

Run `./scripts/start-api-tunnel.sh` and paste the printed `https://....loca.lt` URL.

**Health check:** `https://<tunnel>/health` → `{"status":"ok", ...}`

**Important:** This URL changes every time you restart the tunnel.

---

## What was configured (local)

| File | Change |
|------|--------|
| `services/api/.env` | `PUBLIC_API_BASE_URL` = tunnel URL |
| `apps/web/.env.local` | `API_URL`, `NEXT_PUBLIC_WS_URL`, demo flag |

**Restart required:** stop and run `pnpm dev` again so API + Next.js load new env.

---

## Test locally (fastest)

1. Keep tunnel running (see script below).
2. `pnpm dev` from repo root.
3. Open: http://localhost:3000/calls/frontera-franchise-group/live  
4. Wait for stream connected → **Play demo transcript**.

---

## Optional: point Vercel Preview at tunnel (not Production)

Only for short-lived demos while your Mac is on:

```env
API_URL=https://<current-tunnel>.loca.lt
INTERNAL_API_URL=https://<current-tunnel>.loca.lt
NEXT_PUBLIC_API_URL=https://<current-tunnel>.loca.lt
NEXT_PUBLIC_WS_URL=wss://<current-tunnel-host>
INTERNAL_API_SECRET=<match services/api INTERNAL_SECRET>
```

Redeploy. Replace URLs after every tunnel restart.

---

## Recall.ai (real meetings)

1. Add to `services/api/.env`:
   ```env
   RECALL_API_KEY=<from Recall dashboard>
   RECALL_WEBHOOK_SECRET=<optional>
   ```
2. Restart API (`pnpm dev`).
3. Live page → paste meeting URL → **Start Recall bot**.

---

## ngrok (optional, more stable URL)

1. Sign up: https://dashboard.ngrok.com/signup  
2. `ngrok config add-authtoken <YOUR_TOKEN>`  
3. `ngrok http 8000`  
4. Use the `https://xxxx.ngrok-free.app` URL in local `.env` files only.
