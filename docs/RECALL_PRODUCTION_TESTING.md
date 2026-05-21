# Recall.ai — production testing (Vercel + live calls)

Recall.ai is **implemented** in this repo. Vercel alone only hosts the **Next.js UI**; real-time Recall requires the **FastAPI API** on a public HTTPS host that Recall and browsers can reach.

## What is implemented

| Piece | Location |
|-------|----------|
| Create Recall bot (join meeting) | `POST /api/v1/calls/{call_id}/recall-bot` |
| Transcript webhooks | `POST /api/v1/webhooks/recall/transcript` |
| Live Call Agent pipeline | `live_call_agent.py` + `live_call/handler.py` |
| UI: Start Recall bot | Live cockpit → meeting URL + send icon |
| WebSocket to browser | `wss://{API}/ws/calls/{call_id}` |
| Demo transcript (no Recall) | `POST .../recall/demo-segment` + **Play demo transcript** button |

Unit tests: `services/api/tests/test_recall_integration.py`

---

## Architecture (production)

```text
Recall.ai  ──webhook──►  FastAPI (PUBLIC_API_BASE_URL)
                              │
                              ├──► Supabase (transcript + suggestions)
                              └──► WebSocket ──► Browser (live cockpit)

Vercel (Next.js)  ──BFF──►  FastAPI (API_URL)
       └── Clerk auth, /api/calls/.../recall-bot proxy
```

**Vercel env** must point at your API:

```env
API_URL=https://your-api.example.com
INTERNAL_API_URL=https://your-api.example.com
INTERNAL_API_SECRET=<same as API INTERNAL_SECRET>
NEXT_PUBLIC_API_URL=https://your-api.example.com
NEXT_PUBLIC_WS_URL=wss://your-api.example.com
```

**FastAPI env** (on Railway / Fly / Render / VM — not Vercel):

```env
RECALL_API_KEY=<from Recall dashboard>
RECALL_REGION=us-west-2
RECALL_BOT_NAME=DC Copilot Live Agent
PUBLIC_API_BASE_URL=https://your-api.example.com
RECALL_WEBHOOK_SECRET=<from Recall webhook settings>
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
INTERNAL_SECRET=<same as Vercel INTERNAL_API_SECRET>
OPENAI_API_KEY=...
ANTHROPIC_API_KEY=...
```

`PUBLIC_API_BASE_URL` must be the **same public host** as `API_URL` (HTTPS, no trailing slash). Recall registers this webhook when the bot is created:

`{PUBLIC_API_BASE_URL}/api/v1/webhooks/recall/transcript?call_id=...&tenant_id=...&user_id=...`

Apply Supabase migration `infra/supabase/migrations/006_live_call.sql` on production DB.

---

## Test Recall.ai end-to-end (real meeting)

### 1. Prerequisites

- [Recall.ai](https://www.recall.ai/) account with API key  
- FastAPI deployed and healthy: `https://your-api.example.com/docs`  
- Vercel app signed in with Clerk  
- A **real** meeting link (Google Meet, Zoom, Teams, etc.) you can join  
- A call in DC Copilot with that `meetingUrl` (or paste URL on live page)

### 2. Launch the bot

1. Open: `https://<your-vercel-app>/calls/<call-id>/live`  
2. In the top bar, enter the **Meeting URL** (or use the one on the call).  
3. Click **Start Recall bot** (send icon).  
4. Success: green message **Bot invited: &lt;bot-id&gt;**  
5. In the meeting, admit **DC Copilot Live Agent** (or your `RECALL_BOT_NAME`) when prompted.

### 3. Verify real-time behavior

- Speak on the call; within a few seconds you should see **transcript** lines.  
- Watch **nudges**, **intent/pain**, **KB**, **objections**, **suggestion log** as triggers fire.  
- Header should not stay on “Connecting stream…” — WebSocket must be `wss://your-api...`.

### 4. If bot launch fails

| Error | Likely cause |
|-------|----------------|
| 503 Recall is not configured | Missing `RECALL_API_KEY` or `PUBLIC_API_BASE_URL` on API |
| 502 Recall bot creation failed | Invalid API key, wrong `RECALL_REGION`, or Recall account limits |
| 401 on `/api/calls/.../recall-bot` | Not signed in on Vercel / Clerk |
| Bot joins but no transcript | Webhook blocked; `PUBLIC_API_BASE_URL` wrong or not HTTPS; check API logs |
| Transcript in DB but not UI | `NEXT_PUBLIC_WS_URL` wrong or WS blocked by firewall |

Check **API logs** when Recall POSTs to `/api/v1/webhooks/recall/transcript`.  
Check **Vercel function logs** only for BFF errors (proxy to API).

### 5. Recall dashboard

- Confirm the bot appears under your Recall project.  
- Webhook URL should match the URL returned in the create-bot response (`webhookUrl` in API JSON).  
- If you set `RECALL_WEBHOOK_SECRET`, Recall must send the signed headers your app expects.

---

## Keep demo transcript on production (optional)

Demo does **not** use Recall. Use it to validate the live cockpit without a meeting.

**On FastAPI:**

```env
DEMO_TRANSCRIPT_REPLAY=true
```

**On Vercel** (demo button is hidden in production by default):

```env
NEXT_PUBLIC_ENABLE_DEMO_TRANSCRIPT=true
```

Redeploy both. On the live page: wait for stream connected → **Play demo transcript**.

Demo call id: `frontera-franchise-group`  
URL: `https://<your-vercel-app>/calls/frontera-franchise-group/live`

See also [LIVE_CALL_TESTING.md](./LIVE_CALL_TESTING.md) for local steps.

---

## Quick checklist

- [ ] FastAPI public URL set in Vercel `API_URL` / `NEXT_PUBLIC_WS_URL`  
- [ ] `PUBLIC_API_BASE_URL` on API matches that host  
- [ ] `RECALL_*` vars on API only  
- [ ] Migration `006_live_call.sql` applied  
- [ ] Clerk domain includes Vercel URL  
- [ ] Real meeting → Start Recall bot → admit bot → speak → see transcript  

If your API is not deployed yet, Recall cannot work on Vercel-only hosting. Deploy API first (see `04_Tech_Stack.md` — Railway/Fly recommended).
