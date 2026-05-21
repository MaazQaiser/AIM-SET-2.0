# Railway: fix “pnpm could not be found” / API crashed

Railway tried to run the API as a **Node/pnpm** app. This API is **Python + Docker**.

## Easiest fix (no “Build” menu needed)

### Step 1 — Root directory (Settings → Source)

1. **`@dc-copilot/api`** → **Settings** (top tab)
2. Under **Source Repo**, set **Root Directory** to **`/`** (repo root)
   - If you see “Add Root Directory”, click it and enter `/`

### Step 2 — Force Docker via Variables tab

1. Top tab → **Variables**
2. **Add variable:**

   | Name | Value |
   |------|--------|
   | `RAILWAY_DOCKERFILE_PATH` | `Dockerfile` |

3. Save (Railway redeploys)

Railway will use the root **`Dockerfile`** (auto-detected) instead of pnpm.

### Step 3 — Redeploy

**Deployments** → latest → **Redeploy** (or wait for auto-deploy from GitHub)

Success in logs:

```text
Using detected Dockerfile!
```

Not `node@22` or `pnpm`.

---

## If you DO see a sidebar / search

- **Filter Settings…** box → type **`docker`** or **`build`**
- Or open **Config-as-code** → point to `railway.toml` or `services/api/railway.toml`

---

## After deploy is green

1. **Variables** — add Supabase/OpenAI keys from `services/api/.env`
2. **Networking** — **Generate Domain**
3. **Vercel** — set `API_URL` to that Railway URL

## Verify

`https://<railway-domain>/health` → `"status":"ok"`
