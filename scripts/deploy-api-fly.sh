#!/usr/bin/env bash
# Deploy FastAPI API to Fly.io and print Vercel env values to set.
# Prerequisites: fly auth login (once)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
export PATH="${HOME}/.fly/bin:${PATH}"

APP_NAME="${FLY_APP_NAME:-dc-copilot-api}"
ENV_FILE="${API_ENV_FILE:-services/api/.env}"

if ! fly auth whoami >/dev/null 2>&1; then
  echo "Not logged into Fly. Run: fly auth login"
  exit 1
fi

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE"
  exit 1
fi

# Create app if missing
if ! fly apps list 2>/dev/null | awk '{print $1}' | grep -qx "$APP_NAME"; then
  echo "Creating Fly app: $APP_NAME"
  fly apps create "$APP_NAME" || true
fi

echo "Building secrets from $ENV_FILE (values not printed)..."
APP_NAME="$APP_NAME" ENV_FILE="$ENV_FILE" python3 - <<'PY' > /tmp/dc-fly-secrets.env
from pathlib import Path
import os
env_path = Path(os.environ["ENV_FILE"])
app = os.environ["APP_NAME"]
wanted = {
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "INTERNAL_SECRET",
  "OPENAI_API_KEY",
  "ANTHROPIC_API_KEY",
  "KB_STORAGE_BUCKET",
  "KB_INGEST_SYNC",
  "KB_SHARED_MODE",
  "KB_SHARED_TENANT_KEY",
  "KB_EMBEDDING_MODEL",
  "KB_EMBEDDING_DIMENSIONS",
  "KB_MAX_UPLOAD_BYTES",
  "RECALL_API_KEY",
  "RECALL_REGION",
  "RECALL_WEBHOOK_SECRET",
  "RECALL_BOT_NAME",
}
vals = {}
for line in env_path.read_text().splitlines():
    line = line.strip()
    if not line or line.startswith("#") or "=" not in line:
        continue
    k, v = line.split("=", 1)
    k = k.strip()
    if k in wanted:
        vals[k] = v.strip().strip('"').strip("'")
vals["DEMO_TRANSCRIPT_REPLAY"] = "false"
vals["PUBLIC_API_BASE_URL"] = f"https://{app}.fly.dev"
vals["CORS_ALLOWED_ORIGINS"] = "https://aim-set-2-0-web.vercel.app,http://localhost:3000,http://localhost:3002"
for k, v in vals.items():
    if v:
        print(f"{k}={v}")
PY

echo "Setting Fly secrets..."
fly secrets import --app "$APP_NAME" < /tmp/dc-fly-secrets.env
rm -f /tmp/dc-fly-secrets.env

echo "Deploying (remote builder)..."
fly deploy --app "$APP_NAME" --remote-only

API_URL="https://${APP_NAME}.fly.dev"
echo ""
echo "=== Deployed ==="
echo "API: $API_URL"
echo "Health:"
curl -sS "$API_URL/health" || true
echo ""
echo "=== Set these in Vercel → Environment Variables, then Redeploy ==="
echo "API_URL=$API_URL"
echo "INTERNAL_API_URL=$API_URL"
echo "NEXT_PUBLIC_API_URL=$API_URL"
echo "NEXT_PUBLIC_WS_URL=wss://${APP_NAME}.fly.dev"
echo "INTERNAL_API_SECRET=<same value as INTERNAL_SECRET in services/api/.env>"
