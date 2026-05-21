# Railway: fix “pnpm could not be found” / API crashed

Railway tried to run the API as a **Node/pnpm** app. This API is **Python + Docker**.

## Fix in Railway UI (2 minutes)

1. Open **`@dc-copilot/api`** → **Settings**
2. Right sidebar → **Build**
3. Set **Builder** to **`Dockerfile`** (not Railpack / Nixpacks / Node)
4. Set **Dockerfile path** to **`Dockerfile.api`**
5. Right sidebar → **Source**
6. **Root Directory:** `/` (repo root — empty or `/`)
7. Right sidebar → **Config-as-code** (if shown)
   - Config file: `services/api/railway.toml` or `railway.toml`
8. **Settings → Deploy** — clear any **Custom Start Command** that mentions `pnpm`
9. **Deployments** → **Redeploy**

Success: deploy log shows Docker build (pip install), not `node@22` / `pnpm`.

## Verify

`https://<your-railway-domain>/health` → JSON with `"status":"ok"`.
