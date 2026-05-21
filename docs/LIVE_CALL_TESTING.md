# Live Call Assistant — local testing

The **Live Call Assistant** (`live-call`) ingests transcript segments, runs signal detection + optional LLM reasoning, surfaces KB/content, objections, unanswered questions, and logs every suggestion with timestamps.

## Prerequisites

1. **Monorepo dev running** (from repo root):

   ```bash
   pnpm dev
   ```

   - Web: http://localhost:3000  
   - API: http://localhost:8000  

2. **`services/api/.env`**

   ```bash
   DEMO_TRANSCRIPT_REPLAY=true
   ```

   (Already set in the team template — required for **Play demo transcript** and `scripts/demo_live_call_segments.sh`.)

3. **Supabase migration `006_live_call.sql`** applied (tables `call_transcript_events`, `live_call_suggestions`, `call_live_sessions`).  
   If segments fail with DB errors, run `infra/supabase/migrations/006_live_call.sql` in the Supabase SQL editor.

4. **Clerk** keys in `apps/web/.env.local` (sign in before using BFF routes).

5. **Optional:** KB assets ingested so **Knowledge** column shows semantic matches (otherwise transcript + nudges still work).

---

## Option A — UI demo (recommended)

1. Sign in at http://localhost:3000  
2. Open the built-in demo call:  
   **http://localhost:3000/calls/frontera-franchise-group/live**  
3. Wait until **Connecting stream…** disappears (WebSocket to `ws://localhost:8000/ws/calls/{callId}`).  
4. Click **Play demo transcript** (dev only — hidden in production builds).  
5. Watch:
   - **Transcript** column filling line-by-line  
   - **Nudges**, **BANT**, **intent/pain**, **KB assets**, **objections**, **suggestion log**  
6. Use **Bot chat** (right panel) to ask about the conversation — answers use transcript + KB.  
7. Accept/dismiss nudges to test suggestion feedback persistence.

**Important:** The demo player POSTs segments through the BFF while the live page holds the WebSocket open. If the stream is not connected, segments are stored but you will not see real-time updates.

---

## Option B — CLI script (API only)

With `pnpm dev` running and `DEMO_TRANSCRIPT_REPLAY=true`:

```bash
./scripts/demo_live_call_segments.sh frontera-franchise-group
```

Keep the live cockpit open in the browser **before** running the script so WebSocket subscribers receive broadcasts.

---

## Option C — curl (single segment)

```bash
curl -X POST "http://localhost:8000/api/v1/webhooks/recall/demo-segment?call_id=frontera-franchise-group&tenant_id=demo&user_id=demo" \
  -H "Content-Type: application/json" \
  -d '{"text":"We need budget approval for Q3 before the board meets","speaker_role":"customer","offset_seconds":42}'
```

---

## Verify backend

```bash
cd services/api
python3 -m pytest tests/test_live_call_handler.py -q
```

---

## Recall.ai (real meetings)

Implemented: bot create API, signed webhooks, same agent pipeline as demo.

- **Local:** set `RECALL_API_KEY`, `RECALL_REGION`, `PUBLIC_API_BASE_URL` (e.g. ngrok → port 8000) in `services/api/.env`.  
- **Production (Vercel):** see **[RECALL_PRODUCTION_TESTING.md](./RECALL_PRODUCTION_TESTING.md)** — API must be deployed separately; Vercel is UI only.

## Demo on production (optional)

By default **Play demo transcript** is hidden on Vercel builds. To keep it for your testing:

- API: `DEMO_TRANSCRIPT_REPLAY=true`  
- Vercel: `NEXT_PUBLIC_ENABLE_DEMO_TRANSCRIPT=true`  
- Redeploy both services.

---

## Troubleshooting

| Symptom | Fix |
|--------|-----|
| **Play demo transcript** disabled | Wait for WebSocket connect; check `NEXT_PUBLIC_WS_URL=ws://localhost:8000` |
| Demo returns 404 | Set `DEMO_TRANSCRIPT_REPLAY=true` in `services/api/.env` and restart API |
| Demo returns 401 in UI | Sign in with Clerk |
| No KB cards | Ingest KB assets under Knowledge; shared tenant uses `KB_SHARED_MODE` |
| Empty after refresh | Open live page again — it hydrates from `GET /api/calls/{id}/live-session` |
| Slow first nudge | First segment may invoke LLM (~10–30s); later segments use cheap pass |
