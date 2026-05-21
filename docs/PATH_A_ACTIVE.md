# Path A — active tunnel (local API → public URL)

**Generated:** 2026-05-21  
**Tunnel:** localtunnel (ngrok needs your authtoken — see below)

## Your public API URL (use everywhere as `API_URL`)

```text
https://thin-dragons-double.loca.lt
```

**Health check:**  
https://thin-dragons-double.loca.lt/health  
→ should show `{"status":"ok"}`

**Important:** This URL changes every time you restart the tunnel. Re-run:

```bash
./scripts/start-api-tunnel.sh
```

---

## What was configured

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

## Point Vercel at this tunnel

Vercel → **aim-set-2-0-web** → Settings → Environment Variables → Production:

```env
API_URL=https://thin-dragons-double.loca.lt
INTERNAL_API_URL=https://thin-dragons-double.loca.lt
NEXT_PUBLIC_API_URL=https://thin-dragons-double.loca.lt
NEXT_PUBLIC_WS_URL=wss://thin-dragons-double.loca.lt
INTERNAL_API_SECRET=dev-internal-secret-change-in-production
NEXT_PUBLIC_ENABLE_DEMO_TRANSCRIPT=true
```

Redeploy. Your laptop must stay on with `pnpm dev` + tunnel running.

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
4. Replace `thin-dragons-double.loca.lt` with your `https://xxxx.ngrok-free.app` in `.env` files and Vercel.
